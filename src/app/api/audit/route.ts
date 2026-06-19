import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, withAuth, paginate, getPagination } from "@/lib/api";
import { Role } from "@prisma/client";

export const GET = withAuth(async (req, user) => {
  const { page, limit, skip } = getPagination(req);
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const userId = searchParams.get("userId");

  const where: Record<string, unknown> = {};
  if (action) where.action = { contains: action, mode: "insensitive" };
  if (userId) where.userId = userId;

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, role: true } },
      },
    }),
    db.auditLog.count({ where }),
  ]);

  return paginate(logs, total, page, limit);
}, [Role.SUPER_ADMIN, Role.MANAGER]);
