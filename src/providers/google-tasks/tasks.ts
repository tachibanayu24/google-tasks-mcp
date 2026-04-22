import type { GoogleTasksClient } from './client';
import { type Task, TaskSchema, type TasksListResponse, TasksListResponseSchema } from './types';

export type ListTasksParams = {
  taskListId: string;
  showCompleted?: boolean;
  showHidden?: boolean;
  showDeleted?: boolean;
  completedMin?: string;
  completedMax?: string;
  dueMin?: string;
  dueMax?: string;
  updatedMin?: string;
  maxResults?: number;
  pageToken?: string;
};

export function listTasks(
  client: GoogleTasksClient,
  params: ListTasksParams,
): Promise<TasksListResponse> {
  const { taskListId, ...query } = params;
  return client.requestJson(TasksListResponseSchema, {
    path: `/lists/${encodeURIComponent(taskListId)}/tasks`,
    method: 'GET',
    query,
  });
}

export function getTask(
  client: GoogleTasksClient,
  taskListId: string,
  taskId: string,
): Promise<Task> {
  return client.requestJson(TaskSchema, {
    path: `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    method: 'GET',
  });
}

export type CreateTaskParams = {
  taskListId: string;
  title: string;
  notes?: string;
  due?: string;
  parent?: string;
  previous?: string;
};

export function createTask(client: GoogleTasksClient, params: CreateTaskParams): Promise<Task> {
  const { taskListId, parent, previous, ...body } = params;
  return client.requestJson(TaskSchema, {
    path: `/lists/${encodeURIComponent(taskListId)}/tasks`,
    method: 'POST',
    query: { parent, previous },
    jsonBody: body,
  });
}

export type PatchTaskParams = {
  taskListId: string;
  taskId: string;
  title?: string;
  notes?: string;
  due?: string;
  status?: 'needsAction' | 'completed';
  /**
   * Must be set to null explicitly when unsetting `completed` so that
   * Google knows to wipe it. Handled by the caller.
   */
  completed?: string | null;
};

export function patchTask(client: GoogleTasksClient, params: PatchTaskParams): Promise<Task> {
  const { taskListId, taskId, ...body } = params;
  return client.requestJson(TaskSchema, {
    path: `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    method: 'PATCH',
    jsonBody: body,
  });
}

export type MoveTaskParams = {
  taskListId: string;
  taskId: string;
  parent?: string;
  previous?: string;
  destinationTasklist?: string;
};

export function moveTask(client: GoogleTasksClient, params: MoveTaskParams): Promise<Task> {
  const { taskListId, taskId, parent, previous, destinationTasklist } = params;
  return client.requestJson(TaskSchema, {
    path: `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}/move`,
    method: 'POST',
    query: { parent, previous, destinationTasklist },
  });
}

export function deleteTask(
  client: GoogleTasksClient,
  taskListId: string,
  taskId: string,
): Promise<void> {
  return client.requestVoid({
    path: `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(taskId)}`,
    method: 'DELETE',
  });
}

export function clearCompleted(client: GoogleTasksClient, taskListId: string): Promise<void> {
  return client.requestVoid({
    path: `/lists/${encodeURIComponent(taskListId)}/clear`,
    method: 'POST',
  });
}
