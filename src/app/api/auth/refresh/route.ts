import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { ok, err } from "@/lib/api";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { refreshToken } = body;
  if (!refreshToken) return err("Missing refresh token");

  const stored = await db.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!stored || stored.expiresAt < new Date()) {
    return err("Invalid or expired refresh token", 401);
  }

  if (!stored.user.isActive) {
    return err("Account deactivated", 401);
  }

  const accessToken = await signToken(
    { sub: stored.user.id, role: stored.user.role },
    process.env.JWT_EXPIRES_IN || "15m"
  );

  return ok({ accessToken });
}
