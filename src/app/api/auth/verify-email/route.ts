import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";

// GET /api/auth/verify-email?token=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return err("Missing token");

  const user = await db.user.findFirst({ where: { emailVerifyToken: token } });
  if (!user) return err("Invalid or expired verification token", 400);

  await db.user.update({
    where: { id: user.id },
    data: { isEmailVerified: true, emailVerifyToken: null },
  });

  return ok({ message: "Email verified successfully" });
}
