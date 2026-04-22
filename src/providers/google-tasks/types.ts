import { z } from 'zod';

export const TaskListSchema = z.object({
  kind: z.literal('tasks#taskList').optional(),
  id: z.string(),
  title: z.string(),
  updated: z.string(),
  etag: z.string().optional(),
  selfLink: z.string().optional(),
});
export type TaskList = z.infer<typeof TaskListSchema>;

export const TaskLinkSchema = z.object({
  type: z.string(),
  description: z.string().optional(),
  link: z.string(),
});

export const TaskStatus = z.enum(['needsAction', 'completed']);
export type TaskStatusT = z.infer<typeof TaskStatus>;

export const TaskSchema = z.object({
  kind: z.literal('tasks#task').optional(),
  id: z.string(),
  title: z.string(),
  notes: z.string().optional(),
  status: TaskStatus,
  due: z.string().optional(),
  completed: z.string().optional(),
  updated: z.string(),
  position: z.string().optional(),
  parent: z.string().optional(),
  hidden: z.boolean().optional(),
  deleted: z.boolean().optional(),
  etag: z.string().optional(),
  selfLink: z.string().optional(),
  webViewLink: z.string().optional(),
  links: z.array(TaskLinkSchema).optional(),
  assignmentInfo: z
    .object({
      linkToTask: z.string().optional(),
      surfaceType: z.string().optional(),
    })
    .passthrough()
    .optional(),
});
export type Task = z.infer<typeof TaskSchema>;

export const TaskListsListResponseSchema = z.object({
  kind: z.literal('tasks#taskLists').optional(),
  etag: z.string().optional(),
  items: z.array(TaskListSchema).default([]),
  nextPageToken: z.string().optional(),
});

export const TasksListResponseSchema = z.object({
  kind: z.literal('tasks#tasks').optional(),
  etag: z.string().optional(),
  items: z.array(TaskSchema).default([]),
  nextPageToken: z.string().optional(),
});

export type TasksListResponse = z.infer<typeof TasksListResponseSchema>;
export type TaskListsListResponse = z.infer<typeof TaskListsListResponseSchema>;
