/**
 * Quick fixes for unambiguous, verified syntax errors (§7).
 *
 * Only insertion fixes produced by the parser are offered (missing `;`,
 * `)`, `]`, `}`): they cannot rewrite strings, comments, or Hindi text.
 * No fix is offered for semantic diagnostics (arity / unknown functions).
 */
import * as vscode from 'vscode';
import { parseSource } from './parser';

export class TinyCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(document: vscode.TextDocument, range: vscode.Range): vscode.CodeAction[] {
    const result = parseSource(document.getText());
    const actions: vscode.CodeAction[] = [];
    for (const d of result.diagnostics) {
      if (d.kind !== 'syntax' || !d.fix) {
        continue;
      }
      const fixRange = new vscode.Range(document.positionAt(d.start), document.positionAt(d.end));
      if (!fixRange.intersection(range)) {
        continue;
      }
      const edit = new vscode.WorkspaceEdit();
      edit.replace(
        document.uri,
        new vscode.Range(document.positionAt(d.fix.start), document.positionAt(d.fix.end)),
        d.fix.newText
      );
      const action = new vscode.CodeAction(`Tiny: insert '${d.fix.newText.trim()}'`, vscode.CodeActionKind.QuickFix);
      action.edit = edit;
      action.diagnostics = [new vscode.Diagnostic(fixRange, d.message, vscode.DiagnosticSeverity.Error)];
      actions.push(action);
      if (actions.length >= 5) {
        break;
      }
    }
    return actions;
  }
}
