# Tiny Language — VS Code Extension

A Visual Studio Code extension that turns VS Code into a practical IDE for **[Tiny Language](https://github.com/aimran96/tiny-lang-hindi)**, a Java-based programming language implemented with ANTLR4 that supports Hindi and English keywords and built-in functions.

Files with `.tinylang`, `.english`, and `.hindi` extensions are associated with this extension.

## Prerequisites

- Node.js 20+ (22 LTS recommended)
- Java Runtime Environment (JRE) — required by the Tiny Language interpreter
- Git (for cloning with the `tinylang` submodule)

## Build on a new machine

```powershell
git clone --recurse-submodules <repo-url>
cd tinylang-vscode
npm ci          # reproducible install from package-lock.json (keep it committed)
npm run compile # type-check + emit to dist/
npx vsce package
code --install-extension tinylang-vscode-0.0.1.vsix
```

If you cloned without `--recurse-submodules`:

```powershell
git submodule update --init --recursive
```

For extension development, open the folder in VS Code and press `F5`.

## Usage

- Open any `.tinylang` / `.english` / `.hindi` file for Hindi/English syntax highlighting, snippets, and bracket/comment support.
- **Run Tiny Language File**: command palette, editor title bar, or explorer context menu. Runs the active file via `java -Dfile.encoding=UTF-8 -jar Interpreter.jar <file>` in an integrated terminal (supports stdin, spaces/Unicode paths).
- **Run Tiny Language File with Arguments**: same, plus extra args appended after the filename (also configurable via `tinylang.programArgs`).
- **Start Tiny Language Shell**: launches the interpreter with no file (REPL/shell mode).

## Settings

| Setting | Default | Description |
|---|---|---|
| `tinylang.javaPath` | `java` | Path to the Java executable. |
| `tinylang.jarPath` | `""` (auto-detect) | Path to `Interpreter.jar`. Empty = workspace `tinylang/Interpreter.jar`. |
| `tinylang.programArgs` | `""` | Extra args appended after the filename. |
| `tinylang.workingDirectory` | `""` (file's dir) | Working directory for runs. |

## Troubleshooting

- `Java runtime not found`: install a JRE and/or set `tinylang.javaPath` to the full path of `java`.
- `Interpreter.jar not found`: set `tinylang.jarPath`, or ensure `tinylang/Interpreter.jar` exists (run `git submodule update --init --recursive`).
- `EBADENGINE / unsupported engine` warnings on `npm install`: upgrade Node to 22 LTS.
- Extension runs are blocked in untrusted workspaces by design — trust the workspace and retry. Runs never start without an explicit command.
