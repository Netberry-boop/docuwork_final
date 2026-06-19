import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err, withAuth } from "@/lib/api";
import { Role } from "@prisma/client";
import { z } from "zod";

const submitSchema = z.object({
  content: z.string().min(1, "Content cannot be empty"),
  wordCount: z.number().default(0),
  charCount: z.number().default(0),
  timeSpentSec: z.number().default(0),
  isDraft: z.boolean().default(false),
});

/**
 * GET /api/tasks/[id]/submissions
 * Retrieves the latest submission or draft for a given task.
 */
export const GET = withAuth(async (req, user, { params }) => {
  // ✨ FIX: Await params for Next.js 15+ compatibility
  const { id } = await params;

  const task = await db.task.findUnique({ where: { id } });
  if (!task) return err("Task not found", 404);
  
  if (user!.role === Role.WORKER && task.workerId !== user!.id) {
    return err("Forbidden", 403);
  }

  const submission = await db.submission.findFirst({
    where: { taskId: id },
    orderBy: { version: "desc" },
    include: {
      worker: { select: { id: true, name: true } },
      review: {
        include: { reviewer: { select: { id: true, name: true } } },
      },
    },
  });

  return ok(submission);
});

/**
 * POST /api/tasks/[id]/submissions
 * Saves a draft or creates a final task submission.
 */
export const POST = withAuth(
  async (req, user, { params }) => {
    // ✨ FIX: Await params for Next.js 15+ compatibility
    const { id } = await params;

    const task = await db.task.findUnique({ where: { id } });
    if (!task) return err("Task not found", 404);
    if (task.workerId !== user!.id) return err("Not your task", 403);
    if (["APPROVED", "COMPLETED"].includes(task.status)) {
      return err("Task is already completed", 400);
    }

    const body = await req.json();
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.errors[0].message, 400);

    try {
      // ✨ FIX: Wrap related operations in an atomic transaction
      const result = await db.$transaction(async (tx) => {
        // Find the sequence value for the versioning counter
        const last = await tx.submission.findFirst({
          where: { taskId: task.id, workerId: user!.id },
          orderBy: { version: "desc" },
        });
        const nextVersion = (last?.version ?? 0) + 1;

        // Create the new submission snapshot
        const newSubmission = await tx.submission.create({
          data: {
            taskId: task.id,
            workerId: user!.id,
            content: parsed.data.content,
            wordCount: parsed.data.wordCount,
            charCount: parsed.data.charCount,
            timeSpentSec: parsed.data.timeSpentSec,
            isDraft: parsed.data.isDraft,
            version: nextVersion,
          },
        });

        // Track the forward reference on parent task and update progress states
        await tx.task.update({
          where: { id: task.id },
          data: {
            status: parsed.data.isDraft ? "IN_PROGRESS" : "SUBMITTED",
            activeSubmissionId: newSubmission.id,
          },
        });

        return newSubmission;
      });

      return ok(result, 201);
    } catch (error) {
      console.error("Submission creation failed transactionally:", error);
      return err("An error occurred while saving your submission", 500);
    }
  },
  [Role.WORKER]
);