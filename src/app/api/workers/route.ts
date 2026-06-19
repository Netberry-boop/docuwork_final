import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err, paginate, withAuth, getPagination } from "@/lib/api";
import { Role } from "@prisma/client";
import { hashPassword, generateToken } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";
import { z } from "zod";

const createWorkerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).optional(),
});

// GET /api/workers
export const GET = withAuth(async (req, user) => {
  const { page, limit, skip } = getPagination(req);
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const isActive = searchParams.get("isActive");

  const where: Record<string, unknown> = { role: Role.WORKER };

  // Managers see only their workers
  if (user!.role === Role.MANAGER) {
    where.managedById = user!.id;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  if (isActive !== null && isActive !== "") {
    where.isActive = isActive === "true";
  }

  const [workers, total] = await Promise.all([
    db.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
        avatar: true,
        createdAt: true,
        _count: {
          select: {
            assignedTasks: true,
            submissions: true,
          },
        },
      },
    }),
    db.user.count({ where }),
  ]);

  return paginate(workers, total, page, limit);
}, [Role.SUPER_ADMIN, Role.MANAGER]);

// POST /api/workers
export const POST = withAuth(async (req, user) => {
  const body = await req.json();
  const parsed = createWorkerSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.message);

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return err("Email already in use");

  const tempPassword = parsed.data.password || generateToken(12);
  const passwordHash = await hashPassword(tempPassword);
  const verifyToken = generateToken();

  const worker = await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash,
      role: Role.WORKER,
      managedById: user!.id,
      emailVerifyToken: verifyToken,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  await sendVerificationEmail(parsed.data.email, verifyToken).catch(console.error);

  await db.auditLog.create({
    data: { userId: user!.id, action: "WORKER_CREATED", details: { workerId: worker.id } },
  });

  return ok({ ...worker, tempPassword }, 201);
}, [Role.SUPER_ADMIN, Role.MANAGER]);
