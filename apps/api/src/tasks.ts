import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "crypto";
import { findProjectById } from "./projectsStore";
import {
  deleteTask,
  findTaskById,
  insertTask,
  listTasks,
  type TaskRecord,
  updateTask
} from "./tasksStore";

type TaskCreateBody = {
  title: string;
  description?: string;
  projectId?: string;
};

type TaskUpdateBody = Partial<TaskCreateBody> & {
  completed?: boolean;
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
          const project = findProjectById(username, trimmedProjectId);
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
        description: request.body.description?.trim() ?? "",
        completed: false,
        projectId,
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

      const target = findTaskById(username, request.params.id);
      if (!target) {
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

      if (typeof request.body.completed === "boolean") {
        updates.completed = request.body.completed;
      }

      if (request.body.projectId !== undefined) {
        const trimmedProjectId = request.body.projectId?.trim() ?? "";
        if (!trimmedProjectId) {
          updates.projectId = null;
        } else {
          const project = findProjectById(username, trimmedProjectId);
          if (!project) {
            return reply.status(400).send({ message: "Project not found" });
          }
          updates.projectId = trimmedProjectId;
        }
      }

      const updated = updateTask(username, target.id, updates);
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

      const deleted = deleteTask(username, request.params.id);
      if (!deleted) {
        return reply.status(404).send({ message: "Task not found" });
      }

      return { message: "Task deleted" };
    }
  );
};

export default tasksRoutes;
