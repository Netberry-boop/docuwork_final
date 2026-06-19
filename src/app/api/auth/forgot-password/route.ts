import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, generateToken } from "@/lib/auth";
import { ok, err } from "@/lib/api";
import { sendPasswordResetEmail } from "@/lib/email";
import { z } from "zod";

// POST /api/auth/forgot-password
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email } = z.object({ email: z.string().email() }).parse(body);

  const user = await db.user.findUnique({ where: { email } });

  // Always return success to prevent email enumeration
  if (!user) return ok({ message: "If that email exists, a reset link was sent." });

  const resetToken = generateToken();
  await db.user.update({
    where: { id: user.id },
    data: {
      resetToken,
      resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  await sendPasswordResetEmail(email, resetToken).catch(console.error);

  return ok({ message: "If that email exists, a reset link was sent." });
}
