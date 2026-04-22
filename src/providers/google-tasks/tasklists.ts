import type { GoogleTasksClient } from './client';
import {
  type TaskList,
  TaskListSchema,
  type TaskListsListResponse,
  TaskListsListResponseSchema,
} from './types';

export function listTaskLists(client: GoogleTasksClient): Promise<TaskListsListResponse> {
  return client.requestJson(TaskListsListResponseSchema, {
    path: '/users/@me/lists',
    method: 'GET',
  });
}

export function getTaskList(client: GoogleTasksClient, taskListId: string): Promise<TaskList> {
  return client.requestJson(TaskListSchema, {
    path: `/users/@me/lists/${encodeURIComponent(taskListId)}`,
    method: 'GET',
  });
}

export function createTaskList(client: GoogleTasksClient, title: string): Promise<TaskList> {
  return client.requestJson(TaskListSchema, {
    path: '/users/@me/lists',
    method: 'POST',
    jsonBody: { title },
  });
}

export function updateTaskList(
  client: GoogleTasksClient,
  taskListId: string,
  title: string,
): Promise<TaskList> {
  return client.requestJson(TaskListSchema, {
    path: `/users/@me/lists/${encodeURIComponent(taskListId)}`,
    method: 'PATCH',
    jsonBody: { title },
  });
}

export function deleteTaskList(client: GoogleTasksClient, taskListId: string): Promise<void> {
  return client.requestVoid({
    path: `/users/@me/lists/${encodeURIComponent(taskListId)}`,
    method: 'DELETE',
  });
}
