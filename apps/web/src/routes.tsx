export type RouteDefinition = {
  path: string;
  label: string;
};

const guestRoutes: RouteDefinition[] = [
  { path: "/login", label: "Вход" },
  { path: "/register", label: "Регистрация" }
];

const authenticatedRoutes: RouteDefinition[] = [{ path: "/tasks", label: "Задачи" }];

export const getRoutes = (authenticated: boolean): RouteDefinition[] =>
  authenticated ? authenticatedRoutes : guestRoutes;
