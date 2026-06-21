import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err, paginate, withAuth, getPagination, getAuthUser } from "@/lib/api";
import { Role, TaskStatus } from "@prisma/client";
import { z } from "zod";
import { sendTaskAssignedEmail } from "@/lib/email";

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  deadline: z.string().optional(),
  estimatedPages: z.number().optional(),
  paymentAmount: z.number().default(0),
  documentId: z.string(),
  projectId: z.string().optional(),
  pageNumber: z.number().int().positive().optional(),
  workerId: z.string().optional(),
  instructions: z.string().optional(),
});

// GET /api/tasks
export const GET = withAuth(async (req, user) => {
  const { page, limit, skip } = getPagination(req);
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as TaskStatus | null;
  const workerId = searchParams.get("workerId");
  const projectId = searchParams.get("projectId");
  const sort = searchParams.get("sort") || "";
  const search = searchParams.get("search") || "";

  const where: Record<string, unknown> = {};

  if (user!.role === Role.WORKER) {
    where.workerId = user!.id;
  } else if (user!.role === Role.MANAGER) {
    where.createdById = user!.id;
    if (workerId) where.workerId = workerId;
  } else if (workerId) {
    where.workerId = workerId;
  }

  if (status) where.status = status;
  if (projectId) where.projectId = projectId;
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const orderBy = sort === "pageNumber"
    ? ({ pageNumber: "asc" } as const)
    : ({ createdAt: "desc" } as const);

  const [tasks, total] = await Promise.all([
    db.task.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        worker: { select: { id: true, name: true, email: true, avatar: true } },
        document: { select: { id: true, name: true, fileType: true, thumbnailUrl: true } },
        project: { select: { id: true, title: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { submissions: true } },
      },
    }),
    db.task.count({ where }),
  ]);

  return paginate(tasks, total, page, limit);
});

// POST /api/tasks
export const POST = withAuth(async (req, user) => {
  if (!user || user.role === Role.WORKER) return err("Forbidden", 403);

  const body = await req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const data = parsed.data;
  const document = await db.document.findUnique({
    where: { id: data.documentId },
    select: { id: true, uploadedById: true },
  });
  if (!document) return err("Document not found", 404);
  if (user.role === Role.MANAGER && document.uploadedById !== user.id) {
    return err("Document not found", 404);
  }

  let project = null;
  if (data.projectId) {
    project = await db.project.findUnique({
      where: { id: data.projectId },
      select: { id: true, managerId: true, workerId: true },
    });
    if (!project) {
      return err("Project not found", 404);
    }
    if (user.role === Role.MANAGER && project.managerId !== user.id) {
      return err("Project not found", 404);
    }
    if (!data.workerId && project.workerId) {
      data.workerId = project.workerId;
    }
  }

  if (data.workerId) {
    const worker = await db.user.findUnique({
      where: { id: data.workerId },
      select: { id: true, role: true, managedById: true, isActive: true },
    });
    if (!worker || worker.role !== Role.WORKER || !worker.isActive) {
      return err("Worker not found", 404);
    }
    if (user.role === Role.MANAGER && worker.managedById !== user.id) {
      return err("Worker not found", 404);
    }
  }

  const task = await db.task.create({
    data: {
      ...data,
      deadline: data.deadline ? new Date(data.deadline) : undefined,
      createdById: user.id,
      status: data.workerId ? "ASSIGNED" : "ASSIGNED",
      projectId: data.projectId || undefined,
    },
    include: {
      worker: { select: { id: true, name: true, email: true } },
      document: true,
      project: { select: { id: true, title: true } },
    },
  });

  if (task.worker) {
    await sendTaskAssignedEmail(
      task.worker.email,
      task.worker.name,
      task.title,
      task.id
    ).catch(console.error);

    await db.notification.create({
      data: {
        userId: task.worker.id,
        taskId: task.id,
        type: "TASK_ASSIGNED",
        title: "New task assigned",
        body: `You have been assigned: ${task.title}`,
      },
    });
  }

  await db.auditLog.create({
    data: {
      userId: user.id,
      taskId: task.id,
      action: "TASK_CREATED",
      details: { title: task.title },
    },
  });

  return ok(task, 201);
}, [Role.SUPER_ADMIN, Role.MANAGER]);
