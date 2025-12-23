import { loadDatabase, saveDatabase } from "./db";

type ProjectRow = {
  id: string;
  username: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  members: string[];
};

export type ProjectRecord = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  owner: string;
  members: string[];
};

const mapRow = (row: ProjectRow): ProjectRecord => ({
  id: row.id,
  title: row.title,
  description: row.description,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  owner: row.username,
  members: [...row.members]
});

const userHasAccessToRow = (username: string, row: ProjectRow): boolean =>
  row.username === username || row.members.includes(username);

export const listProjects = (username: string): ProjectRecord[] => {
  const state = loadDatabase();
  return state.projects
    .filter((project) => userHasAccessToRow(username, project))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(mapRow);
};

export const findProjectById = (projectId: string): ProjectRecord | null => {
  const state = loadDatabase();
  const project = state.projects.find((entry) => entry.id === projectId);
  return project ? mapRow(project) : null;
};

export const findProjectForUser = (username: string, projectId: string): ProjectRecord | null => {
  const state = loadDatabase();
  const project = state.projects.find((entry) => entry.id === projectId);
  if (!project) {
    return null;
  }
  if (!userHasAccessToRow(username, project)) {
    return null;
  }
  return mapRow(project);
};

export const insertProject = (username: string, project: ProjectRecord): ProjectRecord => {
  const state = loadDatabase();
  state.projects.unshift({
    ...project,
    username,
    members: project.members ?? []
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
  projectId: string,
  payload: ProjectUpdatePayload
): ProjectRecord | null => {
  const state = loadDatabase();
  const target = state.projects.find((entry) => entry.id === projectId);
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

export const addProjectMember = (projectId: string, member: string): ProjectRecord | null => {
  const state = loadDatabase();
  const target = state.projects.find((entry) => entry.id === projectId);
  if (!target) {
    return null;
  }
  if (!target.members.includes(member)) {
    target.members.push(member);
  }
  target.updatedAt = new Date().toISOString();
  saveDatabase(state);
  return mapRow(target);
};

export const deleteProject = (projectId: string): boolean => {
  const state = loadDatabase();
  const existingCount = state.projects.length;
  state.projects = state.projects.filter((entry) => entry.id !== projectId);
  if (state.projects.length === existingCount) {
    return false;
  }

  state.tasks = state.tasks.map((task) =>
    task.projectId === projectId ? { ...task, projectId: null } : task
  );
  saveDatabase(state);
  return true;
};
