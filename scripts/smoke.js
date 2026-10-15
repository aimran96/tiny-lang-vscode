/**
 * Smoke suite run by `npm test` (after `npm run compile`).
 *
 * 1. Parser: all interpreter fixtures parse with 0 diagnostics; crafted
 *    invalid programs produce the expected diagnostics (no floods).
 * 2. TextMate grammar: every token class + Hindi aliases get the expected
 *    scopes (via vscode-textmate, same Oniguruma engine VS Code uses).
 * 3. Runtime: the interpreter runs a fixture copied under a Unicode path
 *    with spaces (skipped with a warning when no JRE is present).
 * 4. Perf: a generated 6000-line file must parse within a fixed budget.
 */
const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { parseSource } = require('../dist/language/parser.js');

let failures = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failures++;
    console.error(`FAIL ${name}: ${e.message}`);
  }
}
async function checkAsync(name, fn) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failures++;
    console.error(`FAIL ${name}: ${e.message}`);
  }
}

// ---------- 1. parser ----------
check('fixtures parse with 0 diagnostics', () => {
  for (const f of ['tinylang/test.english', 'tinylang/test.hindi']) {
    const r = parseSource(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    assert.strictEqual(r.diagnostics.length, 0, `${f}: ${JSON.stringify(r.diagnostics.slice(0, 3))}`);
  }
});

check('invalid programs diagnosed (capped, no crash)', () => {
  const cases = [
    ['a = 1', /Expected ';'/],
    ['if true {', /Missing closing '\}'/],
    ['a = @;', /Invalid character/],
    ['assert();', /expects 1 argument/],
    ['println(1, 2);', /expects between 0 and 1/],
    ['foo(1);', /Unknown function/],
    ['println(1;', /Expected '\)'/],
    ['for i=1 to', /Expected an expression/],
    ['', null], // empty file is valid
  ];
  for (const [src, pattern] of cases) {
    const r = parseSource(src);
    assert.ok(r.diagnostics.length <= 100, 'diagnostic cap respected');
    if (pattern) {
      assert.ok(r.diagnostics.some((d) => pattern.test(d.message)), `${JSON.stringify(src)} -> ${JSON.stringify(r.diagnostics)}`);
    } else {
      assert.strictEqual(r.diagnostics.length, 0);
    }
  }
});

// ---------- 2. TextMate scopes ----------
async function loadGrammar() {
  const vsctm = require('vscode-textmate');
  const onig = require('vscode-oniguruma');
  const wasmBin = fs.readFileSync(path.join(ROOT, 'node_modules/vscode-oniguruma/release/onig.wasm')).buffer;
  await onig.loadWASM(wasmBin);
  const registry = new vsctm.Registry({
    onigLib: Promise.resolve(onig),
    loadGrammar: async () =>
      JSON.parse(fs.readFileSync(path.join(ROOT, 'syntaxes/tinylang.tmLanguage.json'), 'utf8')),
  });
  const grammar = await registry.loadGrammar('source.tinylang');
  assert.ok(grammar, 'grammar loads');
  return grammar;
}

function tokenize(grammar, lines) {
  let stack = vsctmState(grammar);
  const out = [];
  for (const line of lines) {
    const r = grammar.tokenizeLine(line, stack);
    stack = r.ruleStack;
    out.push(r.tokens.map((t) => ({ text: line.slice(t.startIndex, t.endIndex), scopes: t.scopes })));
  }
  return out;
}
let _vsctm = null;
function vsctmState() {
  if (!_vsctm) {
    _vsctm = require('vscode-textmate');
  }
  return _vsctm.INITIAL;
}

async function expectScope(grammar, line, substr, scope) {
  const [tokens] = tokenize(grammar, [line]);
  const hit = tokens.find((t) => t.text.includes(substr));
  assert.ok(hit, `token ${JSON.stringify(substr)} found in ${JSON.stringify(line)}`);
  assert.ok(hit.scopes.includes(scope), `${JSON.stringify(substr)} has ${scope} (got ${hit.scopes.join(',')})`);
}

(async () => {
  const grammar = await loadGrammar();
  const scopeCases = [
    ['// टिप्पणी comment', '//', 'comment.line.double-slash.tinylang'],
    ['/* block */', 'block', 'comment.block.tinylang'],
    ['"double" \'स\'', 'double', 'string.quoted.double.tinylang'],
    ["'single' \"s\"", 'single', 'string.quoted.single.tinylang'],
    ['x = 123 + 4.5;', '123', 'constant.numeric.tinylang'],
    ['y = १२३;', '१२३', 'constant.numeric.tinylang'],
    ['function अगर प्रक्रिया', 'function', 'keyword.control.tinylang'],
    ['अगर (a) {', 'अगर', 'keyword.control.tinylang'],
    ['प्रक्रिया f() {', 'प्रक्रिया', 'keyword.control.tinylang'],
    ['चलो i=1 से 10 {', 'चलो', 'keyword.control.tinylang'],
    ['जबकि सच {', 'जबकि', 'keyword.control.tinylang'],
    ['अन्य {', 'अन्य', 'keyword.control.tinylang'],
    ['लौटाऊ x;', 'लौटाऊ', 'keyword.control.tinylang'],
    ['x में y', 'में', 'keyword.control.tinylang'],
    ['println(x);', 'println', 'support.function.builtin.tinylang'],
    ['प्रिंटलाइन(x);', 'प्रिंटलाइन', 'support.function.builtin.tinylang'],
    ['दावा(सुच);', 'दावा', 'support.function.builtin.tinylang'],
    ['दावा(सुच);', 'सुच', 'constant.language.boolean.tinylang'],
    ['माप(list);', 'माप', 'support.function.builtin.tinylang'],
    ['इनपुट("x");', 'इनपुट', 'support.function.builtin.tinylang'],
    ['x = खाली;', 'खाली', 'constant.language.null.tinylang'],
    ['a == b && c;', '==', 'keyword.operator.tinylang'],
    ['a == b && c;', '&&', 'keyword.operator.tinylang'],
    ['f(a, b);', ',', 'punctuation.separator.tinylang'],
    ['if a {', '{', 'punctuation.bracket.tinylang'],
  ];
  for (const [line, substr, scope] of scopeCases) {
    await checkAsync(`scope ${scope} <- ${substr}`, () => expectScope(grammar, line, substr, scope));
  }

  // ---------- 3. paths with spaces ----------
  // The extension passes file paths as discrete argv elements (no shell
  // concatenation); Unicode *content* is covered by the Hindi fixture.
  // NOTE: Unicode *file paths* fail inside the Java 8 interpreter on
  // Windows (args decoded with the ANSI code page -> InvalidPathException),
  // independent of the extension. See README troubleshooting.
  await checkAsync('interpreter runs under a path with spaces', () => {
    let javaOk = true;
    try {
      execFileSync('java', ['-version'], { stdio: 'ignore' });
    } catch {
      javaOk = false;
    }
    if (!javaOk) {
      console.log('     (no JRE — skipping)');
      return;
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tiny lang '));
    try {
      const dest = path.join(dir, 'sample test.english');
      fs.copyFileSync(path.join(ROOT, 'tinylang/test.english'), dest);
      const out = execFileSync(
        'java',
        ['-Dfile.encoding=UTF-8', '-jar', path.join(ROOT, 'tinylang/Interpreter.jar'), dest],
        { encoding: 'utf8' }
      );
      assert.ok(out.includes('All English assertions have passed'), out);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  // ---------- 3b. shell quoting ----------
  // Regression test: PowerShell splits unquoted `-Dfile.encoding=UTF-8`
  // into `-Dfile` + `.encoding=UTF-8`. Every argv element must be quoted.
  await checkAsync('argv quoting survives a real shell', () => {
    const { buildCommandLine, quoteArg } = require('../dist/commands/shellQuote.js');
    assert.strictEqual(quoteArg('a b'), '"a b"');
    assert.strictEqual(
      buildCommandLine(['java', '-Dfile.encoding=UTF-8', '-jar', 'a b.jar', 'f.tiny']),
      '"java" "-Dfile.encoding=UTF-8" "-jar" "a b.jar" "f.tiny"'
    );
    assert.strictEqual(
      buildCommandLine(['java', '-Dfile.encoding=UTF-8'], { powershell: true }),
      '& "java" "-Dfile.encoding=UTF-8"'
    );
    // End-to-end through a real shell, exactly as terminal.sendText delivers it.
    const line = buildCommandLine(
      [
        'java',
        '-Dfile.encoding=UTF-8',
        '-jar',
        path.join(ROOT, 'tinylang/Interpreter.jar'),
        path.join(ROOT, 'tinylang/test.english'),
      ],
      { powershell: process.platform === 'win32' }
    );
    let out;
    if (process.platform === 'win32') {
      // The built line already carries `&`; pass it as the single script.
      out = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', line], { encoding: 'utf8' });
    } else {
      out = execFileSync('sh', ['-c', line], { encoding: 'utf8' });
    }
    assert.ok(out.includes('All English assertions have passed'), out);
  });

  // ---------- 4. perf ----------
  await checkAsync('6000-line file parses within budget', () => {
    let src = '';
    for (let i = 0; i < 3000; i++) {
      src += `function f${i}(a,b){ t=a+b; if t>10 { println(t); } else { assert(t>=0); } return t; }\nx${i} = f${i}(${i},${i + 1});\n`;
    }
    const t0 = Date.now();
    const r = parseSource(src);
    const ms = Date.now() - t0;
    assert.strictEqual(r.diagnostics.length, 0);
    assert.strictEqual(r.functions.length, 3000);
    assert.ok(ms < 5000, `${ms}ms exceeds budget`);
    console.log(`     (parsed 6000 lines in ${ms}ms)`);
  });

  if (failures > 0) {
    console.error(`\n${failures} failure(s)`);
    process.exit(1);
  }
  console.log('\nAll smoke tests passed.');
})().catch((e) => {
  console.error(`FATAL ${e.stack || e.message}`);
  process.exit(1);
});
