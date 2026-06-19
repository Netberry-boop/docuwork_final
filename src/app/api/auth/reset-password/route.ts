import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { ok, err } from "@/lib/api";
import { z } from "zod";

const schema = z.object({
  token: z.string(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err("Invalid input");

  const { token, password } = parsed.data;

  const user = await db.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: { gt: new Date() },
    },
  });

  if (!user) return err("Invalid or expired reset token", 400);

  const passwordHash = await hashPassword(password);

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetTokenExpiry: null },
  });

  // Revoke all refresh tokens
  await db.refreshToken.deleteMany({ where: { userId: user.id } });

  return ok({ message: "Password reset successful. Please log in." });
}
