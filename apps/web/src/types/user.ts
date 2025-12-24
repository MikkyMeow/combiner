export type UserRole = "owner" | "user" | "employee";

export const TEAM_ROLES: UserRole[] = ["owner", "employee"];

export const isTeamRole = (role: UserRole | null): role is UserRole =>
  role !== null && TEAM_ROLES.includes(role);
