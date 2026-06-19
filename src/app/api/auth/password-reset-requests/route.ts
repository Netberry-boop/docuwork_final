import { NextRequest } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateToken, hashPassword } from "@/lib/auth";
import { err, ok, withAuth } from "@/lib/api";

const resolveSchema = z.object({
  userId: z.string(),
});

function appUrl(req: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
}

export const GET = withAuth(async (req) => {
  const users = await db.user.findMany({
    where: {
      resetToken: { not: null },
      resetTokenExpiry: { gt: new Date() },
    },
    orderBy: { resetTokenExpiry: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      resetToken: true,
      resetTokenExpiry: true,
      createdAt: true,
    },
  });

  return ok(
    users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      requestedAt: user.resetTokenExpiry
        ? new Date(user.resetTokenExpiry.getTime() - 60 * 60 * 1000)
        : null,
      expiresAt: user.resetTokenExpiry,
      resetLink: `${appUrl(req)}/reset-password?token=${user.resetToken}`,
      createdAt: user.createdAt,
    }))
  );
}, [Role.SUPER_ADMIN]);

export const PATCH = withAuth(async (req, admin) => {
  const body = await req.json().catch(() => ({}));
  const parsed = resolveSchema.safeParse(body);
  if (!parsed.success) return err("Invalid request", 400);

  const user = await db.user.findFirst({
    where: {
      id: parsed.data.userId,
      resetToken: { not: null },
      resetTokenExpiry: { gt: new Date() },
    },
    select: { id: true, name: true, email: true },
  });
  if (!user) return err("Reset request not found or expired", 404);

  const tempPassword = generateToken(12);
  const passwordHash = await hashPassword(tempPassword);

  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    }),
    db.refreshToken.deleteMany({ where: { userId: user.id } }),
    db.auditLog.create({
      data: {
        userId: admin!.id,
        action: "PASSWORD_RESET_APPROVED",
        details: { userId: user.id, email: user.email },
      },
    }),
  ]);

  return ok({
    user: { id: user.id, name: user.name, email: user.email },
    tempPassword,
  });
}, [Role.SUPER_ADMIN]);
