import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { assertFilterTimestamp } from '../../lib/date';
import { toolErrorResult } from '../../lib/errors';
import type { GoogleTasksProvider } from '../../providers/google-tasks';
import { TaskSchema, TasksListResponseSchema } from '../../providers/google-tasks/types';
import { resolveTaskListId } from '../common';

export function registerTaskReadTools(server: McpServer, provider: GoogleTasksProvider): void {
  // ---- list_tasks ----
  server.registerTool(
    'list_tasks',
    {
      title: 'List active tasks in a list',
      description: [
        'List tasks in a task list. Defaults show active + completed tasks but HIDE tasks that',
        'were removed via `clear_completed` (those have `hidden=true`).',
        '',
        'To see recently completed and cleared tasks, use `list_completed` instead — that tool',
        'flips the hidden filter for you. To inspect deleted tombstones, pass `showDeleted=true`.',
        '',
        "If `taskListId` is omitted, Google's `@default` list is used. For write paths, resolve",
        'via `list_tasklists` first.',
      ].join('\n'),
      inputSchema: {
        taskListId: z.string().optional(),
        showCompleted: z
          .boolean()
          .describe('Default true. Include completed (non-hidden) tasks.')
          .optional(),
        showHidden: z
          .boolean()
          .describe('Default false. `clear_completed` sets hidden=true.')
          .optional(),
        showDeleted: z.boolean().describe('Default false. Include tombstoned tasks.').optional(),
        dueMin: z.string().describe('YYYY-MM-DD or RFC3339. Filter by due.').optional(),
        dueMax: z.string().describe('YYYY-MM-DD or RFC3339.').optional(),
        updatedMin: z.string().describe('RFC3339. Only tasks updated after this.').optional(),
        maxResults: z.number().int().min(1).max(100).optional(),
        pageToken: z.string().optional(),
      },
      outputSchema: TasksListResponseSchema.shape,
    },
    async (input) => {
      try {
        const taskListId = resolveTaskListId(input.taskListId);
        const dueMin = input.dueMin ? assertFilterTimestamp(input.dueMin, 'dueMin') : undefined;
        const dueMax = input.dueMax ? assertFilterTimestamp(input.dueMax, 'dueMax') : undefined;
        const updatedMin = input.updatedMin
          ? assertFilterTimestamp(input.updatedMin, 'updatedMin')
          : undefined;
        const data = await provider.listTasks({
          taskListId,
          showCompleted: input.showCompleted,
          showHidden: input.showHidden,
          showDeleted: input.showDeleted,
          dueMin,
          dueMax,
          updatedMin,
          maxResults: input.maxResults,
          pageToken: input.pageToken,
        });
        return {
          structuredContent: data,
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      } catch (err) {
        return toolErrorResult(err);
      }
    },
  );

  // ---- list_completed ----
  server.registerTool(
    'list_completed',
    {
      title: 'List completed tasks (including cleared/hidden)',
      description: [
        'List completed tasks, including those that were cleared away by `clear_completed`',
        '(which sets `hidden=true` — those do NOT show up in `list_tasks`).',
        '',
        'Use this when the user asks to see what they finished. Pass `completedMin` /',
        '`completedMax` (RFC3339) to narrow to a window.',
      ].join('\n'),
      inputSchema: {
        taskListId: z.string().optional(),
        completedMin: z.string().describe('RFC3339. Tasks completed after this.').optional(),
        completedMax: z.string().describe('RFC3339. Tasks completed before this.').optional(),
        maxResults: z.number().int().min(1).max(100).optional(),
        pageToken: z.string().optional(),
      },
      outputSchema: TasksListResponseSchema.shape,
    },
    async (input) => {
      try {
        const taskListId = resolveTaskListId(input.taskListId);
        const completedMin = input.completedMin
          ? assertFilterTimestamp(input.completedMin, 'completedMin')
          : undefined;
        const completedMax = input.completedMax
          ? assertFilterTimestamp(input.completedMax, 'completedMax')
          : undefined;
        const data = await provider.listTasks({
          taskListId,
          showCompleted: true,
          showHidden: true,
          showDeleted: false,
          completedMin,
          completedMax,
          maxResults: input.maxResults,
          pageToken: input.pageToken,
        });
        return {
          structuredContent: data,
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      } catch (err) {
        return toolErrorResult(err);
      }
    },
  );

  // ---- get_task ----
  server.registerTool(
    'get_task',
    {
      title: 'Get a single task',
      description:
        "Fetch a single task's full fields (notes, links, webViewLink, etag). Useful before an `update_task` when you need to preserve existing notes.",
      inputSchema: {
        taskListId: z.string().optional(),
        taskId: z.string(),
      },
      outputSchema: TaskSchema.shape,
    },
    async ({ taskListId, taskId }) => {
      try {
        const listId = resolveTaskListId(taskListId);
        const data = await provider.getTask(listId, taskId);
        return {
          structuredContent: data,
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        };
      } catch (err) {
        return toolErrorResult(err);
      }
    },
  );
}
