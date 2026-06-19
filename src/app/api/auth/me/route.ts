import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { ok, err, getAuthUser, withAuth } from "@/lib/api";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  password: z.string().min(8).optional(),
});

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return err("Unauthorized", 401);
  return ok(user);
}

export const PATCH = withAuth(async (req, user) => {
  const body = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0].message, 400);

  const updateData: { name?: string; passwordHash?: string } = {};
  if (parsed.data.name) updateData.name = parsed.data.name;
  if (parsed.data.password) {
    updateData.passwordHash = await hashPassword(parsed.data.password);
  }

  if (Object.keys(updateData).length === 0) {
    return err("No changes provided", 400);
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.user.update({
      where: { id: user!.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: user!.id,
        action: "PROFILE_UPDATED",
        details: { changes: Object.keys(parsed.data) },
      },
    });

    return result;
  });

  return ok(updated);
});
