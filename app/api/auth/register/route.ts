import { NextRequest } from "next/server";
import { AuthError } from "@/app/lib/auth/errors";
import { authService } from "@/app/lib/auth/service";
import { RegistrationInput } from "@/app/lib/auth/types";
import { handleAuthError, respondWithSession } from "../utils";

function parseRegistrationPayload(body: unknown): RegistrationInput {
  if (!body || typeof body !== "object") {
    throw new AuthError("Некорректный формат запроса");
  }
  const payload = body as Record<string, unknown>;
  const credentials = payload.credentials;

  if (!credentials || typeof credentials !== "object") {
    throw new AuthError("credentials обязательны");
  }

  const profile =
    payload.profile && typeof payload.profile === "object"
      ? (payload.profile as Record<string, unknown>)
      : undefined;

  const providerId =
    typeof payload.providerId === "string" ? payload.providerId : undefined;

  return {
    providerId,
    credentials: credentials as Record<string, unknown>,
    profile,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = parseRegistrationPayload(body);
    const result = await authService.register(payload);
    return respondWithSession(result, 201);
  } catch (error) {
    return handleAuthError(error);
  }
}
