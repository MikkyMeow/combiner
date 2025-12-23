const guestRoutes = [
    { path: "/login", label: "Login" },
    { path: "/register", label: "Register" }
];
const authenticatedRoutes = [
    { path: "/profile", label: "Profile" },
    { path: "/projects", label: "Projects" }
];
export const getRoutes = (authenticated) => authenticated ? authenticatedRoutes : guestRoutes;
