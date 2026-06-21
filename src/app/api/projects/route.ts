import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err, paginate, withAuth, getPagination } from "@/lib/api";
import { Role } from "@prisma/client";
import { z } from "zod";

const createProjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  workerId: z.string().optional(),
});

export const GET = withAuth(async (req, user) => {
  const { page, limit, skip } = getPagination(req);
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";

  const where: Record<string, unknown> = {};
  if (user!.role === Role.WORKER) {
    where.workerId = user!.id;
  } else if (user!.role === Role.MANAGER) {
    where.managerId = user!.id;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  const [projects, total] = await Promise.all([
    db.project.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        worker: { select: { id: true, name: true, email: true } },
        _count: { select: { tasks: true } },
      },
    }),
    db.project.count({ where }),
  ]);

  return paginate(projects, total, page, limit);
});

export const POST = withAuth(async (req, user) => {
  if (!user || user.role === Role.WORKER) return err("Forbidden", 403);

  const body = await req.json();
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const data = parsed.data;
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

  const project = await db.project.create({
    data: {
      title: data.title,
      description: data.description,
      managerId: user.id,
      workerId: data.workerId || undefined,
    },
    include: {
      worker: { select: { id: true, name: true, email: true } },
    },
  });

  return ok(project, 201);
}, [Role.SUPER_ADMIN, Role.MANAGER]);
