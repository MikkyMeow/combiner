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
import { appendAuditLog, buildChanges, listAuditForTask } from "./auditStore";
import {
  DEFAULT_TASK_STATUS,
  DEFAULT_TASK_STATUSES,
  findStatusMatch,
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

const TASK_AUDIT_FIELDS = [
  "title",
  "description",
  "tags",
  "comments",
  "status",
  "projectId",
  "assignee",
  "priority",
  "dueDate",
  "createdAt",
  "updatedAt",
  "createdBy"
] as const;

const buildTaskSnapshot = (task: {
  title: string;
  description: string;
  tags: string[];
  comments: string[];
  status: TaskStatus;
  projectId: string | null;
  assignee: string | null;
  priority: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}): Record<string, unknown> => ({
  title: task.title,
  description: task.description,
  tags: task.tags,
  comments: task.comments,
  status: task.status,
  projectId: task.projectId,
  assignee: task.assignee,
  priority: task.priority,
  dueDate: task.dueDate,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
  createdBy: task.createdBy
});

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
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
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

  server.get<{ Params: { id: string } }>(
    "/tasks/:id/history",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const username = requireUser(request, reply);
      if (!username) return;

      const history = listAuditForTask(request.params.id);
      if (history.length === 0) {
        return reply.status(404).send({ message: "Task not found" });
      }

      const projectIds = Array.from(
        new Set(
          history
            .map((entry) => entry.projectId)
            .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
        )
      );

      const hasAccess =
        history.some((entry) => entry.actor === username) ||
        projectIds.some((projectId) => !!findProjectForUser(username, projectId));
      if (!hasAccess) {
        return reply.status(404).send({ message: "Task not found" });
      }

      return { history };
    }
  );

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
        status: project.taskStatuses[0] ?? DEFAULT_TASK_STATUS,
        projectId,
        assignee: normalizeOptionalText(request.body.assignee),
        priority: normalizeOptionalText(request.body.priority),
        dueDate: normalizeOptionalText(request.body.dueDate),
        createdBy: username,
        createdAt: now,
        updatedAt: now
      };

      const created = insertTask(username, newTask);
      const changes = buildChanges(null, buildTaskSnapshot(created), TASK_AUDIT_FIELDS);
      appendAuditLog({
        at: now,
        actor: username,
        entity: "task",
        entityId: created.id,
        projectId: created.projectId,
        action: "create",
        changes
      });

      return created;
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

      const currentProject = taskRow.projectId
        ? findProjectForUser(username, taskRow.projectId)
        : null;
      const allowedStatuses = currentProject?.taskStatuses ?? DEFAULT_TASK_STATUSES;

      if (request.body.status !== undefined) {
        const matched = findStatusMatch(request.body.status, allowedStatuses);
        if (!matched) {
          return reply.status(400).send({ message: "Invalid task status" });
        }
        updates.status = matched;
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
        if (updates.status === undefined) {
          const fallback = findStatusMatch(taskRow.status, project.taskStatuses);
          updates.status = fallback ?? project.taskStatuses[0] ?? DEFAULT_TASK_STATUS;
        }
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

      const beforeSnapshot = buildTaskSnapshot({
        ...taskRow,
        createdBy: taskRow.createdBy ?? taskRow.username
      });
      const afterSnapshot = buildTaskSnapshot(updated);
      const changes = buildChanges(beforeSnapshot, afterSnapshot, TASK_AUDIT_FIELDS);
      const isMove = changes.projectId !== undefined;
      appendAuditLog({
        at: now,
        actor: username,
        entity: "task",
        entityId: updated.id,
        projectId: updated.projectId,
        action: isMove ? "move" : "update",
        changes
      });

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

      const changes = buildChanges(
        buildTaskSnapshot({
          ...taskRow,
          createdBy: taskRow.createdBy ?? taskRow.username
        }),
        null,
        TASK_AUDIT_FIELDS
      );
      appendAuditLog({
        at: new Date().toISOString(),
        actor: username,
        entity: "task",
        entityId: taskRow.id,
        projectId: taskRow.projectId,
        action: "delete",
        changes
      });

      return { message: "Task deleted" };
    }
  );
};

export default tasksRoutes;
