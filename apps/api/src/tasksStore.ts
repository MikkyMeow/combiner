export type TaskRecord = {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
  projectId: string | null;
};

const tasksStore = new Map<string, TaskRecord[]>();

export const ensureTaskList = (username: string) => {
  if (!tasksStore.has(username)) {
    tasksStore.set(username, []);
  }
  return tasksStore.get(username)!;
};

export const findTasksForProject = (username: string, projectId: string) => {
  const tasks = tasksStore.get(username);
  if (!tasks) {
    return [];
  }
  return tasks.filter((task) => task.projectId === projectId);
};
