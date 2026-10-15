/**
 * Navigation: document/workspace symbols, go-to-definition, references,
 * rename (§5). Variables resolve through the block-scope chain (mirroring
 * `Runtime.java`); functions are file-global, keyed `name + arity` like the
 * interpreter's symbol table, and resolve workspace-wide because the CLI
 * shares one symbol table across input files.
 */
import * as vscode from 'vscode';
import { parseSource, FunctionDecl, ScopeNode, VarBinding } from './parser';
import { parseDocument } from './diagnostics';
import { findBuiltin } from './builtins';

const WORD = /[a-zA-Z_\u0900-\u097f][a-zA-Z0-9_\u0900-\u097f]*/u;

function wordAt(document: vscode.TextDocument, position: vscode.Position): { word: string; range: vscode.Range } | undefined {
  const range = document.getWordRangeAtPosition(position, WORD);
  if (!range) {
    return undefined;
  }
  return { word: document.getText(range), range };
}

function toRange(document: vscode.TextDocument, start: number, end: number): vscode.Range {
  const len = document.getText().length;
  return new vscode.Range(document.positionAt(Math.min(start, len)), document.positionAt(Math.min(end, len)));
}

/** Resolve a variable use/binding to its declaration (nearest scope wins). */
export function resolveVariable(result: { bindings: VarBinding[] }, scope: ScopeNode, name: string): VarBinding | undefined {
  void result;
  let s: ScopeNode | null = scope;
  while (s) {
    const list = s.vars.get(name);
    if (list && list.length > 0) {
      return list[0];
    }
    s = s.parent;
  }
  return undefined;
}

/** All positions (bindings + uses) that resolve to the same declaration. */
function variableOccurrences(
  document: vscode.TextDocument,
  target: VarBinding
): vscode.Range[] {
  const result = parseDocument(document);
  const out: vscode.Range[] = [];
  const check = (name: string, start: number, end: number, scope: ScopeNode): void => {
    if (name !== target.name) {
      return;
    }
    if (resolveVariable(result, scope, name) === target) {
      out.push(toRange(document, start, end));
    }
  };
  for (const b of result.bindings) {
    check(b.name, b.start, b.end, b.scope);
  }
  for (const u of result.varUses) {
    check(u.name, u.start, u.end, u.scope);
  }
  // Include function parameter occurrences.
  for (const fn of result.functions) {
    for (const p of fn.params) {
      const binding = result.bindings.find((b) => b.start === p.start && b.end === p.end);
      if (binding && resolveVariable(result, binding.scope, p.name) === target && p.name === target.name) {
        out.push(toRange(document, p.start, p.end));
      }
    }
  }
  return out;
}

function functionOccurrences(document: vscode.TextDocument, name: string): vscode.Range[] {
  const result = parseDocument(document);
  const out: vscode.Range[] = [];
  for (const fn of result.functions) {
    if (fn.name === name) {
      out.push(toRange(document, fn.nameStart, fn.nameEnd));
    }
  }
  for (const call of result.calls) {
    if (!call.builtin && call.name === name) {
      out.push(toRange(document, call.start, call.end));
    }
  }
  return out;
}

async function workspaceTinyFiles(except?: vscode.Uri): Promise<vscode.Uri[]> {
  try {
    const files = await vscode.workspace.findFiles('**/*.{tinylang,english,hindi}', '**/node_modules/**', 200);
    return except ? files.filter((u) => u.toString() !== except.toString()) : files;
  } catch {
    return [];
  }
}

async function findFunctionDecls(name: string, except?: vscode.Uri): Promise<vscode.Location[]> {
  const out: vscode.Location[] = [];
  for (const uri of await workspaceTinyFiles(except)) {
    try {
      const bytes = await vscode.workspace.fs.readFile(uri);
      const result = parseSource(Buffer.from(bytes).toString('utf8'));
      const doc = await vscode.workspace.openTextDocument(uri);
      for (const fn of result.functions) {
        if (fn.name === name) {
          out.push(new vscode.Location(uri, toRange(doc, fn.nameStart, fn.nameEnd)));
        }
      }
    } catch {
      // Skip unreadable files.
    }
  }
  return out;
}

// ---------- document + workspace symbols ----------

export class TinyDocumentSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
    const result = parseDocument(document);
    const symbols: vscode.DocumentSymbol[] = [];
    for (const fn of result.functions) {
      const sel = toRange(document, fn.nameStart, fn.nameEnd);
      const full = toRange(document, fn.start, fn.end);
      const sym = new vscode.DocumentSymbol(fn.name, `function/${fn.arity}`, vscode.SymbolKind.Function, full, sel);
      for (const p of fn.params) {
        const prange = toRange(document, p.start, p.end);
        sym.children.push(new vscode.DocumentSymbol(p.name, 'parameter', vscode.SymbolKind.Variable, prange, prange));
      }
      symbols.push(sym);
    }
    const seenTop = new Set<string>();
    for (const b of result.bindings) {
      if (b.scope.depth !== 0 || seenTop.has(b.name)) {
        continue;
      }
      seenTop.add(b.name);
      const range = toRange(document, b.start, b.end);
      symbols.push(new vscode.DocumentSymbol(b.name, 'variable', vscode.SymbolKind.Variable, range, range));
    }
    return symbols;
  }
}

export class TinyWorkspaceSymbolProvider implements vscode.WorkspaceSymbolProvider {
  async provideWorkspaceSymbols(query: string): Promise<vscode.SymbolInformation[]> {
    const out: vscode.SymbolInformation[] = [];
    const q = query.toLowerCase();
    const docs = vscode.workspace.textDocuments.filter((d) => d.languageId === 'tinylang');
    const uris = new Set(docs.map((d) => d.uri.toString()));
    for (const doc of docs) {
      const result = parseDocument(doc);
      for (const fn of result.functions) {
        if (fn.name.toLowerCase().includes(q)) {
          out.push(new vscode.SymbolInformation(fn.name, vscode.SymbolKind.Function, `function/${fn.arity}`, new vscode.Location(doc.uri, toRange(doc, fn.nameStart, fn.nameEnd))));
        }
      }
    }
    for (const uri of await workspaceTinyFiles()) {
      if (uris.has(uri.toString())) {
        continue;
      }
      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        const text = Buffer.from(bytes).toString('utf8');
        if (!text.toLowerCase().includes(q)) {
          continue;
        }
        const result = parseSource(text);
        const doc = await vscode.workspace.openTextDocument(uri);
        for (const fn of result.functions) {
          if (fn.name.toLowerCase().includes(q)) {
            out.push(new vscode.SymbolInformation(fn.name, vscode.SymbolKind.Function, `function/${fn.arity}`, new vscode.Location(uri, toRange(doc, fn.nameStart, fn.nameEnd))));
          }
        }
      } catch {
        // Skip unreadable files.
      }
    }
    return out.slice(0, 100);
  }
}

// ---------- definition / references / rename ----------

export class TinyDefinitionProvider implements vscode.DefinitionProvider {
  async provideDefinition(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Definition | undefined> {
    const found = wordAt(document, position);
    if (!found) {
      return undefined;
    }
    const result = parseDocument(document);

    // Function call or name → declaration(s) in this file, else workspace.
    const decls: FunctionDecl[] = result.functions.filter((f) => f.name === found.word);
    if (decls.length > 0) {
      return decls.map((fn) => new vscode.Location(document.uri, toRange(document, fn.nameStart, fn.nameEnd)));
    }
    const isCall = result.calls.some(
      (c) => !c.builtin && c.name === found.word && c.start <= document.offsetAt(position) && document.offsetAt(position) <= c.end
    );
    if (isCall) {
      const elsewhere = await findFunctionDecls(found.word, document.uri);
      if (elsewhere.length > 0) {
        return elsewhere;
      }
      return undefined;
    }

    // Variable use → declaration via scope chain.
    const offset = document.offsetAt(position);
    const use = result.varUses.find((u) => u.name === found.word && u.start <= offset && offset <= u.end);
    const scope = use?.scope ?? result.rootScope;
    const binding = resolveVariable(result, scope, found.word);
    if (binding) {
      return new vscode.Location(document.uri, toRange(document, binding.start, binding.end));
    }
    return undefined;
  }
}

export class TinyReferenceProvider implements vscode.ReferenceProvider {
  async provideReferences(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location[]> {
    const found = wordAt(document, position);
    if (!found) {
      return [];
    }
    const result = parseDocument(document);
    const out: vscode.Location[] = [];

    if (result.functions.some((f) => f.name === found.word)) {
      for (const range of functionOccurrences(document, found.word)) {
        out.push(new vscode.Location(document.uri, range));
      }
      // Cross-file calls to this function.
      for (const uri of await workspaceTinyFiles(document.uri)) {
        try {
          const bytes = await vscode.workspace.fs.readFile(uri);
          const text = Buffer.from(bytes).toString('utf8');
          const parsed = parseSource(text);
          const other = await vscode.workspace.openTextDocument(uri);
          for (const call of parsed.calls) {
            if (!call.builtin && call.name === found.word) {
              out.push(new vscode.Location(uri, toRange(other, call.start, call.end)));
            }
          }
          for (const fn of parsed.functions) {
            if (fn.name === found.word) {
              out.push(new vscode.Location(uri, toRange(other, fn.nameStart, fn.nameEnd)));
            }
          }
        } catch {
          // Skip unreadable files.
        }
      }
      return out;
    }

    const offset = document.offsetAt(position);
    const use = result.varUses.find((u) => u.name === found.word && u.start <= offset && offset <= u.end);
    const bindingHere = result.bindings.find((b) => b.name === found.word && b.start <= offset && offset <= b.end);
    const target = bindingHere ?? (use ? resolveVariable(result, use.scope, found.word) : resolveVariable(result, result.rootScope, found.word));
    if (target) {
      for (const range of variableOccurrences(document, target)) {
        out.push(new vscode.Location(document.uri, range));
      }
    }
    return out;
  }
}

const RESERVED_CHECK = /^(function|if|else|return|for|while|to|in|true|false|null)$/;

export class TinyRenameProvider implements vscode.RenameProvider {
  async prepareRename(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Range | undefined> {
    const found = wordAt(document, position);
    if (!found) {
      throw new Error('No symbol at cursor.');
    }
    if (findBuiltin(found.word)) {
      throw new Error(`'${found.word}' is a built-in and cannot be renamed.`);
    }
    return found.range;
  }

  async provideRenameEdits(
    document: vscode.TextDocument,
    position: vscode.Position,
    newName: string
  ): Promise<vscode.WorkspaceEdit | undefined> {
    const found = wordAt(document, position);
    if (!found) {
      return undefined;
    }
    if (!/^[a-zA-Z_\u0900-\u097f][a-zA-Z0-9_\u0900-\u097f]*$/u.test(newName)) {
      throw new Error(`'${newName}' is not a valid Tiny Language identifier.`);
    }
    if (RESERVED_CHECK.test(newName) || findBuiltin(newName)) {
      throw new Error(`'${newName}' collides with a keyword or built-in.`);
    }
    const result = parseDocument(document);
    const edit = new vscode.WorkspaceEdit();

    if (result.functions.some((f) => f.name === found.word)) {
      // Function rename: same-file occurrences + workspace occurrences.
      if (result.functions.some((f) => f.name === newName)) {
        throw new Error(`A function named '${newName}' already exists in this file.`);
      }
      for (const range of functionOccurrences(document, found.word)) {
        edit.replace(document.uri, range, newName);
      }
      for (const uri of await workspaceTinyFiles(document.uri)) {
        try {
          const bytes = await vscode.workspace.fs.readFile(uri);
          const text = Buffer.from(bytes).toString('utf8');
          const parsed = parseSource(text);
          const other = await vscode.workspace.openTextDocument(uri);
          const namesake = parsed.functions.some((f) => f.name === newName);
          if (namesake) {
            throw new Error(`Rename refused: '${newName}' already exists in ${uri.fsPath}.`);
          }
          for (const fn of parsed.functions) {
            if (fn.name === found.word) {
              edit.replace(uri, toRange(other, fn.nameStart, fn.nameEnd), newName);
            }
          }
          for (const call of parsed.calls) {
            if (!call.builtin && call.name === found.word) {
              edit.replace(uri, toRange(other, call.start, call.end), newName);
            }
          }
        } catch (e) {
          if (e instanceof Error && e.message.startsWith('Rename refused')) {
            throw e;
          }
        }
      }
      return edit;
    }

    // Variable rename: file-local, scope-aware.
    const offset = document.offsetAt(position);
    const use = result.varUses.find((u) => u.name === found.word && u.start <= offset && offset <= u.end);
    const bindingHere = result.bindings.find((b) => b.name === found.word && b.start <= offset && offset <= b.end);
    const target = bindingHere ?? (use ? resolveVariable(result, use.scope, found.word) : undefined);
    if (!target) {
      return undefined;
    }
    if (target.scope.vars.get(newName)?.length) {
      throw new Error(`'${newName}' already exists in this scope.`);
    }
    for (const range of variableOccurrences(document, target)) {
      edit.replace(document.uri, range, newName);
    }
    return edit;
  }
}
