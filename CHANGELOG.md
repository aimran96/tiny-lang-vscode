# Changelog

## 0.1.0 — 2026-10-15

- Language intelligence: in-host parser with Problems diagnostics (syntax + grounded semantic checks), completion/hover/signature help (English + Hindi), document/workspace symbols, go-to-definition, references, scope-aware rename, semantic highlighting.
- Formatting (document/selection) and quick fixes for missing `;`/`)`/`]`/`}`.
- Repeatable runs via the `tinylang` task type for `tasks.json`.
- `Interpreter.jar` resolves from the installed extension, so the `.vsix` works without a source checkout.
- Real test suite (`npm test`): parser fixtures/negatives, TextMate scope assertions, spaces-path interpreter run, large-file perf budget. CI (Win/Linux/macOS) + tag-triggered GitHub-release workflow.
- Packaging metadata: MIT `LICENSE`, placeholder `images/icon.png`, debugging assessment (`docs/debugging-assessment.md` — DAP deferred, interpreter hooks required).
- Fixed: Run commands and tasks send one pre-quoted command line (plus `& ` prefix on PowerShell, detected via `vscode.env.shell`) — PowerShell split the unquoted `-Dfile.encoding=UTF-8` (`Could not find or load main class .encoding=UTF-8`) and rejects a quoted exe without `&`. Regression-tested through a real shell.

## 0.0.1 — 2026-10-15

- Minimum viable extension: language registration for `.tinylang`/`.english`/`.hindi`, TextMate highlighting, editor configuration, snippets, Run File / Run with Arguments / Start Shell commands.
