import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "crypto";
import {
  deleteProject,
  findProjectById,
  insertProject,
  listProjects,
  type ProjectRecord,
  updateProject
} from "./projectsStore";
import { findTasksForProject } from "./tasksStore";
import { findNotesForProject } from "./notesStore";

type ProjectCreateBody = {
  title: string;
  description?: string;
};

type ProjectUpdateBody = Partial<ProjectCreateBody>;

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

    const projects = listProjects(username);
    return { projects };
  });

  server.get<{ Params: { id: string } }>(
    "/projects/:id",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const username = requireUser(request, reply);
      if (!username) return;

      const project = findProjectById(username, request.params.id);
      if (!project) {
        return reply.status(404).send({ message: "Project not found" });
      }

      const tasks = findTasksForProject(username, project.id);
      const notes = findNotesForProject(username, project.id);
      return { project, tasks, notes };
    }
  );

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

      return insertProject(username, newProject);
    }
  );

  server.put<{ Params: { id: string }; Body: ProjectUpdateBody }>(
    "/projects/:id",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const username = requireUser(request, reply);
      if (!username) return;

      const target = findProjectById(username, request.params.id);
      if (!target) {
        return reply.status(404).send({ message: "Project not found" });
      }

      const now = new Date().toISOString();
      const updates: ProjectUpdateBody & { updatedAt: string } = {
        updatedAt: now
      };

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

      const updated = updateProject(username, target.id, updates);
      if (!updated) {
        return reply.status(404).send({ message: "Project not found" });
      }

      return updated;
    }
  );

  server.delete<{ Params: { id: string } }>(
    "/projects/:id",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const username = requireUser(request, reply);
      if (!username) return;

      const deleted = deleteProject(username, request.params.id);
      if (!deleted) {
        return reply.status(404).send({ message: "Project not found" });
      }

      return { message: "Project deleted" };
    }
  );
};

export default projectsRoutes;
