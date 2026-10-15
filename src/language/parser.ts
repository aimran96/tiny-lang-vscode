/**
 * Hand-ported recursive-descent parser mirroring `tinylang/Language.g4`.
 *
 * Parser strategy (requirements §6): a compatible in-host parser derived
 * directly from the grammar rules (`parse`, `block`, `statement`,
 * `functionDecl`, expression precedence chain, `functionCall` arities).
 * Generating a TS parser from the `.g4` would require forking the grammar for
 * antlr4ts/antlr4ng plus a runtime dependency; the hand port keeps the
 * extension dependency-free and is validated against `test.english` /
 * `test.hindi`. Revisit with a generated parser / language server in Phase 3.
 *
 * Properties:
 * - Never throws on incomplete code: error recovery syncs on `;`, `{`, `}`.
 * - All offsets are UTF-16 code units = VS Code positions (no conversion).
 * - Scoping mirrors `Runtime.java`: every `{…}` block opens a child scope;
 *   functions are file-global, keyed `name + arity` (see SymbolTableBuilder).
 */

import { Token, lex } from './lexer';
import { CALLABLE_NAMES, findBuiltin } from './builtins';

export type DiagnosticKind = 'syntax' | 'semantic';

export interface Fix {
  /** Insertion or replacement applied by a quick fix / formatting assist. */
  newText: string;
  start: number;
  end: number;
}

export interface Diagnostic {
  message: string;
  start: number;
  end: number;
  kind: DiagnosticKind;
  /** Machine tag for workspace-aware filtering (`unknown-function`). */
  tag?: 'unknown-function' | 'arity';
  fix?: Fix;
}

export interface ParamInfo {
  name: string;
  start: number;
  end: number;
}

export interface FunctionDecl {
  name: string;
  nameStart: number;
  nameEnd: number;
  params: ParamInfo[];
  arity: number;
  /** Whole declaration range (from `function` keyword to closing brace). */
  start: number;
  end: number;
  bodyStart: number;
  bodyEnd: number;
}

export interface VarBinding {
  name: string;
  start: number;
  end: number;
  scope: ScopeNode;
}

export interface VarUse {
  name: string;
  start: number;
  end: number;
  scope: ScopeNode;
}

export interface CallInfo {
  name: string;
  start: number;
  end: number;
  argCount: number;
  /** True for println/print/assert/size/input spellings (EN+HI). */
  builtin: boolean;
  /** Offset just after `)` (or where it should be) — for signature help. */
  closeParen: number;
}

export interface ScopeNode {
  parent: ScopeNode | null;
  depth: number;
  /** Variable bindings declared directly in this scope. */
  vars: Map<string, VarBinding[]>;
}

export interface ParseResult {
  diagnostics: Diagnostic[];
  functions: FunctionDecl[];
  bindings: VarBinding[];
  varUses: VarUse[];
  calls: CallInfo[];
  rootScope: ScopeNode;
}

const MAX_DIAGNOSTICS = 100;
const SYNC: Set<string> = new Set([';', '{', '}']);

function isKeyword(t: Token | undefined, ...words: string[]): boolean {
  return !!t && t.kind === 'keyword' && words.includes(t.text);
}

export function parseSource(text: string): ParseResult {
  const { tokens, errors } = lex(text);
  const p = new Parser(text, tokens);
  for (const e of errors) {
    p.diagnostic(e.message, e.start, e.end, 'syntax');
  }
  p.parseProgram();
  p.checkCalls();
  return {
    diagnostics: p.diagnostics,
    functions: p.functions,
    bindings: p.bindings,
    varUses: p.varUses,
    calls: p.calls,
    rootScope: p.rootScope,
  };
}

class Parser {
  diagnostics: Diagnostic[] = [];
  functions: FunctionDecl[] = [];
  bindings: VarBinding[] = [];
  varUses: VarUse[] = [];
  calls: CallInfo[] = [];
  rootScope: ScopeNode;
  private scope: ScopeNode;
  private pos = 0;

  constructor(
    private readonly text: string,
    private readonly tokens: Token[]
  ) {
    this.rootScope = { parent: null, depth: 0, vars: new Map() };
    this.scope = this.rootScope;
  }

  diagnostic(message: string, start: number, end: number, kind: DiagnosticKind, tag?: Diagnostic['tag'], fix?: Fix): void {
    if (this.diagnostics.length >= MAX_DIAGNOSTICS) {
      return;
    }
    this.diagnostics.push({ message, start: Math.max(0, start), end: Math.max(0, end), kind, tag, fix });
  }

  private peek(offset = 0): Token | undefined {
    return this.tokens[this.pos + offset];
  }

  private next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  private atEnd(): boolean {
    return this.pos >= this.tokens.length;
  }

  /** Expect exact text; on mismatch record + optional insertion fix. */
  private expect(text: string, what: string, fixable: boolean): Token | undefined {
    const t = this.peek();
    if (t && t.text === text) {
      return this.next();
    }
    const at = t ? t.start : this.text.length;
    this.diagnostic(
      `Expected '${text}' ${what}.`,
      at,
      at,
      'syntax',
      undefined,
      fixable ? { newText: text, start: at, end: at } : undefined
    );
    return undefined;
  }

  // ---------- entry ----------

  parseProgram(): void {
    this.parseBlockBody(false);
    if (!this.atEnd()) {
      const t = this.peek()!;
      this.diagnostic(`Unexpected '${t.text}'.`, t.start, t.end, 'syntax');
      this.synchronize();
      if (!this.atEnd()) {
        const rest = this.peek()!;
        this.diagnostic(`Unexpected '${rest.text}'.`, rest.start, rest.end, 'syntax');
      }
    }
  }

  /** Body of a block; `braced` when the opening `{` was already consumed. */
  private parseBlockBody(braced: boolean): void {
    for (;;) {
      const t = this.peek();
      if (!t) {
        if (braced) {
          this.diagnostic(`Missing closing '}'.`, this.text.length, this.text.length, 'syntax', undefined, {
            newText: '\n}',
            start: this.text.length,
            end: this.text.length,
          });
        }
        return;
      }
      if (braced && t.text === '}') {
        this.next();
        return;
      }
      if (isKeyword(t, 'function', 'प्रक्रिया')) {
        this.parseFunctionDecl();
        continue;
      }
      if (isKeyword(t, 'return', 'लौटाऊ', 'लौटां')) {
        this.next();
        this.parseExpression();
        this.expect(';', 'after return value', true);
        // `return … ;` ends the block per g4; trailing statements still parsed leniently.
        continue;
      }
      if (t.text === ';') {
        this.next(); // stray semicolon: tolerate
        continue;
      }
      this.parseStatement();
    }
  }

  private parseStatement(): void {
    const t = this.peek();
    if (!t) {
      return;
    }
    if (isKeyword(t, 'if', 'अगर')) {
      this.parseIf();
      return;
    }
    if (isKeyword(t, 'for', 'चलो')) {
      this.parseFor();
      return;
    }
    if (isKeyword(t, 'while', 'जबकि')) {
      this.parseWhile();
      return;
    }
    if (t.text === '{') {
      this.next();
      this.withScope(() => this.parseBlockBody(true));
      return;
    }
    // Assignment vs expression-statement: probe for `=` at bracket depth 0.
    if (t.kind === 'identifier' && this.looksLikeAssignment()) {
      this.parseAssignment();
      this.expect(';', "after assignment", true);
      return;
    }
    // Expression statement must be a function call followed by `;`.
    const start = t.start;
    this.parseExpression();
    const semi = this.peek();
    if (semi && semi.text === ';') {
      this.next();
    } else {
      const at = semi ? semi.start : this.text.length;
      this.diagnostic(`Expected ';' after expression.`, at, at, 'syntax', undefined, {
        newText: ';',
        start: at,
        end: at,
      });
      void start;
    }
  }

  /** True when tokens form `Identifier (…[…])* =` from current pos. */
  private looksLikeAssignment(): boolean {
    let j = this.pos + 1;
    for (;;) {
      const t = this.tokens[j];
      if (!t) {
        return false;
      }
      if (t.text === '[') {
        let depth = 0;
        while (j < this.tokens.length) {
          if (this.tokens[j].text === '[') {
            depth++;
          } else if (this.tokens[j].text === ']') {
            depth--;
            if (depth === 0) {
              j++;
              break;
            }
          }
          j++;
        }
        continue;
      }
      return t.text === '=';
    }
  }

  private parseAssignment(): void {
    const id = this.next()!; // identifier
    this.declareVar(id.text, id.start, id.end);
    this.parseIndexSuffixes();
    this.expect('=', 'in assignment', false);
    this.parseExpression();
  }

  private declareVar(name: string, start: number, end: number): void {
    const binding: VarBinding = { name, start, end, scope: this.scope };
    this.bindings.push(binding);
    const list = this.scope.vars.get(name) ?? [];
    list.push(binding);
    this.scope.vars.set(name, list);
  }

  private useVar(name: string, start: number, end: number): void {
    this.varUses.push({ name, start, end, scope: this.scope });
  }

  // ---------- declarations & control flow ----------

  private parseFunctionDecl(): void {
    const kw = this.next()!;
    const id = this.peek();
    if (!id || id.kind !== 'identifier') {
      const at = id ? id.start : this.text.length;
      this.diagnostic(`Expected a function name after '${kw.text}'.`, at, at, 'syntax');
      this.synchronize();
      return;
    }
    this.next();
    const decl: FunctionDecl = {
      name: id.text,
      nameStart: id.start,
      nameEnd: id.end,
      params: [],
      arity: 0,
      start: kw.start,
      end: id.end,
      bodyStart: id.end,
      bodyEnd: id.end,
    };
    this.expect('(', "after function name", false);
    // idList?
    for (;;) {
      const p = this.peek();
      if (!p) {
        break;
      }
      if (p.text === ')') {
        break;
      }
      if (p.kind === 'identifier') {
        this.next();
        decl.params.push({ name: p.text, start: p.start, end: p.end });
        const comma = this.peek();
        if (comma && comma.text === ',') {
          this.next();
          continue;
        }
        continue;
      }
      this.diagnostic(`Unexpected '${p.text}' in parameter list.`, p.start, p.end, 'syntax');
      this.next();
      if (p.text === ',' || p.text === ';') {
        continue;
      }
      break;
    }
    const closeParen = this.peek();
    if (closeParen && closeParen.text === ')') {
      this.next();
    } else {
      const at = closeParen ? closeParen.start : this.text.length;
      this.diagnostic(`Expected ')' to close the parameter list.`, at, at, 'syntax', undefined, {
        newText: ')',
        start: at,
        end: at,
      });
    }
    decl.arity = decl.params.length;
    const open = this.peek();
    if (!open || open.text !== '{') {
      const at = open ? open.start : this.text.length;
      this.diagnostic(`Expected '{' to open the function body.`, at, at, 'syntax', undefined, {
        newText: ' {',
        start: at,
        end: at,
      });
      decl.end = at;
      this.functions.push(decl);
      this.synchronize();
      return;
    }
    this.next();
    const outer = this.scope;
    const fnScope: ScopeNode = { parent: outer, depth: outer.depth + 1, vars: new Map() };
    this.scope = fnScope;
    for (const param of decl.params) {
      const binding: VarBinding = { name: param.name, start: param.start, end: param.end, scope: fnScope };
      this.bindings.push(binding);
      const list = fnScope.vars.get(param.name) ?? [];
      list.push(binding);
      fnScope.vars.set(param.name, list);
    }
    decl.bodyStart = open.end;
    this.parseBlockBody(true);
    decl.bodyEnd = this.text.length;
    decl.end = this.tokens[this.pos - 1]?.end ?? open.end;
    this.scope = outer;
    // Duplicate name+arity mirrors the interpreter silently overwriting: warn, don't error.
    const dup = this.functions.find((f) => f.name === decl.name && f.arity === decl.arity);
    if (dup) {
      this.diagnostic(
        `Function '${decl.name}' with ${decl.arity} parameter(s) is already defined; the later definition wins at runtime.`,
        decl.nameStart,
        decl.nameEnd,
        'semantic'
      );
    }
    this.functions.push(decl);
  }

  private parseIf(): void {
    this.next(); // if | अगर
    this.parseExpression();
    this.parseBraceBlock("after if condition");
    while (isKeyword(this.peek(), 'else', 'अन्य')) {
      this.next();
      if (isKeyword(this.peek(), 'if', 'अगर')) {
        this.next();
        this.parseExpression();
      }
      this.parseBraceBlock("after else");
    }
  }

  private parseBraceBlock(what: string): void {
    const open = this.peek();
    if (!open || open.text !== '{') {
      const at = open ? open.start : this.text.length;
      this.diagnostic(`Expected '{' ${what}.`, at, at, 'syntax', undefined, {
        newText: ' {',
        start: at,
        end: at,
      });
      return;
    }
    this.next();
    this.withScope(() => this.parseBlockBody(true));
  }

  private parseFor(): void {
    this.next(); // for | चलो
    const t = this.peek();
    if (t && t.text === '(') {
      // C-style: for ( assignment ; expression (; assignment)? )
      this.next();
      if (this.peek() && this.peek()!.kind === 'identifier') {
        this.parseAssignment();
      } else if (this.peek() && this.peek()!.text !== ';') {
        this.parseExpression();
      }
      this.expect(';', "in for header", false);
      if (this.peek() && this.peek()!.text !== ';' && this.peek()!.text !== ')') {
        this.parseExpression();
      }
      if (this.peek() && this.peek()!.text === ';') {
        this.next();
        if (this.peek() && this.peek()!.text !== ')') {
          if (this.peek()!.kind === 'identifier' && this.looksLikeAssignment()) {
            this.parseAssignment();
          } else {
            this.parseExpression();
          }
        }
      }
      this.expect(')', "to close for header", true);
      this.parseBraceBlock('after for(…)');
      return;
    }
    // Range-style: for Identifier = expression to expression
    const id = this.peek();
    if (id && id.kind === 'identifier') {
      this.next();
      this.declareVar(id.text, id.start, id.end);
    } else {
      const at = id ? id.start : this.text.length;
      this.diagnostic(`Expected a loop variable after 'for'.`, at, at, 'syntax');
    }
    this.expect('=', "in for-to loop", false);
    this.parseExpression();
    const to = this.peek();
    if (isKeyword(to, 'to', 'से')) {
      this.next();
    } else {
      const at = to ? to.start : this.text.length;
      this.diagnostic(`Expected 'to' (से) in for-to loop.`, at, at, 'syntax');
    }
    this.parseExpression();
    this.parseBraceBlock('after for-to header');
  }

  private parseWhile(): void {
    this.next(); // while | जबकि
    this.parseExpression();
    this.parseBraceBlock('after while condition');
  }

  private withScope(fn: () => void): void {
    const child: ScopeNode = { parent: this.scope, depth: this.scope.depth + 1, vars: new Map() };
    const outer = this.scope;
    this.scope = child;
    fn();
    this.scope = outer;
  }

  // ---------- expressions (Pratt; precedence mirrors g4 alternative order) ----------

  private parseExpression(minPrec = 0): void {
    this.parsePrefix();
    for (;;) {
      const t = this.peek();
      if (!t) {
        return;
      }
      // Call/index suffixes bind tightest on primaries already handled; `in` handled below.
      if (t.text === '?') {
        if (2 < minPrec) {
          return;
        }
        this.next();
        this.parseExpression();
        this.expect(':', "in ternary expression", false);
        this.parseExpression(2);
        continue;
      }
      const prec = this.infixPrec(t);
      if (prec === 0 || prec < minPrec) {
        return;
      }
      const rightAssoc = t.text === '^';
      this.next();
      this.parseExpression(rightAssoc ? prec : prec + 1);
    }
  }

  private infixPrec(t: Token): number {
    if (t.kind !== 'operator' && !(t.kind === 'keyword' && t.text !== undefined)) {
      return 0;
    }
    switch (t.text) {
      case '^':
        return 9;
      case '*':
      case '/':
      case '%':
        return 8;
      case '+':
      case '-':
        return 7;
      case '>=':
      case '<=':
      case '>':
      case '<':
        return 6;
      case '==':
      case '!=':
        return 5;
      case '&&':
        return 4;
      case '||':
      case '^^':
        return 3;
      case 'in':
      case 'में':
        return t.kind === 'keyword' ? 1 : 0;
      default:
        return 0;
    }
  }

  private parsePrefix(): void {
    const t = this.peek();
    if (!t) {
      this.diagnostic(`Expected an expression but reached the end of the file.`, this.text.length, this.text.length, 'syntax');
      return;
    }
    if (t.kind === 'operator' && (t.text === '-' || t.text === '!')) {
      this.next();
      this.parseExpression(10);
      return;
    }
    this.parsePrimary();
  }

  private parsePrimary(): void {
    const t = this.peek();
    if (!t) {
      this.diagnostic(`Expected an expression but reached the end of the file.`, this.text.length, this.text.length, 'syntax');
      return;
    }
    // Literals.
    if (t.kind === 'number' || t.kind === 'bool' || t.kind === 'null' || t.kind === 'string') {
      this.next();
      this.parseIndexSuffixes();
      return;
    }
    if (t.text === '[') {
      this.parseList();
      this.parseIndexSuffixes();
      return;
    }
    if (t.text === '(') {
      this.next();
      this.parseExpression();
      this.expect(')', "to close parenthesized expression", true);
      this.parseIndexSuffixes();
      return;
    }
    // input( String? )
    if (t.kind === 'builtin' && (t.text === 'input' || t.text === 'इनपुट')) {
      this.parseBuiltinCall();
      return;
    }
    // Other builtin calls.
    if (t.kind === 'builtin') {
      this.parseBuiltinCall();
      this.parseIndexSuffixes();
      return;
    }
    // Identifier: call, or variable (+ indexes).
    if (t.kind === 'identifier') {
      const ahead = this.peek(1);
      if (ahead && ahead.text === '(') {
        this.parseIdentifierCall();
        this.parseIndexSuffixes();
        return;
      }
      this.next();
      this.useVar(t.text, t.start, t.end);
      this.parseIndexSuffixes();
      return;
    }
    if (t.kind === 'keyword') {
      this.diagnostic(`Unexpected keyword '${t.text}' in expression.`, t.start, t.end, 'syntax');
      this.next();
      return;
    }
    this.diagnostic(`Unexpected '${t.text}' in expression.`, t.start, t.end, 'syntax');
    this.next();
  }

  private parseList(): void {
    this.next(); // [
    const t = this.peek();
    if (t && t.text !== ']') {
      this.parseExpression();
      while (this.peek() && this.peek()!.text === ',') {
        this.next();
        if (this.peek() && this.peek()!.text === ']') {
          break;
        }
        this.parseExpression();
      }
    }
    this.expect(']', "to close list literal", true);
  }

  private parseIndexSuffixes(): void {
    while (this.peek() && this.peek()!.text === '[') {
      this.next();
      this.parseExpression();
      this.expect(']', "to close index", true);
    }
  }

  private parseArgList(): { count: number; closeParen: number } {
    let count = 0;
    const t = this.peek();
    if (t && t.text !== ')') {
      this.parseExpression();
      count = 1;
      while (this.peek() && this.peek()!.text === ',') {
        this.next();
        if (this.peek() && this.peek()!.text === ')') {
          break;
        }
        this.parseExpression();
        count++;
      }
    }
    const close = this.peek();
    if (close && close.text === ')') {
      this.next();
      return { count, closeParen: close.end };
    }
    const at = close ? close.start : this.text.length;
    this.diagnostic(`Expected ')' to close the argument list.`, at, at, 'syntax', undefined, {
      newText: ')',
      start: at,
      end: at,
    });
    return { count, closeParen: at };
  }

  private parseBuiltinCall(): void {
    const name = this.next()!;
    const open = this.peek();
    if (!open || open.text !== '(') {
      const at = open ? open.start : this.text.length;
      this.diagnostic(`Expected '(' after '${name.text}'.`, at, at, 'syntax', undefined, {
        newText: '(',
        start: at,
        end: at,
      });
      return;
    }
    this.next();
    const { count, closeParen } = this.parseArgList();
    this.calls.push({ name: name.text, start: name.start, end: name.end, argCount: count, builtin: true, closeParen });
  }

  private parseIdentifierCall(): void {
    const name = this.next()!;
    this.next(); // (
    const { count, closeParen } = this.parseArgList();
    this.calls.push({ name: name.text, start: name.start, end: name.end, argCount: count, builtin: false, closeParen });
  }

  // ---------- recovery ----------

  private synchronize(): void {
    while (!this.atEnd()) {
      const t = this.peek()!;
      if (SYNC.has(t.text)) {
        if (t.text === ';') {
          this.next();
        }
        return;
      }
      this.next();
    }
  }

  // ---------- file-local semantic checks (grounded in the interpreter) ----------

  /** File-local semantic checks (grounded in the interpreter). */
  checkCalls(): void {
    const byName = new Map<string, FunctionDecl[]>();
    for (const f of this.functions) {
      const list = byName.get(f.name) ?? [];
      list.push(f);
      byName.set(f.name, list);
    }
    for (const call of this.calls) {
      if (call.builtin) {
        const spec = findBuiltin(call.name);
        if (spec && spec.callable && (call.argCount < spec.minArgs || call.argCount > spec.maxArgs)) {
          const expected =
            spec.minArgs === spec.maxArgs
              ? `${spec.minArgs}`
              : `between ${spec.minArgs} and ${spec.maxArgs}`;
          this.diagnostic(
            `'${call.name}' expects ${expected} argument(s) but got ${call.argCount}.`,
            call.start,
            call.end,
            'semantic',
            'arity'
          );
        }
        continue;
      }
      if (CALLABLE_NAMES.has(call.name)) {
        continue; // reserved-spelling guard; lexer classifies these as builtins anyway.
      }
      const decls = byName.get(call.name) ?? [];
      if (decls.length === 0) {
        // May be defined in another file executed together (shared symbol
        // table) — diagnostics.ts downgrades this when the workspace knows it.
        this.diagnostic(`Unknown function '${call.name}'.`, call.start, call.end, 'semantic', 'unknown-function');
        continue;
      }
      if (!decls.some((d) => d.arity === call.argCount)) {
        const arities = [...new Set(decls.map((d) => d.arity))].sort((a, b) => a - b).join(' / ');
        this.diagnostic(
          `'${call.name}' takes ${arities} parameter(s) but is called with ${call.argCount} argument(s).`,
          call.start,
          call.end,
          'semantic',
          'arity'
        );
      }
    }
  }
}
