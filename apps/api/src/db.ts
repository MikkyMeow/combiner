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

export type DatabaseState = {
  users: UserRow[];
  projects: ProjectRow[];
  tasks: TaskRow[];
};

const initialState: DatabaseState = {
  users: [],
  projects: [],
  tasks: []
};

const ensureDatabase = () => {
  if (!fs.existsSync(databasePath)) {
    fs.writeFileSync(databasePath, JSON.stringify(initialState, null, 2));
  }
};

export const loadDatabase = (): DatabaseState => {
  ensureDatabase();
  const raw = fs.readFileSync(databasePath, "utf8");
  return JSON.parse(raw) as DatabaseState;
};

export const saveDatabase = (state: DatabaseState): void => {
  fs.writeFileSync(databasePath, JSON.stringify(state, null, 2));
};

export const databaseFilePath = databasePath;
