import { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "crypto";
import {
  addProjectMember,
  addProjectTaskStatus,
  deleteProject,
  findProjectById,
  findProjectForUser,
  insertProject,
  listProjects,
  removeProjectTaskStatus,
  type ProjectRecord,
  type ProjectSortField,
  type ProjectSortOrder,
  updateProject
} from "./projectsStore";
import { appendAuditLog, buildChanges, listAuditForProject } from "./auditStore";
import {
  findTasksForProject,
  findTaskRowById,
  type TaskSortField,
  type TaskSortOrder
} from "./tasksStore";
import {
  DEFAULT_TASK_STATUSES,
  findStatusMatch,
  type TaskStatus
} from "./taskStatus";
import { findNotesForProject } from "./notesStore";
import { findUserByUsername, type UserRole } from "./usersStore";

type ProjectVisibility = ProjectRecord["visibility"];
type ProjectSortFieldValue = ProjectSortField;
type ProjectSortOrderValue = ProjectSortOrder;
type TaskSortFieldValue = TaskSortField;
type TaskSortOrderValue = TaskSortOrder;

const PROJECT_AUDIT_FIELDS = [
  "title",
  "description",
  "visibility",
  "members",
  "taskStatuses",
  "createdAt",
  "updatedAt",
  "owner"
] as const;

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

const buildProjectSnapshot = (project: ProjectRecord): Record<string, unknown> => ({
  title: project.title,
  description: project.description,
  visibility: project.visibility,
  members: project.members,
  taskStatuses: project.taskStatuses,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
  owner: project.owner
});

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

  const parseSortField = (value: string | undefined): ProjectSortFieldValue | null => {
    if (!value) {
      return null;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === "title" || normalized === "visibility") {
      return normalized as ProjectSortFieldValue;
    }
    return null;
  };

  const parseSortOrder = (value: string | undefined): ProjectSortOrderValue | null => {
    if (!value) {
      return null;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === "asc" || normalized === "desc") {
      return normalized as ProjectSortOrderValue;
    }
    return null;
  };

  const parseTaskStatus = (
    value: string | undefined,
    statuses: readonly string[]
  ): TaskStatus | null => findStatusMatch(value, statuses);

  const parseTaskSortField = (value: string | undefined): TaskSortFieldValue | null => {
    if (!value) {
      return null;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === "title" || normalized === "status") {
      return normalized as TaskSortFieldValue;
    }
    return null;
  };

  const parseTaskSortOrder = (value: string | undefined): TaskSortOrderValue | null => {
    if (!value) {
      return null;
    }
    const normalized = value.trim().toLowerCase();
    if (normalized === "asc" || normalized === "desc") {
      return normalized as TaskSortOrderValue;
    }
    return null;
  };

  const parseTaskTags = (value: string | string[] | undefined): string[] | undefined => {
    if (!value) {
      return undefined;
    }
    const values = Array.isArray(value) ? value : [value];
    const tags = values
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    return tags.length ? tags : undefined;
  };

  server.get<{
    Querystring: {
      search?: string;
      visibility?: string | string[];
      sort_by?: string;
      order?: string;
    };
  }>(
    "/projects",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const authUser = requireUser(request, reply);
      if (!authUser) return;

      const normalizedSearch = request.query.search?.trim();
      const requestedVisibilities = (() => {
        const { visibility } = request.query;
        const values = Array.isArray(visibility) ? visibility : visibility ? [visibility] : [];
        const parsed = values
          .map((value) => parseVisibility(value))
          .filter((entry): entry is ProjectVisibility => !!entry);
        return parsed.length ? parsed : undefined;
      })();
      const sortField = parseSortField(request.query.sort_by);
      const sortOrder = sortField ? parseSortOrder(request.query.order) ?? "asc" : undefined;
      const projects = listProjects(
        authUser.username,
        normalizedSearch?.length ? normalizedSearch : undefined,
        requestedVisibilities,
        sortField,
        sortOrder
      );
      return { projects };
    }
  );

  server.get<{ Params: { id: string } }>(
    "/projects/:id/history",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const authUser = requireUser(request, reply);
      if (!authUser) return;

      const project = findProjectForUser(authUser.username, request.params.id);
      if (!project) {
        return reply.status(404).send({ message: "Project not found" });
      }

      const history = listAuditForProject(project.id);
      return { history };
    }
  );

  server.get<{
    Params: { id: string };
    Querystring: {
      task_search?: string;
      task_status?: string | string[];
      task_tags?: string | string[];
      task_sort_by?: string;
      task_order?: string;
    };
  }>(
    "/projects/:id",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const authUser = requireUser(request, reply);
      if (!authUser) return;

      const project = findProjectForUser(authUser.username, request.params.id);
      if (!project) {
        return reply.status(404).send({ message: "Project not found" });
      }

      const normalizedSearch = request.query.task_search?.trim();
      const requestedStatuses = (() => {
        const { task_status } = request.query;
        const values = Array.isArray(task_status)
          ? task_status
          : task_status
            ? [task_status]
            : [];
        const parsed = values
          .map((value) => parseTaskStatus(value, project.taskStatuses))
          .filter((entry): entry is TaskStatus => !!entry);
        return parsed.length ? parsed : undefined;
      })();
      const requestedTags = parseTaskTags(request.query.task_tags);
      const sortField = parseTaskSortField(request.query.task_sort_by);
      const sortOrder = sortField ? parseTaskSortOrder(request.query.task_order) ?? "asc" : undefined;
      const tasks = findTasksForProject(
        project.id,
        normalizedSearch?.length ? normalizedSearch : undefined,
        requestedStatuses,
        requestedTags,
        sortField,
        sortOrder,
        project.taskStatuses
      );
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
        visibility: authUser.role === "user" ? "private" : requestedVisibility,
        taskStatuses: [...DEFAULT_TASK_STATUSES]
      };

      const created = insertProject(authUser.username, newProject);
      const changes = buildChanges(null, buildProjectSnapshot(created), PROJECT_AUDIT_FIELDS);
      appendAuditLog({
        at: now,
        actor: authUser.username,
        entity: "project",
        entityId: created.id,
        projectId: created.id,
        action: "create",
        changes
      });

      return created;
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

      const changes = buildChanges(
        buildProjectSnapshot(target),
        buildProjectSnapshot(updated),
        PROJECT_AUDIT_FIELDS
      );
      appendAuditLog({
        at: now,
        actor: authUser.username,
        entity: "project",
        entityId: updated.id,
        projectId: updated.id,
        action: "update",
        changes
      });

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

      const changes = buildChanges(
        buildProjectSnapshot(project),
        buildProjectSnapshot(updated),
        PROJECT_AUDIT_FIELDS
      );
      appendAuditLog({
        at: new Date().toISOString(),
        actor: authUser.username,
        entity: "project",
        entityId: updated.id,
        projectId: updated.id,
        action: "member_add",
        changes
      });

      return { project: updated };
    }
  );

  server.post<{ Params: { id: string }; Body: { status: string } }>(
    "/projects/:id/statuses",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const authUser = requireUser(request, reply);
      if (!authUser) return;

      const project = findProjectById(request.params.id);
      if (!project) {
        return reply.status(404).send({ message: "Project not found" });
      }

      if (project.owner !== authUser.username) {
        return reply.status(403).send({ message: "Only the project owner can manage statuses" });
      }

      const trimmedStatus = request.body.status?.trim();
      if (!trimmedStatus) {
        return reply.status(400).send({ message: "Status name is required" });
      }

      const exists = project.taskStatuses.some(
        (entry) => entry.toLowerCase() === trimmedStatus.toLowerCase()
      );
      if (exists) {
        return reply.status(400).send({ message: "Status already exists" });
      }

      const updated = addProjectTaskStatus(project.id, trimmedStatus);
      if (!updated) {
        return reply.status(404).send({ message: "Project not found" });
      }

      const changes = buildChanges(
        buildProjectSnapshot(project),
        buildProjectSnapshot(updated),
        PROJECT_AUDIT_FIELDS
      );
      appendAuditLog({
        at: new Date().toISOString(),
        actor: authUser.username,
        entity: "project",
        entityId: updated.id,
        projectId: updated.id,
        action: "status_add",
        changes
      });

      return { project: updated };
    }
  );

  server.delete<{ Params: { id: string }; Body: { status: string } }>(
    "/projects/:id/statuses",
    { preValidation: [ensureAuthenticated] },
    async (request, reply) => {
      const authUser = requireUser(request, reply);
      if (!authUser) return;

      const project = findProjectById(request.params.id);
      if (!project) {
        return reply.status(404).send({ message: "Project not found" });
      }

      if (project.owner !== authUser.username) {
        return reply.status(403).send({ message: "Only the project owner can manage statuses" });
      }

      const trimmedStatus = request.body.status?.trim();
      if (!trimmedStatus) {
        return reply.status(400).send({ message: "Status name is required" });
      }

      const normalized = trimmedStatus.toLowerCase();
      const isDefault = DEFAULT_TASK_STATUSES.some(
        (entry) => entry.toLowerCase() === normalized
      );
      if (isDefault) {
        return reply.status(400).send({ message: "Default statuses cannot be removed" });
      }

      const exists = project.taskStatuses.some(
        (entry) => entry.toLowerCase() === normalized
      );
      if (!exists) {
        return reply.status(404).send({ message: "Status not found" });
      }

      const tasksBefore = findTasksForProject(
        project.id,
        undefined,
        [trimmedStatus],
        undefined,
        null,
        undefined,
        project.taskStatuses
      );
      const updated = removeProjectTaskStatus(project.id, trimmedStatus);
      if (!updated) {
        return reply.status(404).send({ message: "Project not found" });
      }

      const changes = buildChanges(
        buildProjectSnapshot(project),
        buildProjectSnapshot(updated),
        PROJECT_AUDIT_FIELDS
      );
      const now = new Date().toISOString();
      appendAuditLog({
        at: now,
        actor: authUser.username,
        entity: "project",
        entityId: updated.id,
        projectId: updated.id,
        action: "status_remove",
        changes
      });

      tasksBefore.forEach((task) => {
        const updatedRow = findTaskRowById(task.id);
        if (!updatedRow) {
          return;
        }
        const beforeSnapshot = buildTaskSnapshot(task);
        const afterSnapshot = buildTaskSnapshot({
          ...updatedRow,
          createdBy: updatedRow.createdBy ?? updatedRow.username
        });
        const taskChanges = buildChanges(
          beforeSnapshot,
          afterSnapshot,
          TASK_AUDIT_FIELDS
        );
        if (Object.keys(taskChanges).length === 0) {
          return;
        }
        appendAuditLog({
          at: now,
          actor: authUser.username,
          entity: "task",
          entityId: updatedRow.id,
          projectId: updatedRow.projectId,
          action: "update",
          changes: taskChanges
        });
      });

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
      const tasksBefore = findTasksForProject(
        project.id,
        undefined,
        undefined,
        undefined,
        null,
        undefined,
        project.taskStatuses
      );
      const deleted = deleteProject(request.params.id);
      if (!deleted) {
        return reply.status(404).send({ message: "Project not found" });
      }

      const now = new Date().toISOString();
      const changes = buildChanges(
        buildProjectSnapshot(project),
        null,
        PROJECT_AUDIT_FIELDS
      );
      appendAuditLog({
        at: now,
        actor: authUser.username,
        entity: "project",
        entityId: project.id,
        projectId: project.id,
        action: "delete",
        changes
      });

      tasksBefore.forEach((task) => {
        const updatedRow = findTaskRowById(task.id);
        if (!updatedRow) {
          return;
        }
        const beforeSnapshot = buildTaskSnapshot(task);
        const afterSnapshot = buildTaskSnapshot({
          ...updatedRow,
          createdBy: updatedRow.createdBy ?? updatedRow.username
        });
        const taskChanges = buildChanges(
          beforeSnapshot,
          afterSnapshot,
          TASK_AUDIT_FIELDS
        );
        if (Object.keys(taskChanges).length === 0) {
          return;
        }
        appendAuditLog({
          at: now,
          actor: authUser.username,
          entity: "task",
          entityId: updatedRow.id,
          projectId: updatedRow.projectId,
          action: "move",
          changes: taskChanges
        });
      });

      return { message: "Project deleted" };
    }
  );
};

export default projectsRoutes;
