import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, authService } from "@/app/lib/auth/service";
import { handleAuthError } from "../utils";

export async function GET(request: NextRequest) {
  try {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const user = await authService.getSessionUser(sessionToken);
    return NextResponse.json({
      user: user
        ? { ...user, createdAt: user.createdAt.toISOString() }
        : null,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
