import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, signToken, generateToken } from "@/lib/auth";
import { ok, err } from "@/lib/api";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return err("Invalid input");

  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return err("Invalid credentials", 401);

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) return err("Invalid credentials", 401);

  const accessToken = await signToken(
    { sub: user.id, role: user.role },
    process.env.JWT_EXPIRES_IN || "15m"
  );
  const refreshToken = generateToken(48);

  await db.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "LOGIN",
      ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
    },
  });

  const { passwordHash: _, emailVerifyToken: __, resetToken: ___, ...safeUser } = user;
  return ok({ accessToken, refreshToken, user: safeUser });
}
