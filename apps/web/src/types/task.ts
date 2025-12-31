export const TASK_STATUS_OPTIONS = [
  "Backlog",
  "To do",
  "In progress",
  "Done",
  "Archived"
] as const;
export type TaskStatus = string;

export type TaskRecord = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  comments: string[];
  projectId: string | null;
  status: TaskStatus;
  assignee: string | null;
  priority: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

const statusSuffixMap: Record<string, string> = {
  backlog: "backlog",
  "to do": "todo",
  "in progress": "in-progress",
  done: "done",
  archived: "archived"
};

export const getStatusSuffix = (status: TaskStatus) =>
  statusSuffixMap[status.toLowerCase()] ?? "custom";

export const getStatusRowClass = (status: TaskStatus) => `status-row--${getStatusSuffix(status)}`;

export const getStatusPillClass = (status: TaskStatus) => `status-pill--${getStatusSuffix(status)}`;
