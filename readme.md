# Tiny Language — VS Code Extension

A Visual Studio Code extension that turns VS Code into a practical IDE for **[Tiny Language](https://github.com/aimran96/tiny-lang-hindi)**, a Java-based programming language implemented with ANTLR4 that supports Hindi and English keywords and built-in functions.

Files with `.tinylang`, `.english`, and `.hindi` extensions are associated with this extension.

## Install and run

You need VS Code and a Java Runtime Environment (`java -version` should work).

1. Get the `.vsix` — download it from the GitHub Releases page, or build it yourself (see below).
2. Install it:
   ```powershell
   code --install-extension tinylang-vscode-0.1.0.vsix
   ```
   (Alternatively: Extensions view Ctrl+Shift+X → `...` menu → *Install from VSIX* → pick the file. Reload VS Code if prompted.)
3. Open any `.tinylang`, `.english`, or `.hindi` file.
4. Run it — any of these:
   - the ▶ run button in the editor title bar,
   - Ctrl+Shift+P → **Run Tiny Language File**,
   - right-click the file in the Explorer → **Run Tiny Language File**,
   - Ctrl+Shift+P → **Run Tiny Language File with Arguments** to pass extra arguments.
5. Output appears in the *Tiny Language* integrated terminal, which also accepts keyboard input when the program calls `input()`.
6. For interactive use, Ctrl+Shift+P → **Start Tiny Language Shell** (REPL mode; finish with Ctrl+Z on Windows or Ctrl+D on Mac).

Tip: keep file *paths* to ASCII characters — Hindi code, identifiers, and strings are fully supported, but the Java 8 interpreter cannot open Unicode file paths on Windows.

## Prerequisites (building from source)

- Node.js 20+ (22 LTS recommended)
- Java Runtime Environment (JRE) — required by the Tiny Language interpreter
- Git (for cloning with the `tinylang` submodule)

## Build on a new machine

```powershell
git clone --recurse-submodules https://github.com/aimran96/tiny-lang-vscode
cd tiny-lang-vscode
npm ci          # reproducible install from package-lock.json (keep it committed)
npm run compile # type-check + emit to dist/
npx vsce package
code --install-extension tinylang-vscode-0.1.0.vsix
```

If you cloned without `--recurse-submodules`:

```powershell
git submodule update --init --recursive
```

For extension development, open the folder in VS Code and press `F5`.

## Usage

- Open any `.tinylang` / `.english` / `.hindi` file for Hindi/English syntax highlighting, snippets, and bracket/comment support.
- **Run Tiny Language File**: command palette, editor title bar, or explorer context menu. Runs the active file via `java -Dfile.encoding=UTF-8 -jar Interpreter.jar <file>` in an integrated terminal (supports stdin and paths with spaces).
- **Run Tiny Language File with Arguments**: same, plus extra args appended after the filename (also configurable via `tinylang.programArgs`).
- **Start Tiny Language Shell**: launches the interpreter with no file (REPL/shell mode).

## Editor intelligence (Phase 2)

- Diagnostics in Problems/squiggles: syntax errors (Error) plus grounded semantic checks — builtin arities (`println 0–1`, `print`/`assert`/`size` 1, `input` 0–1) and user-function name/arity (name+arity key, as in the interpreter). Unknown-function is a Warning, suppressed when declared in another workspace file (multi-file CLI runs share one symbol table).
- Completion, hover, and signature help for English+Hindi builtins and keywords, plus workspace user functions.
- Document/workspace symbols, Go to Definition, Find All References, scope-aware Rename with collision checks, and semantic highlighting.
- Format Document/Selection (brace reindent, comma spacing, trailing-whitespace trim — strings/comments/Hindi untouched) and Quick Fixes inserting missing `;`/`)`/`]`/`}`.
- Note: `toString`/`toNumber`/`toBool`/`strLength`/`sqrRoot` are lexer tokens only — no parser rule or interpreter visitor uses them, so they are shown as reserved/uncallable.

## Settings

| Setting | Default | Description |
|---|---|---|
| `tinylang.javaPath` | `java` | Path to the Java executable. |
| `tinylang.jarPath` | `""` (auto-detect) | Path to `Interpreter.jar`. Empty = extension-bundled JAR, then workspace `tinylang/Interpreter.jar`. |
| `tinylang.programArgs` | `""` | Extra args appended after the filename. |
| `tinylang.workingDirectory` | `""` (file's dir) | Working directory for runs. |

## Repeatable runs with tasks

Define tasks in `.vscode/tasks.json` (the `tinylang` task type). Run via **Tasks: Run Task** — never automatically:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Run main.english",
      "type": "tinylang",
      "file": "${workspaceFolder}/main.english",
      "args": "",
      "problemMatcher": []
    }
  ]
}

## Troubleshooting

- `Java runtime not found`: install a JRE and/or set `tinylang.javaPath` to the full path of `java`.
- `Interpreter.jar not found`: set `tinylang.jarPath`, or ensure `tinylang/Interpreter.jar` exists (run `git submodule update --init --recursive`). The published `.vsix` bundles the JAR, so this only affects source checkouts without the submodule.
- File paths with spaces work; Unicode file *contents*, identifiers, and strings work. Unicode file *paths* fail inside the Java 8 interpreter on Windows (JVM decodes arguments with the ANSI code page — `InvalidPathException`), independent of this extension. Prefer ASCII paths for now.
- `EBADENGINE / unsupported engine` warnings on `npm install`: upgrade Node to 22 LTS.
- Extension runs are blocked in untrusted workspaces by design — trust the workspace and retry. Runs never start without an explicit command.
