import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { normalizeDue } from '../../lib/date';
import { toolErrorResult } from '../../lib/errors';
import type { GoogleTasksProvider } from '../../providers/google-tasks';
import { TaskSchema } from '../../providers/google-tasks/types';
import { resolveTaskListId } from '../common';

export function registerTaskWriteTools(server: McpServer, provider: GoogleTasksProvider): void {
  // ---- create_task ----
  server.registerTool(
    'create_task',
    {
      title: 'Create a task',
      description: [
        'Create a new task. `due` accepts YYYY-MM-DD or RFC3339; Google stores date-only',
        '(the time component is silently dropped — sending an RFC3339 only yields the date).',
        '',
        'Pass `parent` for a subtask (max 1 level — Google rejects sub-sub-tasks).',
        'Pass `previous` to place immediately after a specific sibling task.',
        '',
        '**Strongly recommended**: resolve `taskListId` via `list_tasklists` first — the',
        "default '@default' list is rarely what the user means when they name a specific list.",
      ].join('\n'),
      inputSchema: {
        taskListId: z.string().optional(),
        title: z.string().min(1),
        notes: z.string().optional(),
        due: z
          .string()
          .describe('YYYY-MM-DD or RFC3339. Time of day is dropped by Google.')
          .optional(),
        parent: z.string().describe('Parent task id for a subtask (1 level max).').optional(),
        previous: z
          .string()
          .describe('Place this task right after the given task id (same list).')
          .optional(),
      },
      outputSchema: TaskSchema.shape,
    },
    async (input) => {
      try {
        const taskListId = resolveTaskListId(input.taskListId);
        const due = input.due ? normalizeDue(input.due) : undefined;
        const data = await provider.createTask({
          taskListId,
          title: input.title,
          notes: input.notes,
          due,
          parent: input.parent,
          previous: input.previous,
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

  // ---- update_task ----
  server.registerTool(
    'update_task',
    {
      title: 'Update task fields (partial)',
      description: [
        'Partial update (PATCH). Only pass fields you want to change — omitted fields are',
        'preserved.',
        '',
        '**Do not use this to toggle completion** — use `complete_task` or `uncomplete_task`',
        'instead. Those handle the `completed` timestamp correctly and are clearer to the model.',
        '`status` is intentionally not exposed here.',
        '',
        '`due` accepts YYYY-MM-DD or RFC3339 (time-of-day is dropped by Google).',
      ].join('\n'),
      inputSchema: {
        taskListId: z.string().optional(),
        taskId: z.string(),
        title: z.string().optional(),
        notes: z.string().optional(),
        due: z.string().optional(),
      },
      outputSchema: TaskSchema.shape,
    },
    async (input) => {
      try {
        const taskListId = resolveTaskListId(input.taskListId);
        const due = input.due ? normalizeDue(input.due) : undefined;
        const data = await provider.patchTask({
          taskListId,
          taskId: input.taskId,
          title: input.title,
          notes: input.notes,
          due,
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

  // ---- complete_task ----
  server.registerTool(
    'complete_task',
    {
      title: 'Mark a task completed',
      description:
        'Set `status=completed`. Google auto-fills the `completed` timestamp. This is the right tool for "mark it done" / "complete the task".',
      inputSchema: {
        taskListId: z.string().optional(),
        taskId: z.string(),
      },
      outputSchema: TaskSchema.shape,
    },
    async ({ taskListId, taskId }) => {
      try {
        const listId = resolveTaskListId(taskListId);
        const data = await provider.patchTask({
          taskListId: listId,
          taskId,
          status: 'completed',
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

  // ---- uncomplete_task ----
  server.registerTool(
    'uncomplete_task',
    {
      title: 'Revert a task to needsAction',
      description:
        'Revert a completed task back to `status=needsAction`. Clears the `completed` timestamp. Use this when the user says "actually, I haven\'t finished X".',
      inputSchema: {
        taskListId: z.string().optional(),
        taskId: z.string(),
      },
      outputSchema: TaskSchema.shape,
    },
    async ({ taskListId, taskId }) => {
      try {
        const listId = resolveTaskListId(taskListId);
        const data = await provider.patchTask({
          taskListId: listId,
          taskId,
          status: 'needsAction',
          // Explicit null tells Google to wipe the `completed` timestamp.
          completed: null,
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

  // ---- move_task ----
  server.registerTool(
    'move_task',
    {
      title: 'Move / reorder a task',
      description: [
        'Reorder a task within its list, nest it under a parent, or move it across lists.',
        '',
        '- `previous`: place immediately after the given task id (siblings only).',
        '- `parent`: nest as a subtask (1 level only).',
        '- `destinationTasklist`: move to another list (task id may change).',
        '',
        'Recurring / assigned tasks (from Docs/Chat) cannot be moved across lists or',
        'become subtasks — Google returns 400 in those cases.',
      ].join('\n'),
      inputSchema: {
        taskListId: z.string().optional(),
        taskId: z.string(),
        parent: z.string().optional(),
        previous: z.string().optional(),
        destinationTasklist: z.string().optional(),
      },
      outputSchema: TaskSchema.shape,
    },
    async (input) => {
      try {
        const taskListId = resolveTaskListId(input.taskListId);
        const data = await provider.moveTask({
          taskListId,
          taskId: input.taskId,
          parent: input.parent,
          previous: input.previous,
          destinationTasklist: input.destinationTasklist,
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

  // ---- delete_task ----
  server.registerTool(
    'delete_task',
    {
      title: 'Permanently delete a task',
      description:
        'Permanently delete a single task. Irreversible. Use `clear_completed` instead if you only want to tidy up finished items (that is non-destructive — the tasks remain via `list_completed`).',
      inputSchema: {
        taskListId: z.string().optional(),
        taskId: z.string(),
      },
      outputSchema: {
        deleted: z.boolean(),
        taskId: z.string(),
      },
    },
    async ({ taskListId, taskId }) => {
      try {
        const listId = resolveTaskListId(taskListId);
        await provider.deleteTask(listId, taskId);
        return {
          structuredContent: { deleted: true, taskId },
          content: [{ type: 'text', text: `Deleted task ${taskId}.` }],
        };
      } catch (err) {
        return toolErrorResult(err);
      }
    },
  );

  // ---- clear_completed ----
  server.registerTool(
    'clear_completed',
    {
      title: 'Hide all completed tasks in a list',
      description: [
        'Hide (NOT delete) all completed tasks in the list. Google sets `hidden=true` on',
        'each — they disappear from `list_tasks` but are still retrievable via `list_completed`',
        '(which passes `showHidden=true`).',
        '',
        'This is the usual match for "clean up done items" / "clear the list".',
      ].join('\n'),
      inputSchema: {
        taskListId: z.string().optional(),
      },
      outputSchema: {
        cleared: z.boolean(),
        taskListId: z.string(),
      },
    },
    async ({ taskListId }) => {
      try {
        const listId = resolveTaskListId(taskListId);
        await provider.clearCompleted(listId);
        return {
          structuredContent: { cleared: true, taskListId: listId },
          content: [{ type: 'text', text: `Cleared completed tasks in ${listId}.` }],
        };
      } catch (err) {
        return toolErrorResult(err);
      }
    },
  );
}
