"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRunCommands = registerRunCommands;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const vscode = __importStar(require("vscode"));
function getConfig() {
    return vscode.workspace.getConfiguration('tinylang');
}
function getJavaPath() {
    const configured = getConfig().get('javaPath', 'java').trim();
    return configured.length > 0 ? configured : 'java';
}
function candidateJarPaths() {
    const configured = (getConfig().get('jarPath', '') ?? '').trim();
    const out = [];
    if (configured.length > 0) {
        out.push(configured);
    }
    const folders = vscode.workspace.workspaceFolders?.map((f) => f.uri.fsPath) ?? [];
    // Bundled/checked-out interpreter next to the extension workspace.
    for (const folder of folders) {
        out.push(path.join(folder, 'tinylang', 'Interpreter.jar'));
    }
    // Fallback: Interpreter.jar beside the opened file's workspace is handled by caller;
    // keep a relative hint for error messages.
    return out;
}
function resolveJar(activeFileDir) {
    for (const candidate of candidateJarPaths()) {
        if (candidate && fs.existsSync(candidate)) {
            return candidate;
        }
    }
    if (activeFileDir) {
        // Walk up from the active file looking for tinylang/Interpreter.jar (monorepo checkout).
        let dir = activeFileDir;
        while (dir && !fs.existsSync(path.join(dir, 'tinylang', 'Interpreter.jar'))) {
            const parent = path.dirname(dir);
            if (parent === dir) {
                dir = undefined;
                break;
            }
            dir = parent;
        }
        if (dir) {
            return path.join(dir, 'tinylang', 'Interpreter.jar');
        }
    }
    return undefined;
}
function resolveWorkingDirectory(activeFile) {
    const configured = (getConfig().get('workingDirectory', '') ?? '').trim();
    if (configured.length > 0) {
        return configured;
    }
    if (activeFile) {
        return path.dirname(activeFile);
    }
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}
/** Quote one argv element for `terminal.sendText` without unsafe shell concatenation. */
function quoteForTerminal(arg) {
    if (arg.length === 0) {
        return '""';
    }
    if (!/[\s"`'$&|<>^()]/.test(arg)) {
        return arg;
    }
    // Prefer double quotes; escape embedded double quotes, backslashes, and `$`/backtick.
    return `"${arg.replace(/(["\\$`])/g, '\\$1')}"`;
}
function splitArgs(raw) {
    // Minimal space-separated split honoring double quotes (program args are simple values).
    const out = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if (!inQuotes && /\s/.test(ch)) {
            if (current.length > 0) {
                out.push(current);
                current = '';
            }
            continue;
        }
        current += ch;
    }
    if (current.length > 0) {
        out.push(current);
    }
    return out;
}
function ensureTrusted() {
    if (!vscode.workspace.isTrusted) {
        void vscode.window.showWarningMessage('Tiny Language run blocked: workspace is not trusted. Trust the workspace and try again.');
        return false;
    }
    return true;
}
function validateJava(javaPath) {
    const result = (0, child_process_1.spawnSync)(javaPath, ['-version'], { encoding: 'utf8' });
    if (result.error || result.status !== 0) {
        void vscode.window.showErrorMessage(`Tiny Language: Java runtime not found at "${javaPath}". Install a JRE and/or set "tinylang.javaPath".`);
        return false;
    }
    return true;
}
function getTargetFile(uri) {
    if (uri?.fsPath) {
        return uri.fsPath;
    }
    const active = vscode.window.activeTextEditor?.document;
    if (active && active.languageId === 'tinylang') {
        return active.fileName;
    }
    if (active && /\.(tinylang|english|hindi)$/i.test(active.fileName)) {
        return active.fileName;
    }
    return undefined;
}
function getOrCreateTerminal(cwd) {
    const existing = vscode.window.terminals.find((t) => t.name === 'Tiny Language');
    if (existing) {
        return existing;
    }
    return vscode.window.createTerminal({ name: 'Tiny Language', cwd });
}
async function runFileCommand(uri, extraArgs) {
    if (!ensureTrusted()) {
        return;
    }
    const file = getTargetFile(uri);
    if (!file) {
        void vscode.window.showWarningMessage('Tiny Language: open a .tinylang/.english/.hindi file first.');
        return;
    }
    if (!fs.existsSync(file)) {
        void vscode.window.showErrorMessage(`Tiny Language: file not found: ${file}`);
        return;
    }
    const javaPath = getJavaPath();
    if (!validateJava(javaPath)) {
        return;
    }
    const jar = resolveJar(path.dirname(file));
    if (!jar) {
        void vscode.window.showErrorMessage('Tiny Language: Interpreter.jar not found. Set "tinylang.jarPath" or keep tinylang/Interpreter.jar in the workspace.');
        return;
    }
    const cwd = resolveWorkingDirectory(file);
    const terminal = getOrCreateTerminal(cwd);
    terminal.show(true);
    const configuredArgs = splitArgs(getConfig().get('programArgs', '') ?? '');
    const command = [javaPath, '-Dfile.encoding=UTF-8', '-jar', jar, file, ...configuredArgs];
    if (extraArgs && extraArgs.trim().length > 0) {
        command.push(...splitArgs(extraArgs));
    }
    terminal.sendText(command.map(quoteForTerminal).join(' '));
}
function registerRunCommands(context) {
    context.subscriptions.push(vscode.commands.registerCommand('tinylang.runFile', (uri) => runFileCommand(uri)), vscode.commands.registerCommand('tinylang.runWithArgs', async (uri) => {
        const args = await vscode.window.showInputBox({
            title: 'Run Tiny Language File with Arguments',
            prompt: 'Extra arguments appended after the filename',
            placeHolder: 'arg1 arg2 ...',
        });
        if (args === undefined) {
            return; // cancelled
        }
        await runFileCommand(uri, args);
    }), vscode.commands.registerCommand('tinylang.startShell', async () => {
        if (!ensureTrusted()) {
            return;
        }
        const javaPath = getJavaPath();
        if (!validateJava(javaPath)) {
            return;
        }
        const activeFile = vscode.window.activeTextEditor?.document.fileName;
        const jar = resolveJar(activeFile ? path.dirname(activeFile) : undefined);
        if (!jar) {
            void vscode.window.showErrorMessage('Tiny Language: Interpreter.jar not found. Set "tinylang.jarPath" or keep tinylang/Interpreter.jar in the workspace.');
            return;
        }
        const cwd = resolveWorkingDirectory(activeFile);
        const terminal = getOrCreateTerminal(cwd);
        terminal.show(true);
        terminal.sendText([javaPath, '-Dfile.encoding=UTF-8', '-jar', jar].map(quoteForTerminal).join(' '));
    }));
}
//# sourceMappingURL=run.js.map