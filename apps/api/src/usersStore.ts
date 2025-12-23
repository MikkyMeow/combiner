import { loadDatabase, saveDatabase, type UserRow } from "./db";

export type UserRecord = UserRow;

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
