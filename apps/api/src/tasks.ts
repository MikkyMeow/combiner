import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "crypto";
import { findProjectForUser } from "./projectsStore";
import {
  deleteTask,
  findTaskRowById,
  insertTask,
  listTasks,
  type TaskRecord,
  updateTask
} from "./tasksStore";
import {
  DEFAULT_TASK_STATUS,
  isTaskStatus,
  type TaskStatus
} from "./taskStatus";

type TaskCreateBody = {
  title: string;
  projectId?: string;
};

type TaskUpdateBody = {
  title?: string;
  description?: string;
  projectId?: string | null;
  status?: TaskStatus;
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

  server.get("/tasks", { preValidation: [ensureAuthenticated] }, async (request, reply) => {
    const username = requireUser(request, reply);
    if (!username) return;

    const tasks = listTasks(username);
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

      let projectId: string | null = null;
      if (request.body.projectId !== undefined) {
        const trimmedProjectId = request.body.projectId?.trim();
        if (trimmedProjectId) {
          const project = findProjectForUser(username, trimmedProjectId);
          if (!project) {
            return reply.status(400).send({ message: "Project not found" });
          }
          projectId = trimmedProjectId;
        }
      }

      const now = new Date().toISOString();
      const newTask: TaskRecord = {
        id: randomUUID(),
        title: trimmedTitle,
        description: "",
        status: DEFAULT_TASK_STATUS,
        projectId,
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
          updates.projectId = null;
        } else {
          const project = findProjectForUser(username, trimmedProjectId);
          if (!project) {
            return reply.status(400).send({ message: "Project not found" });
          }
          updates.projectId = trimmedProjectId;
        }
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
