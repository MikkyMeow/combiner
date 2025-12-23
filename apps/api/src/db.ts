import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

const databasePath = path.join(dataDir, "combiner.json");

export type UserRow = {
  username: string;
  password: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectRow = {
  id: string;
  username: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
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
};

export type NoteRow = {
  id: string;
  username: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type DatabaseState = {
  users: UserRow[];
  projects: ProjectRow[];
  tasks: TaskRow[];
  notes: NoteRow[];
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

const normalizeState = (payload: Partial<DatabaseState>): DatabaseState => ({
  users: payload.users ?? [],
  projects: payload.projects ?? [],
  tasks: payload.tasks ?? [],
  notes: payload.notes ?? []
});

export const loadDatabase = (): DatabaseState => {
  ensureDatabase();
  const raw = fs.readFileSync(databasePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<DatabaseState>;
  const normalized = normalizeState(parsed);
  if (parsed.notes === undefined) {
    saveDatabase(normalized);
  }
  return normalized;
};

export const saveDatabase = (state: DatabaseState): void => {
  fs.writeFileSync(databasePath, JSON.stringify(state, null, 2));
};

export const databaseFilePath = databasePath;
