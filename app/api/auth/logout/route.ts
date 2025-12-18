import { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, authService } from "@/app/lib/auth/service";
import { handleAuthError, respondWithSessionClear } from "../utils";

export async function POST(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    await authService.logout(sessionToken);
    return respondWithSessionClear();
  } catch (error) {
    return handleAuthError(error);
  }
}
