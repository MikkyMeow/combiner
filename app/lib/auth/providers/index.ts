import { ProviderNotFoundError } from "@/app/lib/auth/errors";
import { AuthProvider } from "@/app/lib/auth/types";
import { emailPasswordProvider } from "./emailPassword";

const providers = new Map<string, AuthProvider>(
  [[emailPasswordProvider.metadata.id, emailPasswordProvider]] as const,
);

const DEFAULT_PROVIDER = emailPasswordProvider.metadata.id;

export function getProvider(providerId?: string): AuthProvider {
  const id = providerId ?? DEFAULT_PROVIDER;
  const provider = providers.get(id);
  if (!provider) {
    throw new ProviderNotFoundError(id);
  }
  return provider;
}

export function listProviders() {
  return Array.from(providers.values()).map((provider) => provider.metadata);
}
