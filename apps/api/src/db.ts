import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_TASK_STATUS,
  buildTaskStatusList,
  type TaskStatus
} from "./taskStatus";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

const databasePath = path.join(dataDir, "combiner.json");

export type UserRole = "owner" | "user" | "employee";

export type UserRow = {
  username: string;
  password: string;
  createdAt: string;
  updatedAt: string;
  role: UserRole;
  company?: string | null;
};

export type ProjectRow = {
  id: string;
  username: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  members: string[];
  visibility: "private" | "corporate";
  taskStatuses: string[];
};

export type TaskRow = {
  id: string;
  username: string;
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
};

export type NoteRow = {
  id: string;
  username: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  projectId: string | null;
};

export type AuditChange = {
  from: unknown;
  to: unknown;
};

export type AuditLogEntry = {
  id: string;
  at: string;
  actor: string;
  entity: "task" | "project";
  entityId: string;
  projectId: string | null;
  action:
    | "create"
    | "update"
    | "delete"
    | "move"
    | "member_add"
    | "status_add"
    | "status_remove";
  changes: Record<string, AuditChange>;
};

export type DatabaseState = {
  users: UserRow[];
  projects: ProjectRow[];
  tasks: TaskRow[];
  notes: NoteRow[];
  auditLogs: AuditLogEntry[];
};

type RawUserRow = {
  username: string;
  password: string;
  createdAt: string;
  updatedAt: string;
  role?: UserRole;
  company?: string | null;
};

type RawProjectRow = Omit<ProjectRow, "members" | "visibility" | "taskStatuses"> & {
  members?: string[];
  visibility?: "private" | "corporate";
  taskStatuses?: string[];
};

type RawTaskRow = Omit<TaskRow, "createdBy" | "assignee" | "priority" | "dueDate" | "tags" | "comments"> & {
  createdBy?: string;
  status?: TaskStatus;
  assignee?: string | null;
  priority?: string | null;
  dueDate?: string | null;
  tags?: string[];
  comments?: string[];
};

type RawNoteRow = Omit<NoteRow, "projectId"> & {
  projectId?: string | null;
};

type RawDatabaseState = {
  users?: RawUserRow[];
  projects?: RawProjectRow[];
  tasks?: RawTaskRow[];
  notes?: RawNoteRow[];
  auditLogs?: AuditLogEntry[];
};

const initialState: DatabaseState = {
  users: [],
  projects: [],
  tasks: [],
  notes: [],
  auditLogs: []
};

const ensureDatabase = () => {
  if (!fs.existsSync(databasePath)) {
    fs.writeFileSync(databasePath, JSON.stringify(initialState, null, 2));
  }
};

const normalizeState = (payload: RawDatabaseState): DatabaseState => ({
  users: (payload.users ?? []).map((user) => ({
    ...user,
    role: user.role ?? "user",
    company: user.company ?? null
  })),
  projects: (payload.projects ?? []).map((project) => ({
    ...project,
    members: project.members ?? [],
    visibility: project.visibility === "corporate" ? "corporate" : "private",
    taskStatuses: buildTaskStatusList(project.taskStatuses)
  })),
  tasks: (payload.tasks ?? []).map((task) => ({
    ...task,
    tags: task.tags ?? [],
    comments: task.comments ?? [],
    status: task.status ?? DEFAULT_TASK_STATUS,
    assignee: task.assignee ?? null,
    priority: task.priority ?? null,
    dueDate: task.dueDate ?? null,
    createdBy: task.createdBy ?? task.username
  })),
  notes: (payload.notes ?? []).map((note) => ({
    ...note,
    projectId: note.projectId ?? null
  })),
  auditLogs: payload.auditLogs ?? []
});

export const loadDatabase = (): DatabaseState => {
  ensureDatabase();
  const raw = fs.readFileSync(databasePath, "utf8");
  const parsed = JSON.parse(raw) as RawDatabaseState;
  const normalized = normalizeState(parsed);
  const needsSchemaUpdate =
    parsed.notes === undefined ||
    parsed.auditLogs === undefined ||
    (parsed.users ?? []).some(
      (user) => user.role === undefined || user.company === undefined
    ) ||
    (parsed.projects ?? []).some(
      (project) => project.visibility === undefined || project.taskStatuses === undefined
    ) ||
    (parsed.tasks ?? []).some(
      (task) =>
        task.tags === undefined ||
        task.comments === undefined ||
        task.status === undefined ||
        task.assignee === undefined ||
        task.priority === undefined ||
        task.dueDate === undefined
    );
  if (needsSchemaUpdate) {
    saveDatabase(normalized);
  }
  return normalized;
};

export const saveDatabase = (state: DatabaseState): void => {
  fs.writeFileSync(databasePath, JSON.stringify(state, null, 2));
};

export const databaseFilePath = databasePath;
