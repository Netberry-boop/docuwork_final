import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err, withAuth } from "@/lib/api";
import { Role } from "@prisma/client";
import { z } from "zod";

const reviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "REWORK_REQUIRED"]),
  comments: z.string().optional(),
  accuracyScore: z.number().min(0).max(100).optional(),
});

export const POST = withAuth(
  async (req, user, { params }) => {
    // ✨ FIX: Await params in Next.js 15+
    const { id } = await params;

    // 1. Fetch task details (including missing fields title, paymentAmount, and activeSubmissionId)
    const task = await db.task.findUnique({
      where: { id },
      include: {
        worker: { select: { id: true, name: true, email: true } },
      },
    });

    if (!task) return err("Task not found", 404);
    // ✨ FIX: Ensure activeSubmissionId actually exists on the model
    if (!task.activeSubmissionId) return err("No submission to review", 400); 
    if (!["SUBMITTED", "UNDER_REVIEW"].includes(task.status)) {
      return err("Task is not in a reviewable state", 400);
    }

    // 2. Validate request body
    const body = await req.json();
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.errors[0].message, 400);

    const { status, comments, accuracyScore } = parsed.data;
    const targetSubmissionId = task.activeSubmissionId;

    try {
      // 3. Execute database mutations inside an atomic transaction
      const review = await db.$transaction(async (tx) => {
        // A. Upsert the Review details
        const reviewRecord = await tx.review.upsert({
          where: { submissionId: targetSubmissionId },
          create: {
            submissionId: targetSubmissionId,
            reviewerId: user!.id,
            status,
            comments,
            accuracyScore,
          },
          update: {
            reviewerId: user!.id,
            status,
            comments,
            accuracyScore,
          },
        });

        // B. Update Task status matching the review status directly
        await tx.task.update({
          where: { id: task.id },
          data: { status },
        });

        // C. Process worker notifications and payments if worker is assigned
        if (task.worker) {
          const notifType = status === "APPROVED" ? "TASK_APPROVED" : "TASK_REJECTED";
          
          const notifTitle = 
            status === "APPROVED" 
              ? "Task approved!" 
              : status === "REWORK_REQUIRED" 
              ? "Rework required" 
              : "Task rejected";

          await tx.notification.create({
            data: {
              userId: task.worker.id,
              taskId: task.id,
              type: notifType,
              title: notifTitle,
              body: comments || `Your submission has been ${status.toLowerCase().replace("_", " ")}.`,
            },
          });

          // Process payments safely if approved and valid payment setup exists
          if (status === "APPROVED" && task.paymentAmount && task.paymentAmount > 0) {
            await tx.payment.create({
              data: {
                workerId: task.worker.id,
                taskId: task.id,
                amount: task.paymentAmount,
                type: "task",
                description: `Payment for: ${task.title || "Task assignment"}`,
              },
            });
          }
        }

        // D. Commit an action statement into Audit Logs
        await tx.auditLog.create({
          data: {
            userId: user!.id,
            taskId: task.id,
            action: `TASK_${status}`,
            details: { comments, score: accuracyScore },
          },
        });

        return reviewRecord;
      });

      return ok(review);
    } catch (dbError) {
      console.error("Review processing failed transactionally:", dbError);
      return err("Failed to submit review due to a server error", 500);
    }
  },
  [Role.SUPER_ADMIN, Role.MANAGER]
);