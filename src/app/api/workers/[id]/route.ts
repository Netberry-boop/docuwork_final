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
  if (worker.role !== Role.WORKER) return err("Worker not found", 404);
  if (user!.role === Role.MANAGER && worker.managedById !== user!.id) {
    return err("Forbidden", 403);
  }

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
}, [Role.SUPER_ADMIN, Role.MANAGER]);

/**
 * PATCH /api/workers/[id]
 * Updates worker settings, safely hashes passwords, and guarantees email uniqueness.
 */
export const PATCH = withAuth(
  async (req, user, { params }) => {
    // ✨ FIX: Await params for Next.js 15+ compatibility
    const { id } = await params;

    const targetUser = await db.user.findUnique({
      where: { id },
      select: { id: true, role: true, managedById: true },
    });
    if (!targetUser || targetUser.role !== Role.WORKER) return err("Worker not found", 404);
    if (user!.role === Role.MANAGER && targetUser.managedById !== user!.id) {
      return err("Forbidden", 403);
    }

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
 * Removes unused workers, or deactivates workers that already have operational history.
 */
export const DELETE = withAuth(
  async (req, user, { params }) => {
    const { id } = await params;

    const targetUser = await db.user.findUnique({
      where: { id },
      select: { id: true, role: true, managedById: true },
    });
    if (!targetUser || targetUser.role !== Role.WORKER) return err("Worker not found", 404);
    if (user!.role === Role.MANAGER && targetUser.managedById !== user!.id) {
      return err("Forbidden", 403);
    }

    try {
      const result = await db.$transaction(async (tx) => {
        const [taskCount, submissionCount, paymentCount, messageCount] = await Promise.all([
          tx.task.count({ where: { workerId: id } }),
          tx.submission.count({ where: { workerId: id } }),
          tx.payment.count({ where: { workerId: id } }),
          tx.message.count({
            where: {
              OR: [{ senderId: id }, { receiverId: id }],
            },
          }),
        ]);

        const hasOperationalHistory =
          taskCount > 0 || submissionCount > 0 || paymentCount > 0 || messageCount > 0;

        await tx.refreshToken.deleteMany({ where: { userId: id } });

        if (hasOperationalHistory) {
          await tx.user.update({
            where: { id },
            data: { isActive: false },
          });
        } else {
          await tx.auditLog.deleteMany({ where: { userId: id } });
          await tx.notification.deleteMany({ where: { userId: id } });
          await tx.user.delete({ where: { id } });
        }

        await tx.auditLog.create({
          data: {
            userId: user!.id,
            action: hasOperationalHistory ? "WORKER_DEACTIVATED" : "WORKER_DELETED",
            details: {
              workerId: id,
              mode: hasOperationalHistory ? "deactivated" : "deleted",
              preservedHistory: hasOperationalHistory,
            },
          },
        });

        return {
          message: hasOperationalHistory
            ? "Worker has history and was deactivated"
            : "Worker deleted successfully",
          deleted: !hasOperationalHistory,
          deactivated: hasOperationalHistory,
        };
      });

      return ok(result);
    } catch (error) {
      console.error("Worker deletion failed:", error);
      return err("Failed to delete worker", 500);
    }
  },
  [Role.SUPER_ADMIN, Role.MANAGER]
);
