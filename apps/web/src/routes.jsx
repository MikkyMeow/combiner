const guestRoutes = [
    { path: "/login", label: "Login" },
    { path: "/register", label: "Register" }
];
const authenticatedRoutes = [
    { path: "/profile", label: "Profile" },
    { path: "/projects", label: "Projects" }
];
const teamRoute = { path: "/teams", label: "Teams" };
const isTeamRole = (role) => role === "owner" || role === "employee";
export const getRoutes = (authenticated, role) => {
    if (!authenticated) {
        return guestRoutes;
    }
    const routes = [...authenticatedRoutes];
    if (isTeamRole(role)) {
        routes.push(teamRoute);
    }
    return routes;
};
