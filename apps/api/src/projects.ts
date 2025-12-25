import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "crypto";
import {
  addProjectMember,
  deleteProject,
  findProjectById,
  findProjectForUser,
  insertProject,
  listProjects,
  type ProjectRecord,
  updateProject
} from "./projectsStore";
import { findTasksForProject } from "./tasksStore";
import { findNotesForProject } from "./notesStore";
import { findUserByUsername, type UserRole } from "./usersStore";

type ProjectVisibility = ProjectRecord["visibility"];

type ProjectCreateBody = {
  title: string;
  description?: string;
  visibility: ProjectVisibility;
};

type ProjectUpdateBody = Partial<ProjectCreateBody>;

type AuthenticatedUser = {
  username: string;
  role: UserRole;
};

const projectsRoutes: FastifyPluginAsync = async (server) => {
  const ensureAuthenticated = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!server.authenticate) {
      return reply.status(500).send({ message: "Authentication handler missing" });
    }
    await server.authenticate(request, reply);
  };

  const requireUser = (
    request: FastifyRequest,
    reply: FastifyReply
  ): AuthenticatedUser | null => {
    const username = request.user?.username;
    const role = request.user?.role;
    if (!username || !role) {
      reply.status(401).send({ message: "Invalid token" });
      return null;
    }
    return { username, role };
  };

  const parseVisibility = (value: string | undefined): ProjectVisibility | null => {
    if (!value) {
      return null;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === "private" || normalized === "corporate") {
      return normalized as ProjectVisibility;
    }
    return null;
  };

  server.get("/projects", { preValidation: [ensureAuthenticated] }, async (request, reply) => {
    const authUser = requireUser(request, reply);
    if (!authUser) return;

    const projects = listProjects(authUser.username);
    return { projects };
  });

  server.get<{ Params: { id: string } }>(
    "/projects/:id",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const authUser = requireUser(request, reply);
      if (!authUser) return;

      const project = findProjectForUser(authUser.username, request.params.id);
      if (!project) {
        return reply.status(404).send({ message: "Project not found" });
      }

      const tasks = findTasksForProject(project.id);
      const notes = findNotesForProject(project.id);
      return { project, tasks, notes };
    }
  );

  server.post<{ Body: ProjectCreateBody }>(
    "/projects",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const authUser = requireUser(request, reply);
      if (!authUser) return;

      const trimmedTitle = request.body.title?.trim();
      if (!trimmedTitle) {
        return reply.status(400).send({ message: "Title is required" });
      }

      const requestedVisibility = parseVisibility(request.body.visibility);
      if (!requestedVisibility) {
        return reply.status(400).send({ message: "Project visibility is required" });
      }

      const now = new Date().toISOString();
      const newProject: ProjectRecord = {
        id: randomUUID(),
        title: trimmedTitle,
        description: request.body.description?.trim() ?? "",
        createdAt: now,
        updatedAt: now,
        owner: authUser.username,
        members: [],
        visibility: authUser.role === "user" ? "private" : requestedVisibility
      };

      return insertProject(authUser.username, newProject);
    }
  );

  server.put<{ Params: { id: string }; Body: ProjectUpdateBody }>(
    "/projects/:id",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const authUser = requireUser(request, reply);
      if (!authUser) return;

      const target = findProjectForUser(authUser.username, request.params.id);
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

      const updated = updateProject(target.id, updates);
      if (!updated) {
        return reply.status(404).send({ message: "Project not found" });
      }

      return updated;
    }
  );

  server.post<{ Params: { id: string }; Body: { username: string } }>(
    "/projects/:id/members",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const authUser = requireUser(request, reply);
      if (!authUser) return;

      const project = findProjectById(request.params.id);
      if (!project) {
        return reply.status(404).send({ message: "Project not found" });
      }

      if (project.owner !== authUser.username) {
        return reply.status(403).send({ message: "Only the project owner can invite members" });
      }

      const invitee = request.body.username?.trim();
      if (!invitee) {
        return reply.status(400).send({ message: "Username is required" });
      }

      if (invitee === authUser.username) {
        return reply.status(400).send({ message: "Cannot invite yourself" });
      }

      const user = findUserByUsername(invitee);
      if (!user) {
        return reply.status(404).send({ message: "User not found" });
      }

      const updated = addProjectMember(project.id, invitee);
      if (!updated) {
        return reply.status(404).send({ message: "Project not found" });
      }

      return { project: updated };
    }
  );

  server.delete<{ Params: { id: string } }>(
    "/projects/:id",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const authUser = requireUser(request, reply);
      if (!authUser) return;

      const project = findProjectForUser(authUser.username, request.params.id);
      if (!project || project.owner !== authUser.username) {
        return reply.status(404).send({ message: "Project not found" });
      }
      const deleted = deleteProject(request.params.id);
      if (!deleted) {
        return reply.status(404).send({ message: "Project not found" });
      }

      return { message: "Project deleted" };
    }
  );
};

export default projectsRoutes;
