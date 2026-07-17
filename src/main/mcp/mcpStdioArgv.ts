/** True when this process should run as stdio MCP bridge (no GUI). */
export function isMcpStdioArgv(argv: readonly string[] = process.argv): boolean {
  return argv.includes('--mcp');
}
