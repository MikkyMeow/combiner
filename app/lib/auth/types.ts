export type ProviderKind = "credentials" | "oauth";

export interface ProviderMetadata {
  id: string;
  name: string;
  kind: ProviderKind;
}

export interface AuthUser {
  id: string;
  providerId: string;
  providerUserId: string;
  email?: string;
  name?: string;
  avatarUrl?: string;
  createdAt: Date;
}

export interface StoredUser extends AuthUser {
  passwordHash?: string;
}

export type PublicUser = Omit<StoredUser, "passwordHash">;

export interface AuthSession {
  token: string;
  userId: string;
  expiresAt: Date;
}

export interface RegistrationInput {
  providerId?: string;
  profile?: Record<string, unknown>;
  credentials: Record<string, unknown>;
}

export interface LoginInput {
  providerId?: string;
  credentials: Record<string, unknown>;
}

export interface AuthProvider {
  metadata: ProviderMetadata;
  supportsRegistration: boolean;
  register?(input: RegistrationInput): Promise<StoredUser>;
  authenticate(input: LoginInput): Promise<StoredUser>;
}
