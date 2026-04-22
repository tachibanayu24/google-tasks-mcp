import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GoogleTasksProvider } from '../providers/google-tasks';
import { registerTaskListTools } from './tasklists';
import { registerTaskReadTools } from './tasks/read';
import { registerTaskWriteTools } from './tasks/write';

export function registerAllTools(server: McpServer, provider: GoogleTasksProvider): void {
  registerTaskListTools(server, provider);
  registerTaskReadTools(server, provider);
  registerTaskWriteTools(server, provider);
}
