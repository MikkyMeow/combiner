import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "crypto";
import { findProjectForUser } from "./projectsStore";
import {
  deleteTask,
  findTaskRowById,
  insertTask,
  listTasks,
  type TaskSortField,
  type TaskSortOrder,
  type TaskRecord,
  updateTask
} from "./tasksStore";
import {
  DEFAULT_TASK_STATUS,
  TASK_STATUSES,
  isTaskStatus,
  type TaskStatus
} from "./taskStatus";

type TaskCreateBody = {
  title: string;
  projectId: string;
  assignee?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  tags?: string[];
  comments?: string[];
};

type TaskUpdateBody = {
  title?: string;
  description?: string;
  projectId?: string | null;
  status?: TaskStatus;
  assignee?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  tags?: string[];
  comments?: string[];
};

type TaskSortFieldValue = TaskSortField;
type TaskSortOrderValue = TaskSortOrder;

const normalizeOptionalText = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const normalizeTags = (value: string[]): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];
  value.forEach((entry) => {
    if (typeof entry !== "string") {
      return;
    }
    const trimmed = entry.trim();
    if (!trimmed) {
      return;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    normalized.push(trimmed);
  });
  return normalized;
};

const normalizeComments = (value: string[]): string[] => {
  return value
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const tasksRoutes: FastifyPluginAsync = async (server) => {
  const ensureAuthenticated = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!server.authenticate) {
      return reply.status(500).send({ message: "Authentication handler missing" });
    }
    await server.authenticate(request, reply);
  };

  const requireUser = (request: FastifyRequest, reply: FastifyReply) => {
    const username = request.user?.username;
    if (!username) {
      reply.status(401).send({ message: "Invalid token" });
      return null;
    }
    return username;
  };

  const parseStatus = (value: string | undefined): TaskStatus | null => {
    if (!value) {
      return null;
    }
    const normalized = value.trim().toLowerCase();
    const match = TASK_STATUSES.find((status) => status.toLowerCase() === normalized);
    return match ?? null;
  };

  const parseSortField = (value: string | undefined): TaskSortFieldValue | null => {
    if (!value) {
      return null;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === "title" || normalized === "status") {
      return normalized as TaskSortFieldValue;
    }
    return null;
  };

  const parseSortOrder = (value: string | undefined): TaskSortOrderValue | null => {
    if (!value) {
      return null;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === "asc" || normalized === "desc") {
      return normalized as TaskSortOrderValue;
    }
    return null;
  };

  server.get<{
    Querystring: {
      search?: string;
      status?: string | string[];
      sort_by?: string;
      order?: string;
    };
  }>("/tasks", { preValidation: [ensureAuthenticated] }, async (request, reply) => {
    const username = requireUser(request, reply);
    if (!username) return;

    const normalizedSearch = request.query.search?.trim();
    const requestedStatuses = (() => {
      const { status } = request.query;
      const values = Array.isArray(status) ? status : status ? [status] : [];
      const parsed = values
        .map((value) => parseStatus(value))
        .filter((entry): entry is TaskStatus => !!entry);
      return parsed.length ? parsed : undefined;
    })();
    const sortField = parseSortField(request.query.sort_by);
    const sortOrder = sortField ? parseSortOrder(request.query.order) ?? "asc" : undefined;
    const tasks = listTasks(
      username,
      normalizedSearch?.length ? normalizedSearch : undefined,
      requestedStatuses,
      sortField,
      sortOrder
    );
    return { tasks };
  });

  server.post<{ Body: TaskCreateBody }>(
    "/tasks",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const username = requireUser(request, reply);
      if (!username) return;

      const trimmedTitle = request.body.title?.trim();
      if (!trimmedTitle) {
        return reply.status(400).send({ message: "Title is required" });
      }

      const trimmedProjectId = request.body.projectId?.trim();
      if (!trimmedProjectId) {
        return reply.status(400).send({ message: "Project is required" });
      }
      const project = findProjectForUser(username, trimmedProjectId);
      if (!project) {
        return reply.status(400).send({ message: "Project not found" });
      }
      const projectId = trimmedProjectId;

      if (request.body.tags !== undefined && !Array.isArray(request.body.tags)) {
        return reply.status(400).send({ message: "Tags must be an array of strings" });
      }
      if (request.body.comments !== undefined && !Array.isArray(request.body.comments)) {
        return reply.status(400).send({ message: "Comments must be an array of strings" });
      }

      const now = new Date().toISOString();
      const newTask: TaskRecord = {
        id: randomUUID(),
        title: trimmedTitle,
        description: "",
        tags: request.body.tags ? normalizeTags(request.body.tags) : [],
        comments: request.body.comments ? normalizeComments(request.body.comments) : [],
        status: DEFAULT_TASK_STATUS,
        projectId,
        assignee: normalizeOptionalText(request.body.assignee),
        priority: normalizeOptionalText(request.body.priority),
        dueDate: normalizeOptionalText(request.body.dueDate),
        createdBy: username,
        createdAt: now,
        updatedAt: now
      };

      return insertTask(username, newTask);
    }
  );

  server.put<{ Params: { id: string }; Body: TaskUpdateBody }>(
    "/tasks/:id",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const username = requireUser(request, reply);
      if (!username) return;

      const taskRow = findTaskRowById(request.params.id);
      if (!taskRow) {
        return reply.status(404).send({ message: "Task not found" });
      }

      const hasAccess =
        taskRow.projectId !== null
          ? !!findProjectForUser(username, taskRow.projectId)
          : taskRow.username === username;
      if (!hasAccess) {
        return reply.status(404).send({ message: "Task not found" });
      }

      const now = new Date().toISOString();
      const updates: TaskUpdateBody & { updatedAt: string } = { updatedAt: now };

      if (request.body.title !== undefined) {
        const trimmedTitle = request.body.title.trim();
        if (!trimmedTitle) {
          return reply.status(400).send({ message: "Title cannot be empty" });
        }
        updates.title = trimmedTitle;
      }

      if (request.body.description !== undefined) {
        updates.description = request.body.description.trim();
      }

      if (request.body.status !== undefined) {
        if (!isTaskStatus(request.body.status)) {
          return reply.status(400).send({ message: "Invalid task status" });
        }
        updates.status = request.body.status;
      }

      if (request.body.projectId !== undefined) {
        const trimmedProjectId = request.body.projectId?.trim() ?? "";
        if (!trimmedProjectId) {
          return reply.status(400).send({ message: "Project is required" });
        }
        const project = findProjectForUser(username, trimmedProjectId);
        if (!project) {
          return reply.status(400).send({ message: "Project not found" });
        }
        updates.projectId = trimmedProjectId;
      }

      if (request.body.assignee !== undefined) {
        updates.assignee = normalizeOptionalText(request.body.assignee);
      }

      if (request.body.priority !== undefined) {
        updates.priority = normalizeOptionalText(request.body.priority);
      }

      if (request.body.dueDate !== undefined) {
        updates.dueDate = normalizeOptionalText(request.body.dueDate);
      }

      if (request.body.tags !== undefined) {
        if (!Array.isArray(request.body.tags)) {
          return reply.status(400).send({ message: "Tags must be an array of strings" });
        }
        updates.tags = normalizeTags(request.body.tags);
      }

      if (request.body.comments !== undefined) {
        if (!Array.isArray(request.body.comments)) {
          return reply.status(400).send({ message: "Comments must be an array of strings" });
        }
        updates.comments = normalizeComments(request.body.comments);
      }

      const updated = updateTask(taskRow.id, updates);
      if (!updated) {
        return reply.status(404).send({ message: "Task not found" });
      }

      return updated;
    }
  );

  server.delete<{ Params: { id: string } }>(
    "/tasks/:id",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const username = requireUser(request, reply);
      if (!username) return;

      const taskRow = findTaskRowById(request.params.id);
      if (!taskRow) {
        return reply.status(404).send({ message: "Task not found" });
      }

      const hasAccess =
        taskRow.projectId !== null
          ? !!findProjectForUser(username, taskRow.projectId)
          : taskRow.username === username;
      if (!hasAccess) {
        return reply.status(404).send({ message: "Task not found" });
      }

      const deleted = deleteTask(taskRow.id);
      if (!deleted) {
        return reply.status(404).send({ message: "Task not found" });
      }

      return { message: "Task deleted" };
    }
  );
};

export default tasksRoutes;
