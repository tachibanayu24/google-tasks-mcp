import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from './env';
import { GoogleTasksProvider } from './providers/google-tasks';
import { registerAllTools } from './tools';

export function buildServer(env: Env): McpServer {
  const server = new McpServer({
    name: 'google-tasks-mcp',
    version: '0.1.0',
  });
  const provider = new GoogleTasksProvider(env);
  registerAllTools(server, provider);
  return server;
}
