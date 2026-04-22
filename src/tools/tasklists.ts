import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { toolErrorResult } from '../lib/errors';
import type { GoogleTasksProvider } from '../providers/google-tasks';
import { TaskListSchema, TaskListsListResponseSchema } from '../providers/google-tasks/types';

export function registerTaskListTools(server: McpServer, provider: GoogleTasksProvider): void {
  // ---- list_tasklists ----
  server.registerTool(
    'list_tasklists',
    {
      title: 'List all Google Tasks lists',
      description:
        'Returns all Google Tasks lists for the authenticated user (id + title + updated). ' +
        "Start here when the user refers to a list by name and you need the id; most other tools accept a `taskListId` but fall back to '@default' if omitted.",
      inputSchema: {},
      outputSchema: TaskListsListResponseSchema.shape,
    },
    async () => {
      try {
        const data = await provider.listTaskLists();
        return {
          structuredContent: data,
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      } catch (err) {
        return toolErrorResult(err);
      }
    },
  );

  // ---- get_tasklist ----
  server.registerTool(
    'get_tasklist',
    {
      title: 'Get a single task list',
      description:
        "Fetch one task list's metadata (title, updated, etag). Rarely needed — prefer `list_tasklists` unless you specifically want this list's etag or id resolution confirmation.",
      inputSchema: {
        taskListId: z.string().describe('Task list id. Use `list_tasklists` to discover.'),
      },
      outputSchema: TaskListSchema.shape,
    },
    async ({ taskListId }) => {
      try {
        const data = await provider.getTaskList(taskListId);
        return {
          structuredContent: data,
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      } catch (err) {
        return toolErrorResult(err);
      }
    },
  );

  // ---- create_tasklist ----
  server.registerTool(
    'create_tasklist',
    {
      title: 'Create a new task list',
      description:
        'Create a new Google Tasks list. Returns the new list with its id — pass that id to `create_task` to add tasks to it.',
      inputSchema: {
        title: z.string().min(1).describe('List title (max 1024 chars).'),
      },
      outputSchema: TaskListSchema.shape,
    },
    async ({ title }) => {
      try {
        const data = await provider.createTaskList(title);
        return {
          structuredContent: data,
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      } catch (err) {
        return toolErrorResult(err);
      }
    },
  );

  // ---- update_tasklist ----
  server.registerTool(
    'update_tasklist',
    {
      title: 'Rename a task list',
      description: 'Rename a task list. Title is the only mutable field on a Google Tasks list.',
      inputSchema: {
        taskListId: z.string(),
        title: z.string().min(1),
      },
      outputSchema: TaskListSchema.shape,
    },
    async ({ taskListId, title }) => {
      try {
        const data = await provider.updateTaskList(taskListId, title);
        return {
          structuredContent: data,
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      } catch (err) {
        return toolErrorResult(err);
      }
    },
  );

  // ---- delete_tasklist ----
  server.registerTool(
    'delete_tasklist',
    {
      title: 'Delete a task list',
      description:
        'Delete a task list AND all the tasks it contains. Irreversible — Google does not offer restore.',
      inputSchema: {
        taskListId: z.string(),
      },
      outputSchema: {
        deleted: z.boolean(),
        taskListId: z.string(),
      },
    },
    async ({ taskListId }) => {
      try {
        await provider.deleteTaskList(taskListId);
        return {
          structuredContent: { deleted: true, taskListId },
          content: [{ type: 'text', text: `Deleted task list ${taskListId}.` }],
        };
      } catch (err) {
        return toolErrorResult(err);
      }
    },
  );
}
