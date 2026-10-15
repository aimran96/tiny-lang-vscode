import * as vscode from 'vscode';
import { registerRunCommands } from './commands/run';

export function activate(context: vscode.ExtensionContext): void {
  registerRunCommands(context);
}

export function deactivate(): void {
  // No persistent state to clean up (terminals are owned by VS Code).
}
