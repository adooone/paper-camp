import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { PAPER_CAMP_VERSION } from '../core/scaffold';
import { registerReadTools } from './tools';

/**
 * Boots the MCP server over stdio against `root`'s `papercamp/` project. Write
 * tool registration lands in a later phase. Logs go to stderr: stdout is
 * reserved for the stdio JSON-RPC transport.
 */
export async function startMcpServer(root: string): Promise<void> {
  const server = new McpServer({
    name: 'paper-camp',
    version: PAPER_CAMP_VERSION,
  });
  registerReadTools(server, root);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`paper-camp mcp server running (stdio) against ${root}`);
}
