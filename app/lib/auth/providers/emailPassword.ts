import { createHash } from "crypto";
import {
  InvalidCredentialsError,
  UserAlreadyExistsError,
} from "@/app/lib/auth/errors";
import {
  AuthProvider,
  LoginInput,
  RegistrationInput,
  StoredUser,
} from "@/app/lib/auth/types";
import {
  createUserRecord,
  findUserByEmail,
} from "@/app/lib/auth/user-store";

function ensureString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new InvalidCredentialsError(
      `Поле ${field} обязательно для email-провайдера`,
    );
  }
  return value.trim();
}

function hashPassword(password: string) {
  return createHash("sha256").update(password).digest("hex");
}

function getCredentialValue(
  credentials: Record<string, unknown>,
  field: string,
) {
  return credentials[field];
}

function createPublicUser(data: {
  email: string;
  password: string;
  name: string;
}): StoredUser {
  return createUserRecord({
    providerId: "email",
    providerUserId: data.email,
    email: data.email,
    name: data.name,
    passwordHash: hashPassword(data.password),
  });
}

async function registerUser(input: RegistrationInput): Promise<StoredUser> {
  const email = ensureString(
    getCredentialValue(input.credentials, "email"),
    "email",
  ).toLowerCase();
  const password = ensureString(
    getCredentialValue(input.credentials, "password"),
    "password",
  );
  const nameValue = ensureString(input.profile?.name, "name");

  const existing = findUserByEmail(email);
  if (existing) {
    throw new UserAlreadyExistsError(email);
  }

  return createPublicUser({ email, password, name: nameValue });
}

async function authenticateUser(input: LoginInput): Promise<StoredUser> {
  const email = ensureString(
    getCredentialValue(input.credentials, "email"),
    "email",
  ).toLowerCase();
  const password = ensureString(
    getCredentialValue(input.credentials, "password"),
    "password",
  );

  const user = findUserByEmail(email);
  if (!user || !user.passwordHash) {
    throw new InvalidCredentialsError();
  }

  if (user.passwordHash !== hashPassword(password)) {
    throw new InvalidCredentialsError();
  }

  return user;
}

export const emailPasswordProvider: AuthProvider = {
  metadata: {
    id: "email",
    name: "Email и пароль",
    kind: "credentials",
  },
  supportsRegistration: true,
  register: registerUser,
  authenticate: authenticateUser,
};
