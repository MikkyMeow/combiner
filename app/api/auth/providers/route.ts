import { NextResponse } from "next/server";
import { authService } from "@/app/lib/auth/service";

export async function GET() {
  const providers = authService.listProviders();
  return NextResponse.json({ providers });
}
