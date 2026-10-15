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
- [x] Support paths with spaces and Unicode characters without unsafe shell concatenation.
- [x] Show standard output, standard error, and exit status in an integrated terminal.
- [x] Allow console input when the running program requests it.
- [x] Provide **Run with Arguments** support and configurable working directory.
- [x] Add an optional **Start Tiny Language Shell** command.
- [x] Validate interpreter availability and Java runtime prerequisites; report actionable errors.
- [ ] Provide a documented task definition or generated `tasks.json` example for repeatable runs.
- [x] Respect VS Code workspace trust and avoid executing untrusted workspace code automatically.

## 5. Autocomplete and editor assistance

- [ ] Offer completion for known English and Hindi built-in functions.
- [ ] Provide completion details, parameter placeholders, and short documentation.
- [ ] Suggest language keywords and valid syntax constructs based on parser context where practical.
- [ ] Add signature help for functions and their arguments.
- [ ] Add hover documentation for built-ins, symbols, and language constructs.
- [ ] Implement document symbols and outline for declarations supported by the grammar.
- [ ] Implement workspace symbol search when project indexing is available.
- [ ] Implement Go to Definition and Find All References for resolvable symbols.
- [ ] Implement Rename Symbol with collision and scope checks.
- [ ] Implement semantic highlighting where grammar-only tokenization is insufficient.

## 6. Diagnostics and parsing

- [ ] Integrate the ANTLR4 grammar through a compatible parser strategy (e.g., a generated parser in the extension host or a separate language server).
- [ ] Report lexer and parser errors with accurate file, line, and column ranges.
- [ ] Surface errors in VS Code Problems and inline editor squiggles.
- [ ] Debounce validation on edits; revalidate on save and document open.
- [ ] Distinguish syntax errors from semantic errors when the interpreter exposes semantic analysis.
- [ ] Add semantic checks only when grounded in actual language rules (e.g., undefined variables or incorrect argument counts if applicable).
- [ ] Handle incomplete code gracefully without crashing or flooding diagnostics.
- [ ] Keep Unicode offset conversion accurate between ANTLR and VS Code positions.

## 7. Formatting and code actions

- [ ] Implement Format Document according to documented Tiny Language style rules.
- [ ] Implement Format Selection where feasible.
- [ ] Provide indentation and whitespace rules based on the actual grammar.
- [ ] Add quick fixes for unambiguous, verified errors where safe.
- [ ] Avoid rewriting strings, comments, or Hindi text incorrectly.

## 8. Debugging (advanced phase)

- [ ] Investigate whether the interpreter can expose execution state and source locations.
- [ ] If supported, implement a Debug Adapter Protocol integration.
- [ ] Support launch configuration, breakpoints, stepping, call stack, variables, and expression evaluation only to the extent the runtime actually supports them.
- [ ] If interpreter changes are required, document them separately; do not claim debugger support from syntax parsing alone.

## 9. Settings and packaging

- [x] Define settings for interpreter path, JAR path (if relevant), Java path, program arguments, working directory, validation mode, and optional formatting preferences.
- [ ] Document installation, setup, running files, shell mode, supported features, and troubleshooting in README.
- [ ] Include extension icon, changelog, license, and Marketplace metadata.
- [ ] Bundle generated grammar assets and runtime dependencies appropriately.
- [x] Build a locally installable `.vsix` using `@vscode/vsce`.
- [ ] Prepare optional publication to the VS Code Marketplace and Open VSX.
- [ ] Set up automated linting, compilation, tests, and packaging in CI.

## 10. Testing and acceptance criteria

- [ ] Test highlighting for every grammar token class and all documented Hindi aliases.
- [ ] Test valid and invalid sample programs from the existing interpreter test suite.
- [ ] Test mixed Hindi/English source files, Unicode paths, and non-ASCII strings.
- [ ] Test diagnostics for invalid tokens, missing delimiters, and incomplete expressions.
- [ ] Test running a file, passing arguments, reading stdin, and reporting interpreter errors.
- [ ] Test editor features with large files and rapid edits for responsiveness.
- [ ] Test on Windows, Linux, and macOS where the interpreter is supported.
- [ ] Verify the extension can install from `.vsix` and run without a development checkout.
- [ ] Verify no runtime execution occurs without an explicit user action.

## 11. Implementation phases

### Phase 1 — Minimum viable extension

1. [x] Inspect the source repository, grammar, launcher, and test programs. — Done 2026-10-15: verified `tinylang/Language.g4`, `tinylang.bat` (`java -Dfile.encoding=UTF-8 -jar Interpreter.jar`), `test.english`/`test.hindi`; extensions decided as `.tinylang`, `.english`, `.hindi`.
2. [x] Register the language and implement TextMate syntax highlighting. — Done 2026-10-15: `package.json` registers `tinylang` for `.tinylang`/`.english`/`.hindi`; `syntaxes/tinylang.tmLanguage.json` covers EN+HI keywords/builtins/strings/numbers/comments.
3. [x] Add editor configuration and verified snippets. — Done 2026-10-15: `language-configuration.json` (comments/brackets/indent/wordPattern) + `snippets/tinylang.code-snippets` validated against `Language.g4`/`test.*`.
4. [x] Implement Run File and Start Shell commands with settings. — Done 2026-10-15: `tinylang.runFile`/`runWithArgs`/`startShell` in `src/commands/run.ts`, integrated terminal, Unicode/space-safe quoting, `tinylang.javaPath`/`jarPath`/`programArgs`/`workingDirectory`, trust + Java/JAR validation; `test.english`/`test.hindi` pass via `Interpreter.jar`.
5. [x] Package and test a working `.vsix`. — Done 2026-10-15: `tinylang-vscode-0.0.1.vsix` built via `vsce package`; `tsc` clean, JSON configs valid, `test.english`/`test.hindi` pass.

**Exit criterion:** A user can open a Tiny Language file, see correct Hindi/English highlighting, edit with basic conveniences, and run the program in VS Code.

### Phase 2 — Language intelligence

1. Integrate ANTLR parsing and publish syntax diagnostics.
2. Implement completion, hover, and signature help.
3. Add document symbols, definitions, references, and safe rename support.
4. Add semantic diagnostics supported by the interpreter's rules.

**Exit criterion:** VS Code can explain common syntax errors and provide useful code navigation and completions.

### Phase 3 — IDE polish

1. Add formatting, folding improvements, and quick fixes.
2. Optimize performance and expand cross-platform tests.
3. Improve documentation, CI, and publishing workflows.
4. Assess and, if feasible, implement runtime debugging support.

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
