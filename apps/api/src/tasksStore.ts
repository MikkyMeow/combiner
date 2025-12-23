import { loadDatabase, saveDatabase, type TaskRow } from "./db";

export type TaskRecord = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  projectId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

const mapRow = (row: TaskRow): TaskRecord => ({
  id: row.id,
  title: row.title,
  description: row.description,
  completed: row.completed,
  projectId: row.projectId,
  createdBy: row.createdBy ?? row.username,
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

export const findTasksForProject = (projectId: string): TaskRecord[] => {
  const state = loadDatabase();
  return state.tasks
    .filter((task) => task.projectId === projectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(mapRow);
};

export const findTaskRowById = (taskId: string): TaskRow | null => {
  const state = loadDatabase();
  return state.tasks.find((entry) => entry.id === taskId) ?? null;
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

export const updateTask = (taskId: string, payload: TaskUpdatePayload): TaskRecord | null => {
  const state = loadDatabase();
  const target = state.tasks.find((entry) => entry.id === taskId);
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

export const deleteTask = (taskId: string): boolean => {
  const state = loadDatabase();
  const existingCount = state.tasks.length;
  state.tasks = state.tasks.filter((entry) => entry.id !== taskId);
  if (state.tasks.length === existingCount) {
    return false;
  }
  saveDatabase(state);
  return true;
};
