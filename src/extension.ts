import * as vscode from 'vscode';
import { registerRunCommands } from './commands/run';
import {
  refreshDiagnostics,
  forgetDocument,
  indexWorkspaceFiles,
} from './language/diagnostics';
import { TinyCompletionProvider } from './language/completion';
import { TinyHoverProvider } from './language/hover';
import { TinySignatureProvider } from './language/signature';
import {
  TinyDocumentSymbolProvider,
  TinyWorkspaceSymbolProvider,
  TinyDefinitionProvider,
  TinyReferenceProvider,
  TinyRenameProvider,
} from './language/symbols';
import { TinyFormattingProvider } from './language/formatting';
import { TinyCodeActionProvider } from './language/codeActions';
import { TinySemanticTokensProvider, getSemanticLegend } from './language/semanticTokens';

const SELECTOR: vscode.DocumentSelector = { language: 'tinylang' };
const DEBOUNCE_MS = 300;

import { registerTaskProvider } from './tasks';

export function activate(context: vscode.ExtensionContext): void {
  registerRunCommands(context);
  registerTaskProvider(context);

  // Validation: immediate on open/save, debounced on edits (§6).
  const timers = new Map<string, NodeJS.Timeout>();
  const schedule = (document: vscode.TextDocument, immediate: boolean): void => {
    if (document.languageId !== 'tinylang') {
      return;
    }
    const key = document.uri.toString();
    if (immediate) {
      const pending = timers.get(key);
      if (pending) {
        clearTimeout(pending);
        timers.delete(key);
      }
      refreshDiagnostics(document);
      return;
    }
    const pending = timers.get(key);
    if (pending) {
      clearTimeout(pending);
    }
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        refreshDiagnostics(document);
      }, DEBOUNCE_MS)
    );
  };

  for (const document of vscode.workspace.textDocuments) {
    refreshDiagnostics(document);
  }
  void indexWorkspaceFiles().then(() => {
    for (const document of vscode.workspace.textDocuments) {
      refreshDiagnostics(document);
    }
  });

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((d) => schedule(d, true)),
    vscode.workspace.onDidSaveTextDocument((d) => schedule(d, true)),
    vscode.workspace.onDidChangeTextDocument((e) => schedule(e.document, false)),
    vscode.workspace.onDidCloseTextDocument((d) => forgetDocument(d.uri)),

    vscode.languages.registerCompletionItemProvider(SELECTOR, new TinyCompletionProvider()),
    vscode.languages.registerHoverProvider(SELECTOR, new TinyHoverProvider()),
    vscode.languages.registerSignatureHelpProvider(SELECTOR, new TinySignatureProvider(), '(', ','),
    vscode.languages.registerDocumentSymbolProvider(SELECTOR, new TinyDocumentSymbolProvider()),
    vscode.languages.registerWorkspaceSymbolProvider(new TinyWorkspaceSymbolProvider()),
    vscode.languages.registerDefinitionProvider(SELECTOR, new TinyDefinitionProvider()),
    vscode.languages.registerReferenceProvider(SELECTOR, new TinyReferenceProvider()),
    vscode.languages.registerRenameProvider(SELECTOR, new TinyRenameProvider()),

    vscode.languages.registerDocumentFormattingEditProvider(SELECTOR, new TinyFormattingProvider()),
    vscode.languages.registerDocumentRangeFormattingEditProvider(SELECTOR, new TinyFormattingProvider()),
    vscode.languages.registerCodeActionsProvider(SELECTOR, new TinyCodeActionProvider(), {
      providedCodeActionKinds: [vscode.CodeActionKind.QuickFix],
    }),
    vscode.languages.registerDocumentSemanticTokensProvider(SELECTOR, new TinySemanticTokensProvider(), getSemanticLegend()),

    { dispose: () => timers.forEach((t) => clearTimeout(t)) }
  );
}

export function deactivate(): void {
  // No persistent state to clean up (terminals are owned by VS Code).
}
