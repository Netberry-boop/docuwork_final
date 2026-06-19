import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { generateToken } from "@/lib/auth";
import { ok, err } from "@/lib/api";
import { isEmailConfigured, sendPasswordResetEmail } from "@/lib/email";
import { z } from "zod";

// POST /api/auth/forgot-password
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = z.object({ email: z.string().email() }).safeParse(body);
  if (!parsed.success) return err("Enter a valid email address", 400);
  const { email } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });

  // Always return success to prevent email enumeration
  if (!user) {
    return ok({ message: "If that email exists, a reset request was created." });
  }

  const resetToken = generateToken();
  await db.user.update({
    where: { id: user.id },
    data: {
      resetToken,
      resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  const emailConfigured = isEmailConfigured();
  if (emailConfigured) {
    await sendPasswordResetEmail(email, resetToken).catch(console.error);
  }

  return ok({
    message: emailConfigured
      ? "If that email exists, a reset link was sent."
      : "Reset request created. Ask a super admin to approve it.",
    requiresAdminApproval: !emailConfigured,
  });
}
