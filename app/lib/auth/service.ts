import { AuthError } from "@/app/lib/auth/errors";
import {
  LoginInput,
  PublicUser,
  RegistrationInput,
  StoredUser,
} from "@/app/lib/auth/types";
import { findUserById } from "@/app/lib/auth/user-store";
import { getProvider, listProviders } from "./providers";
import {
  createSession,
  deleteSession,
  getSession,
} from "./session-store";

function toPublicUser(user: StoredUser): PublicUser {
  const safeUser = { ...user };
  delete (safeUser as { passwordHash?: string }).passwordHash;
  return safeUser as PublicUser;
}

export { SESSION_COOKIE_NAME } from "./constants";
export class AuthService {
  listProviders() {
    return listProviders();
  }

  async register(input: RegistrationInput) {
    const provider = getProvider(input.providerId);
    if (!provider.supportsRegistration || !provider.register) {
      throw new AuthError(
        `Регистрация для провайдера ${provider.metadata.id} недоступна`,
      );
    }
    const user = await provider.register(input);
    const session = createSession(user.id);
    return { user: toPublicUser(user), session };
  }

  async login(input: LoginInput) {
    const provider = getProvider(input.providerId);
    const user = await provider.authenticate(input);
    const session = createSession(user.id);
    return { user: toPublicUser(user), session };
  }

  async getSessionUser(sessionToken: string | undefined) {
    const session = getSession(sessionToken);
    if (!session) {
      return null;
    }
    const user = findUserById(session.userId);
    if (!user) {
      deleteSession(sessionToken);
      return null;
    }
    return toPublicUser(user);
  }

  async logout(sessionToken: string | undefined) {
    const session = getSession(sessionToken);
    if (!session) {
      return;
    }
    deleteSession(sessionToken);
  }
}

export const authService = new AuthService();
