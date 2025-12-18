import { NextRequest } from "next/server";
import { AuthError } from "@/app/lib/auth/errors";
import { authService } from "@/app/lib/auth/service";
import { LoginInput } from "@/app/lib/auth/types";
import { handleAuthError, respondWithSession } from "../utils";

function parseLoginPayload(body: unknown): LoginInput {
  if (!body || typeof body !== "object") {
    throw new AuthError("Некорректный формат запроса");
  }

  const payload = body as Record<string, unknown>;
  const credentials = payload.credentials;

  if (!credentials || typeof credentials !== "object") {
    throw new AuthError("credentials обязательны");
  }

  const providerId =
    typeof payload.providerId === "string" ? payload.providerId : undefined;

  return {
    providerId,
    credentials: credentials as Record<string, unknown>,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = parseLoginPayload(body);
    const result = await authService.login(payload);
    return respondWithSession(result, 200);
  } catch (error) {
    return handleAuthError(error);
  }
}
