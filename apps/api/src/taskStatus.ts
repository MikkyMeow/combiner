export const DEFAULT_TASK_STATUSES = [
  "Backlog",
  "To do",
  "In progress",
  "Done",
  "Archived"
] as const;

export type TaskStatus = string;
export const DEFAULT_TASK_STATUS = DEFAULT_TASK_STATUSES[0];

export const findStatusMatch = (
  value: string | undefined,
  statuses: readonly string[]
): string | null => {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  const match = statuses.find((status) => status.toLowerCase() === normalized);
  return match ?? null;
};

export const buildTaskStatusList = (values?: string[]): string[] => {
  const seen = new Set<string>();
  const merged: string[] = [];
  DEFAULT_TASK_STATUSES.forEach((status) => {
    const key = status.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(status);
    }
  });
  (values ?? []).forEach((entry) => {
    if (typeof entry !== "string") {
      return;
    }
    const trimmed = entry.trim();
    if (!trimmed) {
      return;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    merged.push(trimmed);
  });
  return merged;
};
