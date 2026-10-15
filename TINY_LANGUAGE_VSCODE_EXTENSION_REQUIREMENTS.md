# Tiny Language — VS Code Extension Requirements

## 1. Objective

Build a Visual Studio Code extension that turns VS Code into a practical IDE for **Tiny Language**, a Java-based language implemented with ANTLR4 that supports Hindi and English keywords and built-in functions.

The extension must work with the existing interpreter and grammar rather than inventing new language syntax.

## 2. Inputs and assumptions

- Obtain the ANTLR4 `.g4` lexer/parser grammar, Java interpreter/launcher, example `.tinylang`/`.english`/`.hindi` programs, and test cases.
- Confirm comment syntax, grammar constructs, entry point, shell EOF behavior, runtime invocation, and error format from the repository (file extensions decided as `.tinylang`, `.english`, `.hindi`).
- Known CLI behavior: `tinylang [filename] [filename] [...]`; no filename enters interactive shell mode.
- Java runtime is required by the current interpreter.
- Known built-ins: `println` / `प्रिंटलाइन`, `print` / `प्रिंट`, `assert` / `दावा`, `input` / `इनपुट`, `size` / `माप`.
- All sample code and snippets must be validated against the actual grammar before release.

## 3. Language registration and editing

- [x] Register a unique VS Code language ID, display name, and associate `.tinylang`, `.english`, `.hindi` file extensions (verified against grammar/repo).
- [x] Provide a TextMate grammar for syntax highlighting.
- [x] Highlight English and Hindi keywords, built-in functions, strings, numbers, booleans, identifiers, operators, punctuation, and comments where supported.
- [x] Support Unicode/Hindi identifiers and text correctly; do not assume ASCII-only tokenization.
- [x] Configure line and block comments only where supported by the grammar.
- [x] Configure bracket matching, auto-closing pairs, surrounding pairs, indentation, and folding.
- [x] Add language-aware snippets for verified constructs and built-ins, including Hindi aliases.
- [x] Ensure the extension behaves correctly with light and dark themes without hardcoded token colors.

## 4. Execution and project workflow

- [x] Add **Run Tiny Language File** command and editor title/context-menu action.
- [x] Execute the active file using a configurable interpreter executable or Java JAR/classpath launcher.
- [x] Support paths with spaces and Unicode characters without unsafe shell concatenation. — Extension builds one pre-quoted command line (`src/commands/shellQuote.ts`, shared by Run commands and tasks). Fixed 2026-10-15: PowerShell splits unquoted `-Dfile.encoding=UTF-8` and rejects a quoted exe without `&`, so every argv element is double-quoted and PowerShell lines get the `& ` prefix (shell detected via `vscode.env.shell`); covered by a real-shell regression test in `scripts/smoke.js`. Known interpreter-side limit: Unicode file *paths* fail in the Java 8 interpreter on Windows (ANSI arg decoding), documented in README.
- [x] Show standard output, standard error, and exit status in an integrated terminal.
- [x] Allow console input when the running program requests it.
- [x] Provide **Run with Arguments** support and configurable working directory.
- [x] Add an optional **Start Tiny Language Shell** command.
- [x] Validate interpreter availability and Java runtime prerequisites; report actionable errors.
- [x] Provide a documented task definition or generated `tasks.json` example for repeatable runs. — Done 2026-10-15: `tinylang` task type (`taskDefinitions` + `src/tasks.ts`, same Java/JAR resolution as Run commands) with `tasks.json` example in README.
- [x] Respect VS Code workspace trust and avoid executing untrusted workspace code automatically.

## 5. Autocomplete and editor assistance

- [x] Offer completion for known English and Hindi built-in functions.
- [x] Provide completion details, parameter placeholders, and short documentation.
- [x] Suggest language keywords and valid syntax constructs based on parser context where practical.
- [x] Add signature help for functions and their arguments.
- [x] Add hover documentation for built-ins, symbols, and language constructs.
- [x] Implement document symbols and outline for declarations supported by the grammar.
- [x] Implement workspace symbol search when project indexing is available.
- [x] Implement Go to Definition and Find All References for resolvable symbols.
- [x] Implement Rename Symbol with collision and scope checks.
- [x] Implement semantic highlighting where grammar-only tokenization is insufficient.

## 6. Diagnostics and parsing

- [x] Integrate the ANTLR4 grammar through a compatible parser strategy (e.g., a generated parser in the extension host or a separate language server). — Hand-ported in-host parser (`src/language/lexer.ts`+`parser.ts`) mirroring `Language.g4`; no runtime dependency. Revisit codegen/LSP in Phase 3.
- [x] Report lexer and parser errors with accurate file, line, and column ranges.
- [x] Surface errors in VS Code Problems and inline editor squiggles.
- [x] Debounce validation on edits; revalidate on save and document open.
- [x] Distinguish syntax errors from semantic errors when the interpreter exposes semantic analysis.
- [x] Add semantic checks only when grounded in actual language rules (e.g., undefined variables or incorrect argument counts if applicable). — Builtin arities + user-function name/arity (name+arity key per `SymbolTableBuilder`); no undefined-variable check (interpreter creates variables on assignment, so it would false-positive).
- [x] Handle incomplete code gracefully without crashing or flooding diagnostics.
- [x] Keep Unicode offset conversion accurate between ANTLR and VS Code positions. — Both sides use UTF-16; parser offsets map 1:1 to VS Code positions.

## 7. Formatting and code actions

- [x] Implement Format Document according to documented Tiny Language style rules.
- [x] Implement Format Selection where feasible.
- [x] Provide indentation and whitespace rules based on the actual grammar.
- [x] Add quick fixes for unambiguous, verified errors where safe.
- [x] Avoid rewriting strings, comments, or Hindi text incorrectly.

## 8. Debugging (advanced phase)

- [x] Investigate whether the interpreter can expose execution state and source locations. — Done 2026-10-15: see `docs/debugging-assessment.md`. Verdict: not feasible as-is — synchronous tree walk with no hooks, line-only locations (`ctx.start.getLine()`), implicit call stack. DAP needs interpreter-side hooks (separate repo change).
- [ ] If supported, implement a Debug Adapter Protocol integration. — Blocked on the above; do not add `debuggers`/`breakpoints` contributions until then.
- [ ] Support launch configuration, breakpoints, stepping, call stack, variables, and expression evaluation only to the extent the runtime actually supports them. — Runtime supports none today.
- [ ] If interpreter changes are required, document them separately; do not claim debugger support from syntax parsing alone. — Required changes documented in `docs/debugging-assessment.md`; no debugger support claimed.

## 9. Settings and packaging

- [x] Define settings for interpreter path, JAR path (if relevant), Java path, program arguments, working directory, validation mode, and optional formatting preferences.
- [x] Document installation, setup, running files, shell mode, supported features, and troubleshooting in README.
- [x] Include extension icon, changelog, license, and Marketplace metadata. — Done 2026-10-15 except Marketplace (out of scope, GitHub-only): `LICENSE` (MIT), `CHANGELOG.md`, `repository` URL, placeholder geometric `images/icon.png` (replace with a designed logo anytime).
- [x] Bundle generated grammar assets and runtime dependencies appropriately. — Done 2026-10-15: `Interpreter.jar` ships in the `.vsix` and resolves from the install dir (no checkout needed); Eclipse project excluded via `.vscodeignore` (48 files, ~2.1 MB).
- [x] Build a locally installable `.vsix` using `@vscode/vsce`.
- [ ] Prepare optional publication to the VS Code Marketplace and Open VSX. — Won't do (decided 2026-10-15): GitHub-only distribution; ship the `.vsix` via GitHub releases.
- [x] Set up automated linting, compilation, tests, and packaging in CI. — Partial 2026-10-15: `.github/workflows/ci.yml` (3-OS matrix) + `release.yml` run `npm test` (compile, parser fixtures/negatives, TextMate scope assertions, spaces-path + perf checks), interpreter smoke tests, and packaging; no linter configured.

## 10. Testing and acceptance criteria

- [x] Test highlighting for every grammar token class and all documented Hindi aliases. — Covered by `scripts/smoke.js` scope assertions (comments, strings, ASCII+Devanagari numbers, EN+HI keywords/builtins, booleans, null, operators, separators, brackets) via the same Oniguruma engine VS Code uses.
- [x] Test valid and invalid sample programs from the existing interpreter test suite. — Parser yields 0 diagnostics on all `test.english`/`test.hindi` variants; invalid samples (bad token, missing `;`/`)`/`}`, bad arity, unknown fn) verified via node harness.
- [ ] Test mixed Hindi/English source files, Unicode paths, and non-ASCII strings. — Partial 2026-10-15: mixed files (`test.hindi` has English identifiers/comments/numbers) and non-ASCII strings parse with 0 diagnostics; spaces-paths run end-to-end; Unicode file *paths* are a known interpreter-side failure (see §4 note).
- [x] Test diagnostics for invalid tokens, missing delimiters, and incomplete expressions.
- [ ] Test running a file, passing arguments, reading stdin, and reporting interpreter errors.
- [x] Test editor features with large files and rapid edits for responsiveness. — Done 2026-10-15: generated 6000-line/333 KB file parses with 0 false diagnostics in ~0.5 s; edits debounced at 300 ms, validation immediate on open/save. No test on other OSes beyond CI matrix.
- [ ] Test on Windows, Linux, and macOS where the interpreter is supported. — Partial: CI builds + smoke-tests on all three; interactive features verified on Windows only.
- [x] Verify the extension can install from `.vsix` and run without a development checkout. — Done 2026-10-15: isolated `code --extensions-dir` install succeeds; `tinylang/Interpreter.jar` resolves from the install dir.
- [x] Verify no runtime execution occurs without an explicit user action. — By design: commands, tasks, and shell all require explicit invocation; providers never execute code; untrusted workspaces block runs.

## 11. Implementation phases

### Phase 1 — Minimum viable extension

1. [x] Inspect the source repository, grammar, launcher, and test programs. — Done 2026-10-15: verified `tinylang/Language.g4`, `tinylang.bat` (`java -Dfile.encoding=UTF-8 -jar Interpreter.jar`), `test.english`/`test.hindi`; extensions decided as `.tinylang`, `.english`, `.hindi`.
2. [x] Register the language and implement TextMate syntax highlighting. — Done 2026-10-15: `package.json` registers `tinylang` for `.tinylang`/`.english`/`.hindi`; `syntaxes/tinylang.tmLanguage.json` covers EN+HI keywords/builtins/strings/numbers/comments.
3. [x] Add editor configuration and verified snippets. — Done 2026-10-15: `language-configuration.json` (comments/brackets/indent/wordPattern) + `snippets/tinylang.code-snippets` validated against `Language.g4`/`test.*`.
4. [x] Implement Run File and Start Shell commands with settings. — Done 2026-10-15: `tinylang.runFile`/`runWithArgs`/`startShell` in `src/commands/run.ts`, integrated terminal, Unicode/space-safe quoting, `tinylang.javaPath`/`jarPath`/`programArgs`/`workingDirectory`, trust + Java/JAR validation; `test.english`/`test.hindi` pass via `Interpreter.jar`.
5. [x] Package and test a working `.vsix`. — Done 2026-10-15: `tinylang-vscode-0.0.1.vsix` built via `vsce package`; `tsc` clean, JSON configs valid, `test.english`/`test.hindi` pass.

**Exit criterion:** A user can open a Tiny Language file, see correct Hindi/English highlighting, edit with basic conveniences, and run the program in VS Code.

### Phase 2 — Language intelligence

1. [x] Integrate ANTLR parsing and publish syntax diagnostics. — Done 2026-10-15: `src/language/{lexer,parser,diagnostics}.ts`; 0 diagnostics on all `test.english`/`test.hindi` variants; Problems/squiggles, 300 ms debounce, revalidate on open/save.
2. [x] Implement completion, hover, and signature help. — Done 2026-10-15: `completion.ts`/`hover.ts`/`signature.ts` (callable builtins EN+HI with docs/placeholders; `toString`/`toNumber`/`toBool`/`strLength`/`sqrRoot` marked reserved-uncallable since no parser rule/visitor references them).
3. [x] Add document symbols, definitions, references, and safe rename support. — Done 2026-10-15: `symbols.ts` (block-scope variable resolution per `Runtime.java`, file-global functions per `SymbolTableBuilder`, workspace-wide function refs/rename for multi-file CLI runs, collision checks) + `semanticTokens.ts`.
4. [x] Add semantic diagnostics supported by the interpreter's rules. — Done 2026-10-15: builtin arity (`println 0-1`/`print 1`/`assert 1`/`size 1`/`input 0-1`), user-function unknown-name (Warning, suppressed if declared in another workspace file) and arity mismatch.

**Exit criterion:** VS Code can explain common syntax errors and provide useful code navigation and completions.

### Phase 3 — IDE polish

1. [x] Add formatting, folding improvements, and quick fixes. — Formatting + quick fixes done in Phase 2 (`formatting.ts`, `codeActions.ts`); folding covered by bracket configuration (all blocks are brace-delimited), no custom provider needed.
2. Optimize performance and expand cross-platform tests. — CI matrix (Win/Linux/macOS) added 2026-10-15; large-file/rapid-edit and install-from-vsix testing still open.
3. Improve documentation, CI, and publishing workflows. — Partial 2026-10-15: README/tasks example, CHANGELOG, LICENSE, CI + tag-triggered GitHub-release workflow (`.github/workflows/release.yml` attaches the `.vsix`) done; icon open (Marketplace/Open VSX out of scope: GitHub-only).
4. [x] Assess and, if feasible, implement runtime debugging support. — Assessed 2026-10-15 (`docs/debugging-assessment.md`): not feasible without interpreter-side hooks; deferred, no debugger support claimed.

**Exit criterion:** The extension is maintainable, documented, and ready for broader distribution.

## 12. Proposed repository structure

```text
tinylang-vscode/
├── package.json
├── tsconfig.json
├── README.md
├── CHANGELOG.md
├── LICENSE
├── language-configuration.json
├── syntaxes/
│   └── tinylang.tmLanguage.json
├── snippets/
│   └── tinylang.code-snippets
├── src/
│   ├── extension.ts
│   ├── commands/
│   │   └── run.ts
│   ├── language/
│   │   ├── completion.ts
│   │   ├── diagnostics.ts
│   │   ├── hover.ts
│   │   └── symbols.ts
│   └── test/
├── grammars/
│   └── README.md
└── .vscode/
    └── launch.json
```

The structure is provisional: parser generation, language-server isolation, and debugging may require additional packages or directories.

## 13. Non-goals and constraints

- Do not redesign the Tiny Language syntax as part of the editor extension.
- Do not treat the TextMate grammar as a complete parser or semantic analyzer.
- Do not promise debugging until the Java runtime supports the required instrumentation.
- Do not bundle a Java runtime without explicitly deciding on licensing, size, and distribution requirements.
- Do not infer source extensions, comment delimiters, or language constructs without inspecting the grammar.
- Do not publish to the VS Code Marketplace or Open VSX; distribution is GitHub-only (decided 2026-10-15).
