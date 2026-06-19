import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, generateToken } from "@/lib/auth";
import { ok, err } from "@/lib/api";
import { sendVerificationEmail } from "@/lib/email";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(2, "Name must be at least 2 characters"),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0].message);

  const { email, password, name } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return err("Email already registered");

  const passwordHash = await hashPassword(password);
  const verifyToken = generateToken();

  const user = await db.user.create({
    data: { email, passwordHash, name, emailVerifyToken: verifyToken },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  await sendVerificationEmail(email, verifyToken).catch(console.error);

  return ok({ user, message: "Account created. Please verify your email." }, 201);
}
