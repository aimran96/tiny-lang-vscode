/**
 * Unicode-aware lexer mirroring `tinylang/Language.g4` lexer rules.
 *
 * All offsets are UTF-16 code units (native JS string indices), which match
 * VS Code positions — no offset conversion is needed (the Java ANTLR side
 * also uses UTF-16).
 */

export type TokenKind =
  | 'identifier'
  | 'keyword'
  | 'builtin'
  | 'bool'
  | 'null'
  | 'number'
  | 'string'
  | 'operator'
  | 'punct'
  | 'invalid';

export interface Token {
  kind: TokenKind;
  text: string;
  /** Inclusive start offset (UTF-16). */
  start: number;
  /** Exclusive end offset (UTF-16). */
  end: number;
}

export interface LexResult {
  tokens: Token[];
  /** Non-fatal lexical problems (invalid chars, unterminated strings/comments). */
  errors: { message: string; start: number; end: number }[];
}

// Keyword spellings straight from Language.g4 (English + Hindi).
const KEYWORDS = new Set([
  'function', 'प्रक्रिया',
  'if', 'अगर',
  'else', 'अन्य',
  'return', 'लौटाऊ', 'लौटां',
  'for', 'चलो',
  'while', 'जबकि',
  'to', 'से',
  'in', 'में',
]);

// Builtin + reserved-token spellings from Language.g4.
const BUILTINS = new Set([
  'println', 'प्रिंटलाइन',
  'print', 'प्रिंट',
  'assert', 'दावा',
  'input', 'इनपुट',
  'size', 'माप',
  'toString', 'टेक्स्टबनाओ',
  'toNumber', 'संख्याबनाओ',
  'toBool', 'बूलियनबनाओ',
  'strLength', 'टेक्स्टकीलंबाई',
  'sqrRoot', 'वर्गमूल',
]);

const BOOLS = new Set(['true', 'false', 'सुच', 'सच', 'ग़लत', 'ग़लत']);
const NULLS = new Set(['null', 'खाली']);

const ASCII_ID_START = /[a-zA-Z_]/;
const ASCII_ID_PART = /[a-zA-Z_0-9]/;
/** Devanagari + related ranges used for Hindi identifiers (permissive superset of g4). */
function isHindiWordChar(ch: string): boolean {
  const cp = ch.codePointAt(0) ?? 0;
  return cp >= 0x0900 && cp <= 0x097f;
}
function isAsciiDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}
function isDevanagariDigit(ch: string): boolean {
  return ch >= '\u0966' && ch <= '\u096f';
}

const TWO_CHAR_OPS = new Set(['==', '!=', '>=', '<=', '&&', '||', '^^']);
const ONE_CHAR_OPS = new Set(['+', '-', '*', '/', '%', '^', '>', '<', '!', '?', ':', '=']);
const PUNCT = new Set(['{', '}', '[', ']', '(', ')', ';', ',']);

export function lex(text: string): LexResult {
  const tokens: Token[] = [];
  const errors: LexResult['errors'] = [];
  const n = text.length;
  let i = 0;

  const push = (kind: TokenKind, start: number, end: number): void => {
    tokens.push({ kind, text: text.slice(start, end), start, end });
  };

  while (i < n) {
    const ch = text[i];

    // Whitespace (Space rule: space, tab, CR, LF, FF).
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n' || ch === '\u000c') {
      i++;
      continue;
    }

    // Comments: `//…` and `/* … */`.
    if (ch === '/' && text[i + 1] === '/') {
      let j = i + 2;
      while (j < n && text[j] !== '\n' && text[j] !== '\r') {
        j++;
      }
      i = j;
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2);
      if (close === -1) {
        errors.push({ message: 'Unterminated block comment.', start: i, end: n });
        i = n;
      } else {
        i = close + 2;
      }
      continue;
    }

    // Strings: single-line, "..." or '...' (g4 `.` excludes newlines).
    if (ch === '"' || ch === "'") {
      const start = i;
      const quote = ch;
      let j = i + 1;
      let closed = false;
      while (j < n) {
        const c = text[j];
        if (c === '\n' || c === '\r') {
          break;
        }
        if (c === '\\' && j + 1 < n && text[j + 1] !== '\n' && text[j + 1] !== '\r') {
          j += 2;
          continue;
        }
        if (c === quote) {
          closed = true;
          j++;
          break;
        }
        j++;
      }
      if (!closed) {
        errors.push({ message: 'Unterminated string literal.', start, end: j });
      }
      push('string', start, j);
      i = j;
      continue;
    }

    // Numbers: ASCII `1-9…|0` (+fraction) and Devanagari digits (+fraction).
    if (isAsciiDigit(ch)) {
      const start = i;
      while (i < n && isAsciiDigit(text[i])) {
        i++;
      }
      if (text[i] === '.' && isAsciiDigit(text[i + 1] ?? '')) {
        i++;
        while (i < n && isAsciiDigit(text[i])) {
          i++;
        }
      }
      push('number', start, i);
      continue;
    }
    if (isDevanagariDigit(ch)) {
      const start = i;
      while (i < n && isDevanagariDigit(text[i])) {
        i++;
      }
      if (text[i] === '.' && isDevanagariDigit(text[i + 1] ?? '')) {
        i++;
        while (i < n && isDevanagariDigit(text[i])) {
          i++;
        }
      }
      push('number', start, i);
      continue;
    }

    // Identifiers / keywords / builtins / bools / null (ASCII or Hindi).
    if (ASCII_ID_START.test(ch) || isHindiWordChar(ch)) {
      const start = i;
      if (ASCII_ID_START.test(ch)) {
        i++;
        while (i < n && (ASCII_ID_PART.test(text[i]) || isHindiWordChar(text[i]))) {
          i++;
        }
      } else {
        i++;
        while (
          i < n &&
          (text[i] === '_' || ASCII_ID_PART.test(text[i]) || isHindiWordChar(text[i]))
        ) {
          i++;
        }
      }
      const word = text.slice(start, i);
      if (KEYWORDS.has(word)) {
        push('keyword', start, i);
      } else if (BUILTINS.has(word)) {
        push('builtin', start, i);
      } else if (BOOLS.has(word)) {
        push('bool', start, i);
      } else if (NULLS.has(word)) {
        push('null', start, i);
      } else {
        push('identifier', start, i);
      }
      continue;
    }

    // Two-char operators first.
    const two = text.slice(i, i + 2);
    if (TWO_CHAR_OPS.has(two)) {
      push('operator', i, i + 2);
      i += 2;
      continue;
    }
    if (ONE_CHAR_OPS.has(ch)) {
      push('operator', i, i + 1);
      i++;
      continue;
    }
    if (PUNCT.has(ch)) {
      push('punct', i, i + 1);
      i++;
      continue;
    }

    errors.push({ message: `Invalid character '${ch}'.`, start: i, end: i + 1 });
    push('invalid', i, i + 1);
    i++;
  }

  return { tokens, errors };
}
