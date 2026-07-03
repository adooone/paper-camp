import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createGitManager } from '../app/server/git';
import { PAPER_CAMP_VERSION } from '../core/scaffold';
import { registerReadTools, registerWriteTools } from './tools';

/**
 * Boots the MCP server over stdio against `root`'s `papercamp/` project. Logs
 * go to stderr: stdout is reserved for the stdio JSON-RPC transport.
 */
export async function startMcpServer(root: string): Promise<void> {
  const server = new McpServer({
    name: 'paper-camp',
    version: PAPER_CAMP_VERSION,
  });
  // No SSE subscribers over stdio, so skip the fs watchers the dashboard uses
  // to push live status ticks.
  const git = createGitManager(root, { watch: false });
  registerReadTools(server, root);
  registerWriteTools(server, root, git);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`paper-camp mcp server running (stdio) against ${root}`);
}
