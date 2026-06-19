import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err, withAuth, paginate, getPagination } from "@/lib/api";
import { z } from "zod";

const sendSchema = z.object({
  receiverId: z.string(),
  content: z.string().min(1),
  taskId: z.string().optional(),
});

// GET /api/messages?with=userId or ?taskId=id
export const GET = withAuth(async (req, user) => {
  const { page, limit, skip } = getPagination(req);
  const { searchParams } = new URL(req.url);
  const withUserId = searchParams.get("with");
  const taskId = searchParams.get("taskId");

  const where: Record<string, unknown> = {};

  if (withUserId) {
    where.OR = [
      { senderId: user!.id, receiverId: withUserId },
      { senderId: withUserId, receiverId: user!.id },
    ];
  } else {
    where.OR = [{ senderId: user!.id }, { receiverId: user!.id }];
  }

  if (taskId) where.taskId = taskId;

  const [messages, total] = await Promise.all([
    db.message.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "asc" },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
        receiver: { select: { id: true, name: true, avatar: true } },
      },
    }),
    db.message.count({ where }),
  ]);

  // Mark received messages as read
  await db.message.updateMany({
    where: { receiverId: user!.id, isRead: false, ...(withUserId ? { senderId: withUserId } : {}) },
    data: { isRead: true },
  });

  return paginate(messages, total, page, limit);
});

// POST /api/messages
export const POST = withAuth(async (req, user) => {
  const body = await req.json();
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0].message);

  const receiver = await db.user.findUnique({ where: { id: parsed.data.receiverId } });
  if (!receiver) return err("Recipient not found", 404);

  const message = await db.message.create({
    data: {
      senderId: user!.id,
      receiverId: parsed.data.receiverId,
      content: parsed.data.content,
      taskId: parsed.data.taskId,
    },
    include: {
      sender: { select: { id: true, name: true, avatar: true } },
      receiver: { select: { id: true, name: true, avatar: true } },
    },
  });

  // Notify receiver
  await db.notification.create({
    data: {
      userId: parsed.data.receiverId,
      taskId: parsed.data.taskId,
      type: "MESSAGE_RECEIVED",
      title: `New message from ${receiver.name}`,
      body: parsed.data.content.slice(0, 100),
    },
  });

  return ok(message, 201);
});
