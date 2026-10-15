/**
 * Repeatable runs via VS Code tasks (requirements §4).
 *
 * Contributes the `tinylang` task type (`package.json` → `taskDefinitions`):
 *
 * ```json
 * {
 *   "label": "Run main",
 *   "type": "tinylang",
 *   "file": "${workspaceFolder}/main.english",
 *   "args": "",
 *   "problemMatcher": []
 * }
 * ```
 *
 * Execution reuses the same resolution as the Run commands (Java + bundled
 * or configured `Interpreter.jar`), so tasks behave identically. Like the
 * commands, tasks never run automatically — only via Run Task / keybinding.
 */
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import {
  getJavaPath,
  resolveJar,
  resolveWorkingDirectory,
  splitArgs,
  validateJava,
  ensureTrusted,
  usesPowerShell,
} from './commands/run';
import { buildCommandLine } from './commands/shellQuote';

interface TinyTaskDefinition extends vscode.TaskDefinition {
  file: string;
  args?: string;
}

function buildTask(definition: TinyTaskDefinition): vscode.Task | undefined {
  const file = definition.file;
  if (!file || !fs.existsSync(file)) {
    void vscode.window.showErrorMessage(`Tiny Language task: file not found: ${file || '(missing "file")'}`);
    return undefined;
  }
  const javaPath = getJavaPath();
  if (!validateJava(javaPath)) {
    return undefined;
  }
  const jar = resolveJar(path.dirname(file));
  if (!jar) {
    void vscode.window.showErrorMessage(
      'Tiny Language task: Interpreter.jar not found. Set "tinylang.jarPath".'
    );
    return undefined;
  }
  const argv = [javaPath, '-Dfile.encoding=UTF-8', '-jar', jar, file, ...splitArgs(definition.args ?? '')];
  // Single pre-quoted command line: deterministic across shells (see
  // shellQuote.ts), same builder as the Run commands.
  const execution = new vscode.ShellExecution(buildCommandLine(argv, { powershell: usesPowerShell() }), {
    cwd: resolveWorkingDirectory(file),
  });
  return new vscode.Task(
    definition,
    vscode.TaskScope.Workspace,
    `Tiny: ${path.basename(file)}`,
    'tinylang',
    execution
  );
}

export class TinyTaskProvider implements vscode.TaskProvider {
  provideTasks(): vscode.Task[] {
    return []; // No auto-detected tasks; users define them in tasks.json.
  }

  resolveTask(task: vscode.Task): vscode.Task | undefined {
    if (!ensureTrusted()) {
      return undefined;
    }
    const definition = task.definition as TinyTaskDefinition;
    if (definition.type !== 'tinylang') {
      return undefined;
    }
    return buildTask(definition);
  }
}

export function registerTaskProvider(context: vscode.ExtensionContext): void {
  context.subscriptions.push(vscode.tasks.registerTaskProvider('tinylang', new TinyTaskProvider()));
}
