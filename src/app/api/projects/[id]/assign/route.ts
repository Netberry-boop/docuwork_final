import { db } from "@/lib/db";
import { ok, err, withAuth } from "@/lib/api";
import { Role } from "@prisma/client";
import { z } from "zod";

const assignProjectSchema = z.object({
  workerIds: z.array(z.string()).min(1, "Select at least one worker"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  deadline: z.string().optional(),
  paymentAmount: z.number().default(0),
  instructions: z.string().optional(),
});

export const POST = withAuth(async (req, user, { params }) => {
  if (!user || user.role === Role.WORKER) return err("Forbidden", 403);

  const { id } = await params;
  const body = await req.json();
  const parsed = assignProjectSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0]?.message || parsed.error.message, 400);

  const data = parsed.data;
  const workerIds = Array.from(new Set(data.workerIds));

  const project = await db.project.findUnique({
    where: { id },
    include: {
      documents: {
        orderBy: { pageNumber: "asc" },
        include: { document: { select: { id: true, name: true } } },
      },
    },
  });

  if (!project) return err("Project not found", 404);
  if (user.role === Role.MANAGER && project.managerId !== user.id) {
    return err("Project not found", 404);
  }
  if (project.documents.length === 0) {
    return err("Project must include documents before it can be assigned", 400);
  }

  const workers = await db.user.findMany({
    where: { id: { in: workerIds }, role: Role.WORKER, isActive: true },
    select: { id: true, name: true, email: true, managedById: true },
  });

  if (workers.length !== workerIds.length) {
    return err("Some workers were not found", 404);
  }
  if (user.role === Role.MANAGER && workers.some(worker => worker.managedById !== user.id)) {
    return err("Some workers were not found", 404);
  }

  const existingTasks = await db.task.findMany({
    where: {
      projectId: project.id,
      workerId: { in: workerIds },
      documentId: { in: project.documents.map(item => item.documentId) },
    },
    select: { workerId: true, documentId: true },
  });
  const existingTaskKeys = new Set(existingTasks.map(task => `${task.workerId}:${task.documentId}`));

  const tasksToCreate = workers.flatMap(worker =>
    project.documents
      .filter(item => !existingTaskKeys.has(`${worker.id}:${item.documentId}`))
      .map(item => ({
        title: `${project.title} - ${item.document.name}`,
        description: project.description || undefined,
        documentId: item.documentId,
        projectId: project.id,
        workerId: worker.id,
        pageNumber: item.pageNumber,
        createdById: user.id,
        priority: data.priority,
        deadline: data.deadline ? new Date(data.deadline) : undefined,
        paymentAmount: data.paymentAmount,
        instructions: data.instructions || undefined,
        status: "ASSIGNED" as const,
      }))
  );

  const result = await db.$transaction(async (tx) => {
    await tx.projectAssignment.createMany({
      data: workers.map(worker => ({
        projectId: project.id,
        workerId: worker.id,
        assignedById: user.id,
      })),
      skipDuplicates: true,
    });

    if (tasksToCreate.length > 0) {
      await tx.task.createMany({ data: tasksToCreate });
    }

    await tx.notification.createMany({
      data: workers.map(worker => ({
        userId: worker.id,
        type: "TASK_ASSIGNED" as const,
        title: `Project assigned: ${project.title}`,
        body: `${project.documents.length} document tasks are available in this project.`,
      })),
    });

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: "PROJECT_ASSIGNED",
        details: {
          projectId: project.id,
          workerIds,
          taskCount: tasksToCreate.length,
        },
      },
    });

    return {
      projectId: project.id,
      assignedWorkers: workers.length,
      createdTasks: tasksToCreate.length,
      skippedExistingTasks: existingTasks.length,
    };
  });

  return ok(result, 201);
}, [Role.SUPER_ADMIN, Role.MANAGER]);
