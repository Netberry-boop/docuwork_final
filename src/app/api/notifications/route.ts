import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, withAuth, getPagination, paginate } from "@/lib/api";

// GET /api/notifications
export const GET = withAuth(async (req, user) => {
  const { page, limit, skip } = getPagination(req);

  const [notifications, total] = await Promise.all([
    db.notification.findMany({
      where: { userId: user!.id },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    db.notification.count({ where: { userId: user!.id } }),
  ]);

  return paginate(notifications, total, page, limit);
});

// PATCH /api/notifications - mark all as read
export const PATCH = withAuth(async (req, user) => {
  await db.notification.updateMany({
    where: { userId: user!.id, isRead: false },
    data: { isRead: true },
  });
  return ok({ message: "All marked as read" });
});
