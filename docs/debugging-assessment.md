# Tiny Language — Debugging Assessment (Phase 3, §8)

Date: 2026-10-15 · Status: **not currently feasible without interpreter changes** · No debugger support is claimed.

## Verdict

The current interpreter cannot support breakpoints, stepping, call stack,
variables, or expression evaluation. It is a synchronous, single-threaded
ANTLR tree-walking evaluator with no execution hooks, no pause mechanism,
and line-only location reporting. Real debugging requires a separately
designed and reviewed change to the **interpreter repository**
(`tiny-lang-hindi`) plus a debug adapter in this extension. Syntax parsing
alone must never be presented as debugger support.

## What the interpreter actually provides today

All references are to `tinylang/tinylang/src/saad/language/`:

- Execution is a direct tree walk: `Runtime extends LanguageBaseVisitor`
  (`Runtime.java:17`). `visitBlock` (`Runtime.java:643-657`) loops over
  statements and visits them with **no hook point** — there is nowhere to
  test a breakpoint or suspend for a step.
- Function calls create a fresh `Runtime` over a child `Scope`
  (`Function.java:22-23`); the call stack exists only implicitly on the JVM
  stack and is never reified, so there is nothing to report as a DAP stack
  trace today.
- The only source locations ever surfaced are 1-based **line numbers**:
  `LanguageRuntimeException` appends `" line:" + ctx.start.getLine()`
  (`LanguageRuntimeException.java:12-14`) and assertion failures do the same
  (`Runtime.java:579`). No columns, no end positions, no file identity
  (relevant because one CLI invocation shares a symbol table across files —
  see `Interpreter.java:34-59`).
- Variable state lives in private `Scope` maps (`Scope.java:7-8`) with only
  a debug `toString` (`Scope.java:71-78`); values (`Value.java`) are not
  serialized for display.
- There is no threading, socket/stdio protocol, verbose/trace flag, or
  breakpoint concept anywhere in the sources (verified by search).
- `input()` reads live stdin (`Runtime.java:508+`), so any future stepping
  design must coordinate console input with suspension.

The one favorable fact: full ANTLR `ParserRuleContext` objects (start/stop
tokens with line and character offsets) flow through every visit method, so
precise locations *can* be exposed once hooks exist — nothing in the grammar
blocks this.

## Capability gap table

| DAP capability | Today | Needs (interpreter side) |
|---|---|---|
| Breakpoints (line/column) | No | Per-statement hook in `visitBlock`; breakpoint set keyed by file+line; column info from `ctx.start`/`ctx.stop` |
| Step over/into/out | No | Same hook + step mode flag; pause via thread coordination (`wait`/`notify` or a debug event loop) |
| Call stack | No | Reified frame list (function name, arity, call-site location) instead of implicit JVM stack |
| Variables/scopes | Partial (internal only) | Read API over the `Scope` chain + `Value` text rendering |
| Expression evaluation | No | Evaluate-an-expression-against-a-frame entry point |
| Multi-file programs | No locations at all | File identity attached to each parse tree (CLI already runs several files) |
| Console input while suspended | No | Defined interaction between `input()` and the paused state |

## Proposed design (only if debugging is prioritized)

1. **Interpreter change (separate repo, backward compatible, hooks off by
   default):** a `DebugHook` interface invoked on statement entry/exit and
   function entry/exit, carrying file id, start/end line+column, the current
   `Scope` chain, and a frame list; a `DebugMain` entry point that speaks a
   small JSON event protocol over stdio or a socket (breakpoint verification,
   stopped/stepped events, stack/variables/evaluate requests).
2. **Extension change (this repo):** a `DebugAdapter` implementation of the
   Debug Adapter Protocol (e.g. with `@vscode/debugadapter`), `debuggers`
   + `breakpoints` contributions, a `tinylang` launch configuration type,
   spawning `java … DebugMain`, and UTF-16 column mapping shared with the
   existing parser. JDI/JPDA attachment is explicitly out of scope: it
   debugs the interpreter, not the Tiny program.
3. **Acceptance before claiming support:** breakpoints hit at the right
   line in `.english` and `.hindi` files, step over/into/out, Hindi
   identifiers in the variables view, `input()` usable while debugging,
   and multi-file runs attributing frames to the right file.

## Recommendation

Defer. Debugging is the largest remaining work item, spans two
repositories, and has no user demand recorded yet. Keep the extension's
run/diagnose workflow as the supported story; revisit when the interpreter
maintainers agree on the hook design above. Do not add `debuggers`,
`breakpoints`, or launch-config contributions until then — their presence
alone implies support we do not have.
