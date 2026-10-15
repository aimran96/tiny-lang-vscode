/** Completion for builtins (EN+HI), keywords, and user functions (requirements §5). */
import * as vscode from 'vscode';
import { BUILTINS, KEYWORDS } from './builtins';
import { parseDocument, workspaceKnownFunctions } from './diagnostics';

function functionNames(document: vscode.TextDocument): { name: string; arity: number }[] {
  const result = parseDocument(document);
  return result.functions.map((f) => ({ name: f.name, arity: f.arity }));
}

export class TinyCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    // Suppress completions inside strings/comments (best-effort scan of line prefix).
    const line = document.lineAt(position.line).text.slice(0, position.character);
    const trimmed = line.trimStart();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
      return [];
    }
    const quotes = (line.match(/["']/g) ?? []).length;
    if (quotes % 2 === 1) {
      return [];
    }

    for (const b of BUILTINS) {
      for (const label of b.hindi ? [b.name, b.hindi] : [b.name]) {
        const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Function);
        item.detail = b.callable
          ? `${b.name}${b.hindi ? ` / ${b.hindi}` : ''}(${b.params.map((p) => (p.optional ? `[${p.name}]` : p.name)).join(', ')})`
          : `${b.name} (reserved — not callable in current grammar)`;
        item.documentation = new vscode.MarkdownString(b.doc);
        if (b.callable) {
          item.insertText = new vscode.SnippetString(`${b.snippet};`);
        }
        items.push(item);
      }
    }

    for (const kw of KEYWORDS) {
      for (const label of kw.names) {
        const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.Keyword);
        item.detail = 'Tiny Language keyword';
        item.documentation = new vscode.MarkdownString(kw.doc);
        items.push(item);
      }
    }

    // User functions: file-local + workspace-known (dedupe, show arity).
    const seen = new Set<string>();
    for (const fn of functionNames(document)) {
      if (seen.has(`${fn.name}/${fn.arity}`)) {
        continue;
      }
      seen.add(`${fn.name}/${fn.arity}`);
      const item = new vscode.CompletionItem(fn.name, vscode.CompletionItemKind.Function);
      item.detail = `${fn.name}(${fn.arity === 0 ? '' : `${fn.arity} param(s)`}) — this file`;
      item.insertText = new vscode.SnippetString(
        fn.arity === 0 ? `${fn.name}()` : `${fn.name}(${Array.from({ length: fn.arity }, (_, i) => `\${${i + 1}:arg${i + 1}}`).join(', ')})`
      );
      items.push(item);
    }
    for (const name of workspaceKnownFunctions(document.uri)) {
      if ([...seen].some((s) => s.startsWith(`${name}/`))) {
        continue;
      }
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
      item.detail = `${name}(…) — workspace`;
      items.push(item);
    }

    return items;
  }
}
