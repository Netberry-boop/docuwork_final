import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err, withAuth } from "@/lib/api";
import { Role } from "@prisma/client";
import { deleteFile } from "@/lib/storage";

/**
 * GET /api/documents/[id]
 * Fetches a single document along with its associated tasks and worker details.
 */
export const GET = withAuth(async (req, user, { params }) => {
  const { id } = await params;

  const doc = await db.document.findUnique({
    where: { id },
    include: {
      tasks: {
        select: {
          id: true,
          title: true,
          status: true,
          worker: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!doc) {
    return err("Document not found", 404);
  }
  if (user!.role === Role.MANAGER && doc.uploadedById !== user!.id) {
    return err("Document not found", 404);
  }

  return ok(doc);
});

/**
 * DELETE /api/documents/[id]
 * Deletes a document, its corresponding storage file, and logs the action.
 * Restricted to SUPER_ADMIN and MANAGER roles.
 */
export const DELETE = withAuth(
  async (req, user, { params }) => {
    const { id } = await params;

    // 1. Verify the document exists
    const doc = await db.document.findUnique({ where: { id } });
    if (!doc) {
      return err("Document not found", 404);
    }
    if (user!.role === Role.MANAGER && doc.uploadedById !== user!.id) {
      return err("Document not found", 404);
    }

    // 2. Prevent deletion if the document is actively tied to tasks
    const taskCount = await db.task.count({ where: { documentId: id } });
    if (taskCount > 0) {
      return err(`Cannot delete: document is used in ${taskCount} task(s)`, 400);
    }

    // 3. Attempt to delete the object from Vercel Blob.
    if (doc.storageUrl) {
      try {
        await deleteFile(doc.storageUrl);
      } catch (error) {
        // Log the storage failure but don't block DB cleanup if storage is already orphaned
        console.error("Blob delete failed for", doc.storageUrl, error);
      }
    }

    // 4. Atomic Database Execution: Delete record and create audit log safely
    try {
      await db.$transaction([
        db.document.delete({ 
          where: { id } 
        }),
        db.auditLog.create({
          data: {
            userId: user!.id,
            action: "DOCUMENT_DELETED",
            details: { name: doc.name },
          },
        }),
      ]);
    } catch (dbError) {
      console.error("Database transaction failed:", dbError);
      return err("Failed to delete document from database", 500);
    }

    return ok({ message: "Document deleted successfully" });
  },
  [Role.SUPER_ADMIN, Role.MANAGER]
);
