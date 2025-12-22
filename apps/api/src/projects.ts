import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "crypto";

type ProjectRecord = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

type ProjectCreateBody = {
  title: string;
  description?: string;
};

type ProjectUpdateBody = Partial<ProjectCreateBody>;

const projectsStore = new Map<string, ProjectRecord[]>();

const ensureProjectList = (username: string) => {
  if (!projectsStore.has(username)) {
    projectsStore.set(username, []);
  }
  return projectsStore.get(username)!;
};

const projectsRoutes: FastifyPluginAsync = async (server) => {
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

  server.get("/projects", { preValidation: [ensureAuthenticated] }, async (request, reply) => {
    const username = requireUser(request, reply);
    if (!username) return;

    const projects = ensureProjectList(username);
    return { projects };
  });

  server.post<{ Body: ProjectCreateBody }>(
    "/projects",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const username = requireUser(request, reply);
      if (!username) return;

      const trimmedTitle = request.body.title?.trim();
      if (!trimmedTitle) {
        return reply.status(400).send({ message: "Title is required" });
      }

      const now = new Date().toISOString();
      const newProject: ProjectRecord = {
        id: randomUUID(),
        title: trimmedTitle,
        description: request.body.description?.trim() ?? "",
        createdAt: now,
        updatedAt: now
      };

      const projects = ensureProjectList(username);
      projects.unshift(newProject);
      return newProject;
    }
  );

  server.put<{ Params: { id: string }; Body: ProjectUpdateBody }>(
    "/projects/:id",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const username = requireUser(request, reply);
      if (!username) return;

      const projects = ensureProjectList(username);
      const target = projects.find((project) => project.id === request.params.id);
      if (!target) {
        return reply.status(404).send({ message: "Project not found" });
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

      target.updatedAt = now;
      return target;
    }
  );

  server.delete<{ Params: { id: string } }>(
    "/projects/:id",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const username = requireUser(request, reply);
      if (!username) return;

      const projects = ensureProjectList(username);
      const index = projects.findIndex((project) => project.id === request.params.id);
      if (index === -1) {
        return reply.status(404).send({ message: "Project not found" });
      }

      projects.splice(index, 1);
      return { message: "Project deleted" };
    }
  );
};

export default projectsRoutes;
