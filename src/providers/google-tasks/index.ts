import type { Env } from '../../env';
import { GoogleTasksClient } from './client';
import {
  createTaskList,
  deleteTaskList,
  getTaskList,
  listTaskLists,
  updateTaskList,
} from './tasklists';
import {
  type CreateTaskParams,
  clearCompleted,
  createTask,
  deleteTask,
  getTask,
  type ListTasksParams,
  listTasks,
  type MoveTaskParams,
  moveTask,
  type PatchTaskParams,
  patchTask,
} from './tasks';
import type { Task, TaskList, TaskListsListResponse, TasksListResponse } from './types';

export class GoogleTasksProvider {
  private readonly client: GoogleTasksClient;

  constructor(env: Env) {
    this.client = new GoogleTasksClient(env);
  }

  // ---------- TaskLists ----------
  listTaskLists(): Promise<TaskListsListResponse> {
    return listTaskLists(this.client);
  }
  getTaskList(taskListId: string): Promise<TaskList> {
    return getTaskList(this.client, taskListId);
  }
  createTaskList(title: string): Promise<TaskList> {
    return createTaskList(this.client, title);
  }
  updateTaskList(taskListId: string, title: string): Promise<TaskList> {
    return updateTaskList(this.client, taskListId, title);
  }
  deleteTaskList(taskListId: string): Promise<void> {
    return deleteTaskList(this.client, taskListId);
  }

  // ---------- Tasks ----------
  listTasks(params: ListTasksParams): Promise<TasksListResponse> {
    return listTasks(this.client, params);
  }
  getTask(taskListId: string, taskId: string): Promise<Task> {
    return getTask(this.client, taskListId, taskId);
  }
  createTask(params: CreateTaskParams): Promise<Task> {
    return createTask(this.client, params);
  }
  patchTask(params: PatchTaskParams): Promise<Task> {
    return patchTask(this.client, params);
  }
  moveTask(params: MoveTaskParams): Promise<Task> {
    return moveTask(this.client, params);
  }
  deleteTask(taskListId: string, taskId: string): Promise<void> {
    return deleteTask(this.client, taskListId, taskId);
  }
  clearCompleted(taskListId: string): Promise<void> {
    return clearCompleted(this.client, taskListId);
  }
}
