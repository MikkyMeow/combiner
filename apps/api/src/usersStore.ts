import { loadDatabase, saveDatabase, type UserRow, type UserRole } from "./db";

export type UserRecord = UserRow;
export type { UserRole };

export const findUserByUsername = (username: string): UserRecord | null => {
  const state = loadDatabase();
  const user = state.users.find((entry) => entry.username === username);
  return user ?? null;
};

export const createUser = (user: UserRecord): void => {
  const state = loadDatabase();
  state.users.unshift(user);
  saveDatabase(state);
};

export type UpdateUserPayload = {
  password?: string;
  company?: string | null;
  role?: UserRole;
  updatedAt: string;
};

export const updateUser = (
  username: string,
  payload: UpdateUserPayload
): UserRecord | null => {
  const state = loadDatabase();
  const target = state.users.find((entry) => entry.username === username);
  if (!target) {
    return null;
  }

  if (payload.password !== undefined) {
    target.password = payload.password;
  }
  if (payload.company !== undefined) {
    target.company = payload.company;
  }
  if (payload.role !== undefined) {
    target.role = payload.role;
  }
  target.updatedAt = payload.updatedAt;

  saveDatabase(state);
  return target;
};

export const listUsersByCompany = (company: string): UserRecord[] => {
  const state = loadDatabase();
  return state.users.filter((entry) => entry.company === company);
};
