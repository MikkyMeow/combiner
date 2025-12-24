import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
};

export type TaskRow = {
  id: string;
  username: string;
  title: string;
  description: string;
  completed: boolean;
  projectId: string | null;
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

export type DatabaseState = {
  users: UserRow[];
  projects: ProjectRow[];
  tasks: TaskRow[];
  notes: NoteRow[];
};

type RawUserRow = {
  username: string;
  password: string;
  createdAt: string;
  updatedAt: string;
  role?: UserRole;
  company?: string | null;
};

type RawProjectRow = Omit<ProjectRow, "members"> & {
  members?: string[];
};

type RawTaskRow = Omit<TaskRow, "createdBy"> & {
  createdBy?: string;
};

type RawNoteRow = Omit<NoteRow, "projectId"> & {
  projectId?: string | null;
};

type RawDatabaseState = {
  users?: RawUserRow[];
  projects?: RawProjectRow[];
  tasks?: RawTaskRow[];
  notes?: RawNoteRow[];
};

const initialState: DatabaseState = {
  users: [],
  projects: [],
  tasks: [],
  notes: []
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
    members: project.members ?? []
  })),
  tasks: (payload.tasks ?? []).map((task) => ({
    ...task,
    createdBy: task.createdBy ?? task.username
  })),
  notes: (payload.notes ?? []).map((note) => ({
    ...note,
    projectId: note.projectId ?? null
  }))
});

export const loadDatabase = (): DatabaseState => {
  ensureDatabase();
  const raw = fs.readFileSync(databasePath, "utf8");
  const parsed = JSON.parse(raw) as RawDatabaseState;
  const normalized = normalizeState(parsed);
  const needsSchemaUpdate =
    parsed.notes === undefined ||
    (parsed.users ?? []).some(
      (user) => user.role === undefined || user.company === undefined
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
