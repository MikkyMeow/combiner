import { randomUUID } from "crypto";
import { loadDatabase, saveDatabase, type AuditChange, type AuditLogEntry } from "./db";

type Diffable = Record<string, unknown> | null | undefined;

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object";

const areEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {
    return true;
  }
  if (!isObject(left) || !isObject(right)) {
    return false;
  }
  return JSON.stringify(left) === JSON.stringify(right);
};

export const buildChanges = (
  before: Diffable,
  after: Diffable,
  fields: readonly string[]
): Record<string, AuditChange> => {
  const changes: Record<string, AuditChange> = {};
  fields.forEach((field) => {
    const from = before ? before[field] : undefined;
    const to = after ? after[field] : undefined;
    if (!areEqual(from, to)) {
      changes[field] = { from, to };
    }
  });
  return changes;
};

export const appendAuditLog = (
  entry: Omit<AuditLogEntry, "id">
): AuditLogEntry => {
  const state = loadDatabase();
  const stored: AuditLogEntry = { ...entry, id: randomUUID() };
  state.auditLogs.unshift(stored);
  saveDatabase(state);
  return stored;
};

export const listAuditForTask = (taskId: string): AuditLogEntry[] => {
  const state = loadDatabase();
  return state.auditLogs
    .filter((entry) => entry.entity === "task" && entry.entityId === taskId)
    .sort((a, b) => b.at.localeCompare(a.at));
};

export const listAuditForProject = (projectId: string): AuditLogEntry[] => {
  const state = loadDatabase();
  return state.auditLogs
    .filter((entry) => entry.projectId === projectId)
    .sort((a, b) => b.at.localeCompare(a.at));
};
