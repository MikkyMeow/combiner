import { loadDatabase, saveDatabase, type TaskRow } from "./db";
import { TASK_STATUSES, type TaskStatus } from "./taskStatus";

export type TaskRecord = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  comments: string[];
  status: TaskStatus;
  projectId: string | null;
  assignee: string | null;
  priority: string | null;
  dueDate: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskSortField = "title" | "status";
export type TaskSortOrder = "asc" | "desc";

const mapRow = (row: TaskRow): TaskRecord => ({
  id: row.id,
  title: row.title,
  description: row.description,
  tags: row.tags ?? [],
  comments: row.comments ?? [],
  status: row.status,
  projectId: row.projectId,
  assignee: row.assignee,
  priority: row.priority,
  dueDate: row.dueDate,
  createdBy: row.createdBy ?? row.username,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
});

export const listTasks = (
  username: string,
  search?: string,
  status?: TaskStatus[],
  sortField?: TaskSortField | null,
  sortOrder?: TaskSortOrder
): TaskRecord[] => {
  const state = loadDatabase();
  const accessibleProjectIds = new Set(
    state.projects
      .filter((project) => project.username === username || project.members.includes(username))
      .map((project) => project.id)
  );
  const normalizedSearch = search?.trim().toLowerCase();
  const filtered = state.tasks
    .filter((task) => task.projectId !== null && accessibleProjectIds.has(task.projectId))
    .filter((task) => {
      if (!status || status.length === 0) {
        return true;
      }
      return status.includes(task.status);
    })
    .filter((task) => {
      if (!normalizedSearch) {
        return true;
      }
      const title = task.title.toLowerCase();
      const description = task.description.toLowerCase();
      return title.includes(normalizedSearch) || description.includes(normalizedSearch);
    });

  const entries = filtered.slice();
  const sorted = entries.sort((a, b) => {
    if (!sortField) {
      return b.createdAt.localeCompare(a.createdAt);
    }
    const aValue =
      sortField === "status" ? a.status : a.title.toLowerCase();
    const bValue =
      sortField === "status" ? b.status : b.title.toLowerCase();
    if (sortField === "status") {
      const aIndex = TASK_STATUSES.indexOf(a.status);
      const bIndex = TASK_STATUSES.indexOf(b.status);
      if (aIndex !== bIndex) {
        const direction = sortOrder === "desc" ? -1 : 1;
        return (aIndex - bIndex) * direction;
      }
    }
    const comparison = aValue.localeCompare(bValue);
    const direction = sortOrder === "desc" ? -1 : 1;
    return comparison * direction;
  });

  return sorted.map(mapRow);
};

export const findTasksForProject = (
  projectId: string,
  search?: string,
  status?: TaskStatus[],
  tags?: string[],
  sortField?: TaskSortField | null,
  sortOrder?: TaskSortOrder
): TaskRecord[] => {
  const state = loadDatabase();
  const normalizedSearch = search?.trim().toLowerCase();
  const normalizedTags = tags?.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  const filtered = state.tasks
    .filter((task) => task.projectId === projectId)
    .filter((task) => {
      if (!status || status.length === 0) {
        return true;
      }
      return status.includes(task.status);
    })
    .filter((task) => {
      if (!normalizedTags || normalizedTags.length === 0) {
        return true;
      }
      const taskTags = (task.tags ?? []).map((tag) => tag.toLowerCase());
      return normalizedTags.some((needle) =>
        taskTags.some((tag) => tag.includes(needle))
      );
    })
    .filter((task) => {
      if (!normalizedSearch) {
        return true;
      }
      const title = task.title.toLowerCase();
      const description = task.description.toLowerCase();
      return title.includes(normalizedSearch) || description.includes(normalizedSearch);
    });

  const entries = filtered.slice();
  const sorted = entries.sort((a, b) => {
    if (!sortField) {
      return b.createdAt.localeCompare(a.createdAt);
    }
    const aValue =
      sortField === "status" ? a.status : a.title.toLowerCase();
    const bValue =
      sortField === "status" ? b.status : b.title.toLowerCase();
    if (sortField === "status") {
      const aIndex = TASK_STATUSES.indexOf(a.status);
      const bIndex = TASK_STATUSES.indexOf(b.status);
      if (aIndex !== bIndex) {
        const direction = sortOrder === "desc" ? -1 : 1;
        return (aIndex - bIndex) * direction;
      }
    }
    const comparison = aValue.localeCompare(bValue);
    const direction = sortOrder === "desc" ? -1 : 1;
    return comparison * direction;
  });

  return sorted.map(mapRow);
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
  tags?: string[];
  comments?: string[];
  status?: TaskStatus;
  projectId?: string | null;
  assignee?: string | null;
  priority?: string | null;
  dueDate?: string | null;
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

  if (payload.tags !== undefined) {
    target.tags = payload.tags;
  }

  if (payload.comments !== undefined) {
    target.comments = payload.comments;
  }

  if (payload.status !== undefined) {
    target.status = payload.status;
  }

  if (payload.projectId !== undefined) {
    target.projectId = payload.projectId;
  }

  if (payload.assignee !== undefined) {
    target.assignee = payload.assignee;
  }

  if (payload.priority !== undefined) {
    target.priority = payload.priority;
  }

  if (payload.dueDate !== undefined) {
    target.dueDate = payload.dueDate;
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
