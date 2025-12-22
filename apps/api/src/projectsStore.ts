export type ProjectRecord = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

const projectsStore = new Map<string, ProjectRecord[]>();

export const ensureProjectList = (username: string) => {
  if (!projectsStore.has(username)) {
    projectsStore.set(username, []);
  }
  return projectsStore.get(username)!;
};

export const findProjectById = (username: string, projectId: string) => {
  const list = projectsStore.get(username);
  if (!list) {
    return null;
  }
  return list.find((project) => project.id === projectId) ?? null;
};
