/** Semantic highlighting for definitions vs uses (§5, last item). */
import * as vscode from 'vscode';
import { parseDocument } from './diagnostics';

const legend = new vscode.SemanticTokensLegend(['function', 'variable'], ['declaration']);

export function getSemanticLegend(): vscode.SemanticTokensLegend {
  return legend;
}

export class TinySemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
  provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.SemanticTokens {
    const builder = new vscode.SemanticTokensBuilder(legend);
    const result = parseDocument(document);
    // Legend indices: tokenTypes ['function', 'variable'], modifiers ['declaration'].
    const push = (start: number, end: number, type: number, modifiers: number): void => {
      const s = document.positionAt(Math.min(start, document.getText().length));
      const e = document.positionAt(Math.min(end, document.getText().length));
      builder.push(s.line, s.character, e.character - s.character, type, modifiers);
    };
    for (const fn of result.functions) {
      push(fn.nameStart, fn.nameEnd, 0, 1);
      for (const p of fn.params) {
        push(p.start, p.end, 1, 1);
      }
    }
    for (const call of result.calls) {
      if (!call.builtin) {
        push(call.start, call.end, 0, 0);
      }
    }
    for (const b of result.bindings) {
      push(b.start, b.end, 1, 1);
    }
    for (const u of result.varUses) {
      push(u.start, u.end, 1, 0);
    }
    return builder.build();
  }
}
