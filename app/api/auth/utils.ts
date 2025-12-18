import { NextResponse } from "next/server";
import { AuthError } from "@/app/lib/auth/errors";
import { SESSION_COOKIE_NAME } from "@/app/lib/auth/service";
import { AuthSession, PublicUser } from "@/app/lib/auth/types";

const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

type SessionPayload = {
  user: PublicUser;
  session: AuthSession;
};

export function respondWithSession(
  payload: SessionPayload,
  status = 200,
): NextResponse {
  const response = NextResponse.json(
    {
      user: {
        ...payload.user,
        createdAt: payload.user.createdAt.toISOString(),
      },
    },
    { status },
  );
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: payload.session.token,
    expires: payload.session.expiresAt,
    ...baseCookieOptions,
  });
  return response;
}

export function respondWithSessionClear(status = 200) {
  const response = NextResponse.json({ success: true }, { status });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    expires: new Date(0),
    ...baseCookieOptions,
  });
  return response;
}

export function handleAuthError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      { status: error.status },
    );
  }
  console.error(error);
  return NextResponse.json(
    {
      error: "Внутренняя ошибка сервера",
      code: "UNEXPECTED_ERROR",
    },
    { status: 500 },
  );
}
