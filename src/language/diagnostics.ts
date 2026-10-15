/**
 * VS Code diagnostics integration (requirements §6).
 *
 * - Parses with the in-host parser (see parser.ts) and publishes lexer +
 *   parser errors with accurate ranges to Problems/squiggles.
 * - Syntax errors → Error; semantic arity mismatches → Error; calls to
 *   functions unknown *file-locally* → Warning, suppressed entirely when the
 *   name is declared in another workspace file (the Java CLI shares one
 *   symbol table across all files passed on the command line).
 * - Incomplete code is handled by parser recovery; diagnostics are capped.
 */

import * as vscode from 'vscode';
import { ParseResult, parseSource } from './parser';

const collection: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection('tinylang');

/** Parse cache keyed by document URI, invalidated on version change. */
const cache = new Map<string, { version: number; result: ParseResult }>();

/** Workspace-wide function names (for cross-file call resolution). */
const workspaceFunctions = new Map<string, Set<string>>(); // uri -> function names

export function parseDocument(document: vscode.TextDocument): ParseResult {
  const key = document.uri.toString();
  const hit = cache.get(key);
  if (hit && hit.version === document.version) {
    return hit.result;
  }
  const result = parseSource(document.getText());
  cache.set(key, { version: document.version, result });
  const names = new Set(result.functions.map((f) => f.name));
  workspaceFunctions.set(key, names);
  return result;
}

export function forgetDocument(uri: vscode.Uri): void {
  cache.delete(uri.toString());
  workspaceFunctions.delete(uri.toString());
  collection.delete(uri);
}

/** Names declared in workspace files *other than* `exceptUri`. */
export function workspaceKnownFunctions(exceptUri: vscode.Uri): Set<string> {
  const out = new Set<string>();
  for (const [uri, names] of workspaceFunctions) {
    if (uri === exceptUri.toString()) {
      continue;
    }
    for (const name of names) {
      out.add(name);
    }
  }
  return out;
}

/** Best-effort background index of workspace files (open docs are parsed on demand). */
export async function indexWorkspaceFiles(): Promise<void> {
  try {
    const files = await vscode.workspace.findFiles(
      '**/*.{tinylang,english,hindi}',
      '**/node_modules/**',
      200
    );
    const open = new Set(vscode.workspace.textDocuments.map((d) => d.uri.toString()));
    await Promise.all(
      files.map(async (uri) => {
        if (open.has(uri.toString()) || workspaceFunctions.has(uri.toString())) {
          return;
        }
        try {
          const bytes = await vscode.workspace.fs.readFile(uri);
          const text = Buffer.from(bytes).toString('utf8');
          const result = parseSource(text);
          workspaceFunctions.set(uri.toString(), new Set(result.functions.map((f) => f.name)));
        } catch {
          // Ignore unreadable files for indexing.
        }
      })
    );
  } catch {
    // Workspace indexing is best-effort.
  }
}

function toRange(document: vscode.TextDocument, start: number, end: number): vscode.Range {
  const safeStart = Math.max(0, Math.min(start, document.getText().length));
  const safeEnd = Math.max(safeStart, Math.min(end, document.getText().length));
  return new vscode.Range(document.positionAt(safeStart), document.positionAt(safeEnd));
}

export function refreshDiagnostics(document: vscode.TextDocument): void {
  if (document.languageId !== 'tinylang') {
    return;
  }
  const result = parseDocument(document);
  const knownElsewhere = workspaceKnownFunctions(document.uri);
  const vsDiagnostics: vscode.Diagnostic[] = [];
  for (const d of result.diagnostics) {
    if (d.tag === 'unknown-function' && knownElsewhere.has(document.getText().slice(d.start, d.end))) {
      continue; // defined in another workspace file — valid multi-file program.
    }
    const severity =
      d.kind === 'syntax'
        ? vscode.DiagnosticSeverity.Error
        : d.tag === 'unknown-function'
          ? vscode.DiagnosticSeverity.Warning
          : vscode.DiagnosticSeverity.Error;
    const vsd = new vscode.Diagnostic(toRange(document, d.start, d.end), d.message, severity);
    vsd.source = 'tinylang';
    vsDiagnostics.push(vsd);
  }
  collection.set(document.uri, vsDiagnostics);
}

export function clearAllDiagnostics(): void {
  collection.clear();
  cache.clear();
  workspaceFunctions.clear();
}
