import { StoredUser } from "./types";

type UserStore = {
  usersById: Map<string, StoredUser>;
  usersByProvider: Map<string, Map<string, StoredUser>>;
};

const globalUserStore =
  (globalThis as typeof globalThis & { __combinerUserStore?: UserStore })
    .__combinerUserStore ??
  {
    usersById: new Map<string, StoredUser>(),
    usersByProvider: new Map<string, Map<string, StoredUser>>(),
  };

if (
  !(globalThis as typeof globalThis & { __combinerUserStore?: UserStore })
    .__combinerUserStore
) {
  (globalThis as typeof globalThis & { __combinerUserStore?: UserStore })
    .__combinerUserStore = globalUserStore;
}

const usersById = globalUserStore.usersById;
const usersByProvider = globalUserStore.usersByProvider;

const NORMALIZED_PROVIDERS = new Set(["email"]);

function normalizeProviderUserId(providerId: string, providerUserId: string) {
  if (NORMALIZED_PROVIDERS.has(providerId)) {
    return providerUserId.trim().toLowerCase();
  }
  return providerUserId;
}

function persistUser(user: StoredUser) {
  usersById.set(user.id, user);

  if (!usersByProvider.has(user.providerId)) {
    usersByProvider.set(user.providerId, new Map());
  }

  const providerUsers = usersByProvider.get(user.providerId)!;
  providerUsers.set(
    normalizeProviderUserId(user.providerId, user.providerUserId),
    user,
  );
}

export function createUserRecord(
  data: Omit<StoredUser, "id" | "createdAt"> & {
    id?: string;
    createdAt?: Date;
  },
): StoredUser {
  const record: StoredUser = {
    ...data,
    id: data.id ?? crypto.randomUUID(),
    createdAt: data.createdAt ?? new Date(),
  };
  persistUser(record);
  return record;
}

export function findUserByProvider(
  providerId: string,
  providerUserId: string,
): StoredUser | undefined {
  const providerUsers = usersByProvider.get(providerId);
  if (!providerUsers) {
    return undefined;
  }
  return providerUsers.get(
    normalizeProviderUserId(providerId, providerUserId),
  );
}

export function findUserByEmail(email: string) {
  return findUserByProvider("email", email);
}

export function findUserById(id: string) {
  return usersById.get(id);
}
