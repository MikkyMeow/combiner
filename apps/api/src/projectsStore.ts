import { loadDatabase, saveDatabase } from "./db";

export type ProjectRecord = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

const mapRow = (row: { title: string; description: string; id: string; createdAt: string; updatedAt: string }): ProjectRecord => ({
  id: row.id,
  title: row.title,
  description: row.description,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
});

export const listProjects = (username: string): ProjectRecord[] => {
  const state = loadDatabase();
  return state.projects
    .filter((project) => project.username === username)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(mapRow);
};

export const findProjectById = (username: string, projectId: string): ProjectRecord | null => {
  const state = loadDatabase();
  const project = state.projects.find((entry) => entry.username === username && entry.id === projectId);
  return project ? mapRow(project) : null;
};

export const insertProject = (username: string, project: ProjectRecord): ProjectRecord => {
  const state = loadDatabase();
  state.projects.unshift({
    ...project,
    username
  });
  saveDatabase(state);
  return project;
};

type ProjectUpdatePayload = {
  title?: string;
  description?: string;
  updatedAt: string;
};

export const updateProject = (
  username: string,
  projectId: string,
  payload: ProjectUpdatePayload
): ProjectRecord | null => {
  const state = loadDatabase();
  const target = state.projects.find((entry) => entry.username === username && entry.id === projectId);
  if (!target) {
    return null;
  }

  if (payload.title !== undefined) {
    target.title = payload.title;
  }

  if (payload.description !== undefined) {
    target.description = payload.description;
  }

  target.updatedAt = payload.updatedAt;
  saveDatabase(state);
  return mapRow(target);
};

export const deleteProject = (username: string, projectId: string): boolean => {
  const state = loadDatabase();
  const existingCount = state.projects.length;
  state.projects = state.projects.filter((entry) => !(entry.username === username && entry.id === projectId));
  if (state.projects.length === existingCount) {
    return false;
  }

  state.tasks = state.tasks.map((task) =>
    task.username === username && task.projectId === projectId ? { ...task, projectId: null } : task
  );
  saveDatabase(state);
  return true;
};
