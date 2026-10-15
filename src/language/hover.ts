/** Hover documentation for builtins, keywords, and user symbols (§5). */
import * as vscode from 'vscode';
import { findBuiltin, KEYWORDS } from './builtins';
import { parseDocument } from './diagnostics';

function wordAt(document: vscode.TextDocument, position: vscode.Position): { word: string; range: vscode.Range } | undefined {
  const range = document.getWordRangeAtPosition(position, /[a-zA-Z_\u0900-\u097f][a-zA-Z0-9_\u0900-\u097f]*/u);
  if (!range) {
    return undefined;
  }
  return { word: document.getText(range), range };
}

export class TinyHoverProvider implements vscode.HoverProvider {
  provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | undefined {
    const found = wordAt(document, position);
    if (!found) {
      return undefined;
    }
    const { word, range } = found;

    const builtin = findBuiltin(word);
    if (builtin) {
      const md = new vscode.MarkdownString();
      md.appendCodeblock(`${builtin.name}${builtin.hindi ? ` / ${builtin.hindi}` : ''}(${builtin.params.map((p) => (p.optional ? `[${p.name}]` : p.name)).join(', ')})`, 'tinylang');
      md.appendMarkdown(`\n\n${builtin.doc}`);
      if (!builtin.callable) {
        md.appendMarkdown('\n\n*Not callable in the current grammar/interpreter — reserved lexer token only.*');
      }
      return new vscode.Hover(md, range);
    }

    for (const kw of KEYWORDS) {
      if (kw.names.includes(word)) {
        const md = new vscode.MarkdownString();
        md.appendCodeblock(word, 'tinylang');
        md.appendMarkdown(`\n\n${kw.doc}`);
        return new vscode.Hover(md, range);
      }
    }

    const result = parseDocument(document);
    const fn = result.functions.find((f) => f.name === word);
    if (fn) {
      const md = new vscode.MarkdownString();
      const params = fn.params.map((p) => p.name).join(', ');
      md.appendCodeblock(`function ${fn.name}(${params})`, 'tinylang');
      md.appendMarkdown(`\n\nUser-defined function in this file (${fn.arity} parameter(s)).`);
      return new vscode.Hover(md, range);
    }
    const binding = result.bindings.find((b) => b.name === word);
    if (binding) {
      const md = new vscode.MarkdownString();
      md.appendCodeblock(word, 'tinylang');
      md.appendMarkdown('\n\nVariable assigned in this file.');
      return new vscode.Hover(md, range);
    }
    return undefined;
  }
}
