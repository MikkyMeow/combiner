export const TEAM_ROLES = ["owner", "employee"];
export const isTeamRole = (role) => role !== null && TEAM_ROLES.includes(role);
