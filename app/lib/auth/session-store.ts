import { AuthSession } from "./types";

type SessionStore = {
  sessions: Map<string, AuthSession>;
};

const globalSessionStore =
  (globalThis as typeof globalThis & { __combinerSessionStore?: SessionStore })
    .__combinerSessionStore ??
  {
    sessions: new Map<string, AuthSession>(),
  };

if (
  !(globalThis as typeof globalThis & { __combinerSessionStore?: SessionStore })
    .__combinerSessionStore
) {
  (globalThis as typeof globalThis & { __combinerSessionStore?: SessionStore })
    .__combinerSessionStore = globalSessionStore;
}

const sessions = globalSessionStore.sessions;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 дней

function generateToken() {
  return crypto.randomUUID() + crypto.randomUUID();
}

function isExpired(session: AuthSession) {
  return session.expiresAt.getTime() < Date.now();
}

export function createSession(userId: string): AuthSession {
  const session: AuthSession = {
    token: generateToken(),
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  };
  sessions.set(session.token, session);
  return session;
}

export function getSession(token: string | undefined): AuthSession | undefined {
  if (!token) {
    return undefined;
  }
  const session = sessions.get(token);
  if (!session) {
    return undefined;
  }
  if (isExpired(session)) {
    sessions.delete(token);
    return undefined;
  }
  return session;
}

export function deleteSession(token: string | undefined) {
  if (!token) {
    return;
  }
  sessions.delete(token);
}
