import { TEAM_ROLES } from "./types/user";
import type { UserRole } from "./types/user";

export type RouteDefinition = {
  path: string;
  label: string;
};

const guestRoutes: RouteDefinition[] = [
  { path: "/login", label: "Login" },
  { path: "/register", label: "Register" }
];

const authenticatedRoutes: RouteDefinition[] = [
  { path: "/profile", label: "Profile" },
  { path: "/projects", label: "Projects" }
];

const teamRoute: RouteDefinition = { path: "/teams", label: "Teams" };

export const getRoutes = (authenticated: boolean, role: UserRole): RouteDefinition[] => {
  if (!authenticated) {
    return guestRoutes;
  }
  const routes = [...authenticatedRoutes];
  if (TEAM_ROLES.includes(role)) {
    routes.push(teamRoute);
  }
  return routes;
};
