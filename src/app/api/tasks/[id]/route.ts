import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err, withAuth } from "@/lib/api";
import { Role } from "@prisma/client";
import { z } from "zod";

const updateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  deadline: z.string().optional(),
  status: z
    .enum([
      "ASSIGNED",
      "IN_PROGRESS",
      "SUBMITTED",
      "UNDER_REVIEW",
      "APPROVED",
      "REJECTED",
      "REWORK_REQUIRED",
      "COMPLETED",
    ])
    .optional(),
  workerId: z.string().nullable().optional(),
  paymentAmount: z.number().optional(),
  instructions: z.string().optional(),
});

export const GET = withAuth(async (req, user, { params }) => {
  const { id } = await params;

  const task = await db.task.findUnique({
    where: { id },
    include: {
      worker: { select: { id: true, name: true, email: true, avatar: true } },
      createdBy: { select: { id: true, name: true } },
      document: true,
      submissions: {
        orderBy: { version: "desc" },
        take: 5,
        include: {
          review: {
            include: { reviewer: { select: { id: true, name: true } } },
          },
          worker: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!task) return err("Task not found", 404);
  if (user!.role === Role.WORKER && task.workerId !== user!.id) {
    return err("Forbidden", 403);
  }
  if (user!.role === Role.MANAGER && task.createdById !== user!.id) {
    return err("Forbidden", 403);
  }

  return ok(task);
});

export const PATCH = withAuth(async (req, user, { params }) => {
  const { id } = await params;

  const task = await db.task.findUnique({ where: { id } });
  if (!task) return err("Task not found", 404);
  if (user!.role === Role.MANAGER && task.createdById !== user!.id) {
    return err("Forbidden", 403);
  }

  const body = await req.json();

  // Route protection and validation logic for WORKER role
  if (user!.role === Role.WORKER) {
    if (task.workerId !== user!.id) return err("Forbidden", 403);
    if (body.status !== "IN_PROGRESS") {
      return err("Workers can only mark tasks as in progress", 400);
    }
    
    const updated = await db.task.update({
      where: { id },
      data: { status: "IN_PROGRESS" },
    });
    
    return ok(updated);
  }

  // Admin / Manager schema validation logic
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0].message, 400);

  if (parsed.data.workerId) {
    const worker = await db.user.findUnique({
      where: { id: parsed.data.workerId },
      select: { id: true, role: true, managedById: true, isActive: true },
    });
    if (!worker || worker.role !== Role.WORKER || !worker.isActive) {
      return err("Worker not found", 404);
    }
    if (user!.role === Role.MANAGER && worker.managedById !== user!.id) {
      return err("Worker not found", 404);
    }
  }

  // DB Operations inside a transaction for complete structural integrity
  try {
    const updated = await db.$transaction(async (tx) => {
      // Safely build the payload to filter out true `undefined` values if they leak
      const updateData: Record<string, any> = {};
      for (const [key, value] of Object.entries(parsed.data)) {
        if (value !== undefined) {
          updateData[key] = value;
        }
      }

      // Explicitly convert deadline string to Date object if present
      if (parsed.data.deadline) {
        updateData.deadline = new Date(parsed.data.deadline);
      }

      const res = await tx.task.update({
        where: { id },
        data: updateData,
      });

      await tx.auditLog.create({
        data: {
          userId: user!.id,
          taskId: task.id,
          action: "TASK_UPDATED",
          details: parsed.data as object,
        },
      });

      return res;
    });

    return ok(updated);
  } catch (error) {
    console.error("Task update failed:", error);
    return err("Failed to update task", 500);
  }
});

export const DELETE = withAuth(
  async (req, user, { params }) => {
    const { id } = await params;

    const task = await db.task.findUnique({ where: { id } });
    if (!task) return err("Task not found", 404);
    if (user!.role === Role.MANAGER && task.createdById !== user!.id) {
      return err("Forbidden", 403);
    }

    try {
      await db.$transaction(async (tx) => {
        await tx.review.deleteMany({
          where: { submission: { taskId: id } },
        });

        await tx.task.update({
          where: { id },
          data: { activeSubmissionId: null },
        });

        await tx.submission.deleteMany({ where: { taskId: id } });
        await tx.notification.deleteMany({ where: { taskId: id } });
        await tx.message.deleteMany({ where: { taskId: id } });
        await tx.auditLog.deleteMany({ where: { taskId: id } });
        await tx.task.delete({ where: { id } });

        await tx.auditLog.create({
          data: { 
            userId: user!.id, 
            action: "TASK_DELETED",
            details: { taskId: id, title: task.title },
          },
        });
      });
    } catch (error) {
      console.error("Task deletion failed:", error);
      return err("Failed to delete task", 500);
    }

    return ok({ message: "Task deleted" });
  },
  [Role.SUPER_ADMIN, Role.MANAGER]
);
