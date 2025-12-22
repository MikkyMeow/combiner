import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "crypto";

type TaskRecord = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

type TaskCreateBody = {
  title: string;
  description?: string;
};

type TaskUpdateBody = Partial<TaskCreateBody> & {
  completed?: boolean;
};

const tasksStore = new Map<string, TaskRecord[]>();

const ensureTaskList = (username: string) => {
  if (!tasksStore.has(username)) {
    tasksStore.set(username, []);
  }
  return tasksStore.get(username)!;
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

    const tasks = ensureTaskList(username);
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

      const now = new Date().toISOString();
      const newTask: TaskRecord = {
        id: randomUUID(),
        title: trimmedTitle,
        description: request.body.description?.trim() ?? "",
        completed: false,
        createdAt: now,
        updatedAt: now
      };

      const tasks = ensureTaskList(username);
      tasks.unshift(newTask);
      return newTask;
    }
  );

  server.put<{ Params: { id: string }; Body: TaskUpdateBody }>(
    "/tasks/:id",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const username = requireUser(request, reply);
      if (!username) return;

      const tasks = ensureTaskList(username);
      const target = tasks.find((task) => task.id === request.params.id);
      if (!target) {
        return reply.status(404).send({ message: "Task not found" });
      }

      const now = new Date().toISOString();
      if (request.body.title !== undefined) {
        const trimmedTitle = request.body.title.trim();
        if (!trimmedTitle) {
          return reply.status(400).send({ message: "Title cannot be empty" });
        }
        target.title = trimmedTitle;
      }

      if (request.body.description !== undefined) {
        target.description = request.body.description.trim();
      }

      if (typeof request.body.completed === "boolean") {
        target.completed = request.body.completed;
      }

      target.updatedAt = now;
      return target;
    }
  );

  server.delete<{ Params: { id: string } }>(
    "/tasks/:id",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const username = requireUser(request, reply);
      if (!username) return;

      const tasks = ensureTaskList(username);
      const index = tasks.findIndex((task) => task.id === request.params.id);
      if (index === -1) {
        return reply.status(404).send({ message: "Task not found" });
      }

      tasks.splice(index, 1);
      return { message: "Task deleted" };
    }
  );
};

export default tasksRoutes;
