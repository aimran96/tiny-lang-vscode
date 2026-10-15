/**
 * Built-in function metadata, grounded in `tinylang/Language.g4` and
 * `tinylang/readme.md`.
 *
 * Callable in the current grammar (`functionCall` rule + `inputExpression`):
 *   println (0-1 args), print (1), assert (1), size (1), input (0-1, string prompt)
 *
 * NOTE — `toString`/`toNumber`/`toBool`/`strLength`/`sqrRoot` (and Hindi
 * aliases टेक्स्टबनाओ/संख्याबनाओ/बूलियनबनाओ/टेक्स्टकीलंबाई/वर्गमूल) exist only
 * as *lexer tokens* in Language.g4: no parser rule or interpreter visitor
 * references them, so they are NOT callable. They are listed here as
 * `callable: false` so hover can say so instead of misleading users.
 * (The interpreter `todo.txt` lists conversions as future work.)
 */

export interface BuiltinParam {
  name: string;
  optional: boolean;
  doc: string;
}

export interface Builtin {
  /** Canonical English name. */
  name: string;
  /** Hindi alias from the grammar (empty if none). */
  hindi: string;
  /** Whether the current grammar/interpreter can actually call this. */
  callable: boolean;
  minArgs: number;
  maxArgs: number;
  params: BuiltinParam[];
  doc: string;
  /** Example snippet body (without trailing `;`). */
  snippet: string;
}

export const BUILTINS: Builtin[] = [
  {
    name: 'println',
    hindi: 'प्रिंटलाइन',
    callable: true,
    minArgs: 0,
    maxArgs: 1,
    params: [{ name: 'expression', optional: true, doc: 'Value to print (optional).' }],
    doc: 'Prints to the console with a newline. `println([optional expression]);`',
    snippet: 'println(${0:expression})',
  },
  {
    name: 'print',
    hindi: 'प्रिंट',
    callable: true,
    minArgs: 1,
    maxArgs: 1,
    params: [{ name: 'expression', optional: false, doc: 'Value to print.' }],
    doc: 'Prints to the console without a newline. `print([expression]);`',
    snippet: 'print(${0:expression})',
  },
  {
    name: 'assert',
    hindi: 'दावा',
    callable: true,
    minArgs: 1,
    maxArgs: 1,
    params: [{ name: 'condition', optional: false, doc: 'Terminates the program if falsy.' }],
    doc: 'Debugging function. Terminates the program if the assertion fails.',
    snippet: 'assert(${0:condition})',
  },
  {
    name: 'input',
    hindi: 'इनपुट',
    callable: true,
    minArgs: 0,
    maxArgs: 1,
    params: [{ name: 'promptOrFile', optional: true, doc: 'Optional prompt string, or a filename to read from.' }],
    doc: 'Reads input from the console, or from a file if a filename is provided.',
    snippet: 'input(${0:"prompt"})',
  },
  {
    name: 'size',
    hindi: 'माप',
    callable: true,
    minArgs: 1,
    maxArgs: 1,
    params: [{ name: 'list', optional: false, doc: 'List whose length is returned.' }],
    doc: 'Returns the size of a list. `size(list);`',
    snippet: 'size(${0:list})',
  },
  {
    name: 'toString',
    hindi: 'टेक्स्टबनाओ',
    callable: false,
    minArgs: 1,
    maxArgs: 1,
    params: [],
    doc: 'Reserved lexer token only — not callable in the current grammar/interpreter (see interpreter todo.txt).',
    snippet: 'toString(${0:value})',
  },
  {
    name: 'toNumber',
    hindi: 'संख्याबनाओ',
    callable: false,
    minArgs: 1,
    maxArgs: 1,
    params: [],
    doc: 'Reserved lexer token only — not callable in the current grammar/interpreter (see interpreter todo.txt).',
    snippet: 'toNumber(${0:value})',
  },
  {
    name: 'toBool',
    hindi: 'बूलियनबनाओ',
    callable: false,
    minArgs: 1,
    maxArgs: 1,
    params: [],
    doc: 'Reserved lexer token only — not callable in the current grammar/interpreter (see interpreter todo.txt).',
    snippet: 'toBool(${0:value})',
  },
  {
    name: 'strLength',
    hindi: 'टेक्स्टकीलंबाई',
    callable: false,
    minArgs: 1,
    maxArgs: 1,
    params: [],
    doc: 'Reserved lexer token only — not callable in the current grammar/interpreter.',
    snippet: 'strLength(${0:text})',
  },
  {
    name: 'sqrRoot',
    hindi: 'वर्गमूल',
    callable: false,
    minArgs: 1,
    maxArgs: 1,
    params: [],
    doc: 'Reserved lexer token only — not callable in the current grammar/interpreter.',
    snippet: 'sqrRoot(${0:value})',
  },
];

export const CALLABLE_BUILTINS: Builtin[] = BUILTINS.filter((b) => b.callable);

/** All callable names (English + Hindi) for quick lookup. */
export const CALLABLE_NAMES: Set<string> = new Set(
  CALLABLE_BUILTINS.flatMap((b) => (b.hindi ? [b.name, b.hindi] : [b.name]))
);

/** Every known builtin name (callable or reserved), English + Hindi. */
export const ALL_BUILTIN_NAMES: Set<string> = new Set(
  BUILTINS.flatMap((b) => (b.hindi ? [b.name, b.hindi] : [b.name]))
);

export function findBuiltin(name: string): Builtin | undefined {
  return BUILTINS.find((b) => b.name === name || b.hindi === name);
}

/** Keyword metadata for completion/hover (English + Hindi forms). */
export interface Keyword {
  names: string[];
  doc: string;
}

export const KEYWORDS: Keyword[] = [
  { names: ['function', 'प्रक्रिया'], doc: 'Declares a function: `function name(params) { … }`.' },
  { names: ['if', 'अगर'], doc: 'Conditional branch: `if condition { … }`.' },
  { names: ['else', 'अन्य'], doc: 'Alternative branch: `else { … }` / `else if …` (अन्य अगर).' },
  { names: ['return', 'लौटाऊ'], doc: 'Returns a value from a function or the top-level block. Test files use `लौटाऊ`; the grammar also accepts `लौटां`.' },
  { names: ['for', 'चलो'], doc: 'Loop: C-style `for (i = 1; …)` or range `for i=1 to 10 { … }` (चलो … से …).' },
  { names: ['while', 'जबकि'], doc: 'Loop while a condition holds: `while cond { … }`.' },
  { names: ['to', 'से'], doc: 'Range separator in for-to loops: `for i=1 to 10`.' },
  { names: ['in', 'में'], doc: 'Membership operator: `value in list`.' },
  { names: ['true', 'false', 'सुच', 'सच', 'ग़लत', 'ग़लत'], doc: 'Boolean literal.' },
  { names: ['null', 'खाली'], doc: 'Null literal.' },
];
