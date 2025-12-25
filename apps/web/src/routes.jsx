import { TEAM_ROLES } from "./types/user";
const guestRoutes = [
    { path: "/login", label: "Login" },
    { path: "/register", label: "Register" }
];
const authenticatedRoutes = [
    { path: "/profile", label: "Profile" },
    { path: "/projects", label: "Projects" }
];
const teamRoute = { path: "/teams", label: "Teams" };
export const getRoutes = (authenticated, role) => {
    if (!authenticated) {
        return guestRoutes;
    }
    const routes = [...authenticatedRoutes];
    if (role && TEAM_ROLES.includes(role)) {
        routes.push(teamRoute);
    }
    return routes;
};
