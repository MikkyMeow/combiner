import { loadDatabase, saveDatabase, type ProjectRow } from "./db";
import { DEFAULT_TASK_STATUS, buildTaskStatusList } from "./taskStatus";

export type ProjectRecord = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  owner: string;
  members: string[];
  visibility: "private" | "corporate";
  taskStatuses: string[];
};

export type ProjectSortField = "title" | "visibility";
export type ProjectSortOrder = "asc" | "desc";

const mapRow = (row: ProjectRow): ProjectRecord => ({
  id: row.id,
  title: row.title,
  description: row.description,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  owner: row.username,
  members: [...row.members],
  visibility: row.visibility,
  taskStatuses: [...row.taskStatuses]
});

const userHasAccessToRow = (username: string, row: ProjectRow): boolean =>
  row.username === username || row.members.includes(username);

export const listProjects = (
  username: string,
  search?: string,
  visibility?: ProjectRecord["visibility"][],
  sortField?: ProjectSortField | null,
  sortOrder?: ProjectSortOrder
): ProjectRecord[] => {
  const state = loadDatabase();
  const normalizedSearch = search?.trim().toLowerCase();
  const filtered = state.projects
    .filter((project) => userHasAccessToRow(username, project))
    .filter((project) => {
      if (!visibility || visibility.length === 0) {
        return true;
      }
      return visibility.includes(project.visibility);
    })
    .filter((project) => {
      if (!normalizedSearch) {
        return true;
      }
      const title = project.title.toLowerCase();
      const description = project.description.toLowerCase();
      return title.includes(normalizedSearch) || description.includes(normalizedSearch);
    });

  const entries = filtered.slice();
  const sorted = entries.sort((a, b) => {
    if (!sortField) {
      return b.createdAt.localeCompare(a.createdAt);
    }
    const aValue =
      sortField === "visibility" ? a.visibility : a.title.toLowerCase();
    const bValue =
      sortField === "visibility" ? b.visibility : b.title.toLowerCase();
    const comparison = aValue.localeCompare(bValue);
    const direction = sortOrder === "desc" ? -1 : 1;
    return comparison * direction;
  });

  return sorted.map(mapRow);
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

export const addProjectTaskStatus = (
  projectId: string,
  status: string
): ProjectRecord | null => {
  const state = loadDatabase();
  const target = state.projects.find((entry) => entry.id === projectId);
  if (!target) {
    return null;
  }
  target.taskStatuses = buildTaskStatusList([
    ...(target.taskStatuses ?? []),
    status
  ]);
  target.updatedAt = new Date().toISOString();
  saveDatabase(state);
  return mapRow(target);
};

export const removeProjectTaskStatus = (
  projectId: string,
  status: string
): ProjectRecord | null => {
  const state = loadDatabase();
  const target = state.projects.find((entry) => entry.id === projectId);
  if (!target) {
    return null;
  }
  const normalized = status.trim().toLowerCase();
  const nextStatuses = (target.taskStatuses ?? []).filter(
    (entry) => entry.toLowerCase() !== normalized
  );
  target.taskStatuses = buildTaskStatusList(nextStatuses);
  target.updatedAt = new Date().toISOString();

  state.tasks = state.tasks.map((task) => {
    if (task.projectId !== projectId) {
      return task;
    }
    if (task.status.toLowerCase() !== normalized) {
      return task;
    }
    return {
      ...task,
      status: target.taskStatuses[0] ?? DEFAULT_TASK_STATUS,
      updatedAt: new Date().toISOString()
    };
  });

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
