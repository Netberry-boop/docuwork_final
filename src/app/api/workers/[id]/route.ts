import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err, withAuth } from "@/lib/api";
import { Role } from "@prisma/client";
import { hashPassword } from "@/lib/auth";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

/**
 * GET /api/workers/[id]
 * Fetches worker details, grouped task statistics, and aggregate earnings metadata.
 */
export const GET = withAuth(async (req, user, { params }) => {
  // ✨ FIX: Await params for Next.js 15+ compatibility
  const { id } = await params;

  const worker = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      avatar: true,
      createdAt: true,
      managedById: true,
      _count: { select: { assignedTasks: true, submissions: true, payments: true } },
    },
  });

  if (!worker) return err("Worker not found", 404);

  // Run aggregations concurrently
  const [taskStats, totalEarnings] = await Promise.all([
    db.task.groupBy({
      by: ["status"],
      where: { workerId: id },
      _count: { status: true },
    }),
    db.payment.aggregate({
      where: { workerId: id },
      _sum: { amount: true },
    }),
  ]);

  // Map grouped results array efficiently into an associative record dictionary
  const taskMap = taskStats.reduce((acc, t) => {
    acc[t.status] = t._count.status;
    return acc;
  }, {} as Record<string, number>);

  return ok({
    ...worker,
    taskStats: taskMap,
    totalEarnings: totalEarnings._sum.amount ?? 0,
  });
});

/**
 * PATCH /api/workers/[id]
 * Updates worker settings, safely hashes passwords, and guarantees email uniqueness.
 */
export const PATCH = withAuth(
  async (req, user, { params }) => {
    // ✨ FIX: Await params for Next.js 15+ compatibility
    const { id } = await params;

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.errors[0].message, 400);

    const updateData: Record<string, any> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) updateData[key] = value;
    }

    // Process secure password string mutations
    if (parsed.data.password) {
      updateData.passwordHash = await hashPassword(parsed.data.password);
      delete updateData.password;
    }

    // Guard unique indexing validation for custom emails
    if (parsed.data.email) {
      const existing = await db.user.findFirst({
        where: { email: parsed.data.email, NOT: { id } },
      });
      if (existing) return err("Email already in use", 400);
    }

    try {
      const updated = await db.$transaction(async (tx) => {
        const res = await tx.user.update({
          where: { id },
          data: updateData,
          select: { id: true, name: true, email: true, role: true, isActive: true, updatedAt: true },
        });

        await tx.auditLog.create({
          data: {
            userId: user!.id,
            action: "WORKER_UPDATED",
            details: { workerId: id, changes: Object.keys(parsed.data) },
          },
        });

        return res;
      });

      return ok(updated);
    } catch (error) {
      console.error("Worker update process failed:", error);
      return err("Failed to update worker records", 500);
    }
  },
  [Role.SUPER_ADMIN, Role.MANAGER]
);

/**
 * DELETE /api/workers/[id]
 * Deactivates worker account profile via standard soft-delete behavior.
 */
export const DELETE = withAuth(
  async (req, user, { params }) => {
    // ✨ FIX: Await params for Next.js 15+ compatibility
    const { id } = await params;

    const targetUser = await db.user.findUnique({ where: { id } });
    if (!targetUser) return err("Worker not found", 404);

    try {
      await db.$transaction([
        db.user.update({
          where: { id },
          data: { isActive: false },
        }),
        db.auditLog.create({
          data: {
            userId: user!.id,
            action: "WORKER_DEACTIVATED",
            details: { workerId: id },
          },
        }),
      ]);
    } catch (error) {
      console.error("Worker deactivation failed:", error);
      return err("Failed to deactivate worker status", 500);
    }

    return ok({ message: "Worker deactivated successfully" });
  },
  [Role.SUPER_ADMIN, Role.MANAGER]
);