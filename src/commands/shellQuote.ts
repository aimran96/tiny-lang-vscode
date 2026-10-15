/**
 * Shell-safe command-line construction.
 *
 * VS Code-free so it can be unit-tested in plain Node (`scripts/smoke.js`).
 *
 * Two PowerShell facts shape this builder (both verified against real shells):
 * 1. An *unquoted* `-Dfile.encoding=UTF-8` is re-split into `-Dfile` +
 *    `.encoding=UTF-8` ("Could not find or load main class .encoding=UTF-8").
 * 2. A *quoted* executable without the `&` call operator is a parse error
 *    (`"java" "…"` → "Unexpected token"), while `& "java" "…"` works —
 *    including for spaced install paths. cmd/sh accept fully-quoted lines
 *    as-is, so only PowerShell gets the `& ` prefix.
 */

export function quoteArg(arg: string): string {
  // Escape characters special inside double quotes, then wrap. The backslash
  // escapes are understood by PowerShell and harmless in cmd/sh for the
  // plain paths and flags we actually pass.
  return `"${arg.replace(/(["\\$`])/g, '\\$1')}"`;
}

export function buildCommandLine(argv: string[], opts?: { powershell?: boolean }): string {
  const line = argv.map(quoteArg).join(' ');
  return opts?.powershell ? `& ${line}` : line;
}
