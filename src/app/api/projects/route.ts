import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err, paginate, withAuth, getPagination } from "@/lib/api";
import { Role } from "@prisma/client";
import { z } from "zod";

const createProjectSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  documentIds: z.array(z.string()).max(200).optional(),
});

export const GET = withAuth(async (req, user) => {
  const { page, limit, skip } = getPagination(req);
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";

  const where: Record<string, unknown> = {};
  if (user!.role === Role.WORKER) {
    where.assignments = { some: { workerId: user!.id } };
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
        assignments: {
          include: { worker: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { tasks: true, documents: true, assignments: true } },
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
  const documentIds = data.documentIds ? Array.from(new Set(data.documentIds)) : [];
  let documents: Array<{ id: string; name: string; uploadedById: string }> = [];

  if (documentIds.length > 0) {
    if (documentIds.length > 200) {
      return err("A project can include up to 200 documents", 400);
    }

    documents = await db.document.findMany({
      where: { id: { in: documentIds } },
      select: { id: true, name: true, uploadedById: true },
    });

    if (documents.length !== documentIds.length) {
      return err("Some documents were not found", 400);
    }

    if (user.role === Role.MANAGER) {
      const unauthorized = documents.some(doc => doc.uploadedById !== user.id);
      if (unauthorized) {
        return err("Some documents were not found", 404);
      }
    }

    const documentById = new Map(documents.map(doc => [doc.id, doc]));
    documents = documentIds.map(id => documentById.get(id)!);
  }

  const project = await db.$transaction(async (tx) => {
    const createdProject = await tx.project.create({
      data: {
        title: data.title,
        description: data.description,
        managerId: user.id,
      },
      include: {
        _count: { select: { documents: true, assignments: true, tasks: true } },
      },
    });

    if (documents.length > 0) {
      await tx.projectDocument.createMany({
        data: documents.map((doc, index) => ({
          documentId: doc.id,
          projectId: createdProject.id,
          pageNumber: index + 1,
        })),
      });
    }

    return createdProject;
  });

  return ok(project, 201);
}, [Role.SUPER_ADMIN, Role.MANAGER]);
