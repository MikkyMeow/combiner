export const TASK_STATUS_OPTIONS = ["To do", "In progress", "Done"] as const;
export type TaskStatus = (typeof TASK_STATUS_OPTIONS)[number];

export type TaskRecord = {
  id: string;
  title: string;
  description: string;
  projectId: string | null;
  status: TaskStatus;
  assignee: string | null;
  priority: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

const statusSuffixMap: Record<TaskStatus, string> = {
  "To do": "todo",
  "In progress": "in-progress",
  Done: "done"
};

export const getStatusSuffix = (status: TaskStatus) => statusSuffixMap[status];

export const getStatusRowClass = (status: TaskStatus) => `status-row--${getStatusSuffix(status)}`;

export const getStatusPillClass = (status: TaskStatus) => `status-pill--${getStatusSuffix(status)}`;
