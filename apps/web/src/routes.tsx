export type RouteDefinition = {
  path: string;
  label: string;
};

const guestRoutes: RouteDefinition[] = [
  { path: "/login", label: "Login" },
  { path: "/register", label: "Register" }
];

const authenticatedRoutes: RouteDefinition[] = [
  { path: "/tasks", label: "Tasks" },
  { path: "/notes", label: "Notes" },
  { path: "/projects", label: "Projects" }
];

export const getRoutes = (authenticated: boolean): RouteDefinition[] =>
  authenticated ? authenticatedRoutes : guestRoutes;
