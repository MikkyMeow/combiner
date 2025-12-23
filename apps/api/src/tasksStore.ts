import { loadDatabase, saveDatabase } from "./db";

export type TaskRecord = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
};

const mapRow = (row: {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  completed: row.completed,
  projectId: row.projectId,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
});

export const listTasks = (username: string): TaskRecord[] => {
  const state = loadDatabase();
  return state.tasks
    .filter((task) => task.username === username)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(mapRow);
};

export const findTasksForProject = (username: string, projectId: string): TaskRecord[] => {
  const state = loadDatabase();
  return state.tasks
    .filter((task) => task.username === username && task.projectId === projectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(mapRow);
};

export const findTaskById = (username: string, taskId: string): TaskRecord | null => {
  const state = loadDatabase();
  const task = state.tasks.find((entry) => entry.username === username && entry.id === taskId);
  return task ? mapRow(task) : null;
};

export const insertTask = (username: string, task: TaskRecord): TaskRecord => {
  const state = loadDatabase();
  state.tasks.unshift({
    ...task,
    username
  });
  saveDatabase(state);
  return task;
};

type TaskUpdatePayload = {
  title?: string;
  description?: string;
  completed?: boolean;
  projectId?: string | null;
  updatedAt: string;
};

export const updateTask = (
  username: string,
  taskId: string,
  payload: TaskUpdatePayload
): TaskRecord | null => {
  const state = loadDatabase();
  const target = state.tasks.find((entry) => entry.username === username && entry.id === taskId);
  if (!target) {
    return null;
  }

  if (payload.title !== undefined) {
    target.title = payload.title;
  }

  if (payload.description !== undefined) {
    target.description = payload.description;
  }

  if (typeof payload.completed === "boolean") {
    target.completed = payload.completed;
  }

  if (payload.projectId !== undefined) {
    target.projectId = payload.projectId;
  }

  target.updatedAt = payload.updatedAt;
  saveDatabase(state);
  return mapRow(target);
};

export const deleteTask = (username: string, taskId: string): boolean => {
  const state = loadDatabase();
  const existingCount = state.tasks.length;
  state.tasks = state.tasks.filter((entry) => !(entry.username === username && entry.id === taskId));
  if (state.tasks.length === existingCount) {
    return false;
  }
  saveDatabase(state);
  return true;
};
