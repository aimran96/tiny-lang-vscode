/** Signature help for builtins and user functions (§5). */
import * as vscode from 'vscode';
import { findBuiltin } from './builtins';
import { parseDocument } from './diagnostics';

export class TinySignatureProvider implements vscode.SignatureHelpProvider {
  provideSignatureHelp(document: vscode.TextDocument, position: vscode.Position): vscode.SignatureHelp | undefined {
    // Find enclosing call: scan back from cursor for `name(` with balanced parens.
    const text = document.getText();
    const offset = document.offsetAt(position);
    let depth = 0;
    let i = offset - 1;
    // Skip whitespace; cursor must be inside `(…)`.
    let j = i;
    while (j >= 0 && /\s/.test(text[j])) {
      j--;
    }
    if (j < 0) {
      return undefined;
    }
    for (; i >= 0; i--) {
      const ch = text[i];
      if (ch === ')') {
        depth++;
      } else if (ch === '(') {
        if (depth === 0) {
          break;
        }
        depth--;
      } else if ((ch === ';' || ch === '{' || ch === '}') && depth === 0) {
        return undefined;
      }
    }
    if (i < 0 || text[i] !== '(') {
      return undefined;
    }
    const nameMatch = /[a-zA-Z_\u0900-\u097f][a-zA-Z0-9_\u0900-\u097f]*$/u.exec(text.slice(0, i));
    if (!nameMatch) {
      return undefined;
    }
    const name = nameMatch[0];

    // Active parameter = commas at depth 0 between `(` and cursor.
    let activeParameter = 0;
    let d = 0;
    for (let k = i + 1; k < offset; k++) {
      const ch = text[k];
      if (ch === '(' || ch === '[') {
        d++;
      } else if (ch === ')' || ch === ']') {
        d = Math.max(0, d - 1);
      } else if (ch === ',' && d === 0) {
        activeParameter++;
      }
    }

    const help = new vscode.SignatureHelp();
    const builtin = findBuiltin(name);
    if (builtin && builtin.callable) {
      const sig = new vscode.SignatureInformation(
        `${builtin.name}(${builtin.params.map((p) => (p.optional ? `[${p.name}]` : p.name)).join(', ')})`,
        builtin.doc
      );
      sig.parameters = builtin.params.map((p) => new vscode.ParameterInformation(p.name, p.doc));
      help.signatures = [sig];
      help.activeSignature = 0;
      help.activeParameter = Math.min(activeParameter, Math.max(0, sig.parameters.length - 1));
      return help;
    }
    const result = parseDocument(document);
    const decls = result.functions.filter((f) => f.name === name);
    if (decls.length === 0) {
      return undefined;
    }
    help.signatures = decls.map((fn) => {
      const sig = new vscode.SignatureInformation(
        `${fn.name}(${fn.params.map((p) => p.name).join(', ')})`,
        `User-defined function (${fn.arity} parameter(s)).`
      );
      sig.parameters = fn.params.map((p) => new vscode.ParameterInformation(p.name));
      return sig;
    });
    help.activeSignature = 0;
    const arity = decls[0].arity;
    help.activeParameter = arity === 0 ? 0 : Math.min(activeParameter, arity - 1);
    return help;
  }
}
