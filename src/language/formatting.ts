/**
 * Formatting: reindent by brace depth + safe whitespace fixes (§7).
 *
 * Safety: never touches the inside of strings or comments — all edits are
 * line-indent changes, trailing-whitespace trims, comma-spacing insertions
 * at lexer-verified token positions, or a final newline. Hindi text and
 * string contents are byte-identical after formatting.
 */
import * as vscode from 'vscode';
import { lex } from './lexer';

function indentOf(line: string): string {
  const m = /^[ \t]*/.exec(line);
  return m ? m[0] : '';
}

/** Net `{`/`}` depth delta contributed by code tokens on one line. */
function braceDeltas(document: vscode.TextDocument): { opens: number[]; closes: number[] } {
  const { tokens } = lex(document.getText());
  const opens = new Array<number>(document.lineCount).fill(0);
  const closes = new Array<number>(document.lineCount).fill(0);
  for (const t of tokens) {
    if (t.kind !== 'punct' || (t.text !== '{' && t.text !== '}')) {
      continue;
    }
    const line = document.positionAt(t.start).line;
    if (t.text === '{') {
      opens[line]++;
    } else {
      closes[line]++;
    }
  }
  return { opens, closes };
}

function computeIndentEdits(
  document: vscode.TextDocument,
  startLine: number,
  endLine: number,
  baseDepth: number
): vscode.TextEdit[] {
  const edits: vscode.TextEdit[] = [];
  const { opens, closes } = braceDeltas(document);
  let depth = baseDepth;
  for (let line = startLine; line <= endLine; line++) {
    const text = document.lineAt(line).text;
    if (text.trim().length === 0) {
      if (text.length > 0) {
        edits.push(vscode.TextEdit.delete(new vscode.Range(line, 0, line, text.length)));
      }
      continue;
    }
    const startsWithClose = text.trimStart().startsWith('}');
    // Depth for this line: dedent if the line's first code token is `}`.
    const lineDepth = Math.max(0, depth - (startsWithClose ? Math.min(closes[line], 1) : 0));
    const desired = '  '.repeat(lineDepth);
    const current = indentOf(text);
    if (current !== desired) {
      edits.push(vscode.TextEdit.replace(new vscode.Range(line, 0, line, current.length), desired));
    }
    // Trailing whitespace trim.
    const trailing = /[ \t]+$/.exec(text);
    if (trailing) {
      edits.push(
        vscode.TextEdit.delete(
          new vscode.Range(line, text.length - trailing[0].length, line, text.length)
        )
      );
    }
    depth = Math.max(0, depth + opens[line] - closes[line]);
  }
  return edits;
}

/** Depth at `startLine` computed from the top of the file. */
function depthAtLine(document: vscode.TextDocument, startLine: number): number {
  const { opens, closes } = braceDeltas(document);
  let depth = 0;
  for (let line = 0; line < startLine; line++) {
    depth = Math.max(0, depth + opens[line] - closes[line]);
  }
  return depth;
}

function commaSpacingEdits(document: vscode.TextDocument, startLine: number, endLine: number): vscode.TextEdit[] {
  const edits: vscode.TextEdit[] = [];
  const text = document.getText();
  const { tokens } = lex(text);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind !== 'punct' || t.text !== ',') {
      continue;
    }
    const pos = document.positionAt(t.end);
    if (pos.line < startLine || pos.line > endLine) {
      continue;
    }
    const after = text[t.end];
    if (after === ' ' || after === '\t' || after === '\n' || after === '\r' || after === undefined) {
      continue;
    }
    edits.push(vscode.TextEdit.insert(pos, ' '));
  }
  return edits;
}

export function formatDocument(document: vscode.TextDocument): vscode.TextEdit[] {
  const edits = computeIndentEdits(document, 0, document.lineCount - 1, 0);
  edits.push(...commaSpacingEdits(document, 0, document.lineCount - 1));
  const last = document.lineAt(document.lineCount - 1);
  if (!last.text.endsWith('\n') && last.text.length > 0) {
    edits.push(vscode.TextEdit.insert(new vscode.Position(document.lineCount - 1, last.text.length), '\n'));
  }
  return edits;
}

export function formatSelection(document: vscode.TextDocument, range: vscode.Range): vscode.TextEdit[] {
  const edits = computeIndentEdits(document, range.start.line, range.end.line, depthAtLine(document, range.start.line));
  edits.push(...commaSpacingEdits(document, range.start.line, range.end.line));
  return edits;
}

export class TinyFormattingProvider
  implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider
{
  provideDocumentFormattingEdits(document: vscode.TextDocument): vscode.TextEdit[] {
    return formatDocument(document);
  }
  provideDocumentRangeFormattingEdits(
    document: vscode.TextDocument,
    range: vscode.Range
  ): vscode.TextEdit[] {
    return formatSelection(document, range);
  }
}
