export type RouteDefinition = {
  path: string;
  label: string;
};

const guestRoutes: RouteDefinition[] = [
  { path: "/login", label: "Логин" },
  { path: "/register", label: "Регистрация" }
];

const authenticatedRoutes: RouteDefinition[] = [
  { path: "/tasks", label: "Задачи" },
  { path: "/projects", label: "Проекты" }
];

export const getRoutes = (authenticated: boolean): RouteDefinition[] =>
  authenticated ? authenticatedRoutes : guestRoutes;
