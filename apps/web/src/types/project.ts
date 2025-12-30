export type ProjectVisibility = "private" | "corporate";

export type Project = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  owner: string;
  members: string[];
  visibility: ProjectVisibility;
  taskStatuses: string[];
};
