import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, err, withAuth, paginate, getPagination } from "@/lib/api";
import { Role } from "@prisma/client";
import { z } from "zod";

const bonusSchema = z.object({
  workerId: z.string(),
  amount: z.number(),
  type: z.enum(["bonus", "penalty"]),
  description: z.string().optional(),
});

// GET /api/payments
export const GET = withAuth(async (req, user) => {
  const { page, limit, skip } = getPagination(req);
  const { searchParams } = new URL(req.url);
  const workerId = searchParams.get("workerId");
  const isPaid = searchParams.get("isPaid");

  const where: Record<string, unknown> = {};

  if (user!.role === Role.WORKER) {
    where.workerId = user!.id;
  } else if (workerId) {
    where.workerId = workerId;
  }

  if (isPaid !== null && isPaid !== "") {
    where.isPaid = isPaid === "true";
  }

  const [payments, total, summary] = await Promise.all([
    db.payment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        worker: { select: { id: true, name: true, email: true } },
      },
    }),
    db.payment.count({ where }),
    db.payment.aggregate({
      where,
      _sum: { amount: true },
    }),
  ]);

  return ok({
    payments,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    totalAmount: summary._sum.amount || 0,
  });
});

// POST /api/payments - add bonus/penalty
export const POST = withAuth(async (req, user) => {
  const body = await req.json();
  const parsed = bonusSchema.safeParse(body);
  if (!parsed.success) return err(parsed.error.errors[0].message);

  const payment = await db.payment.create({
    data: {
      workerId: parsed.data.workerId,
      amount: parsed.data.type === "penalty" ? -Math.abs(parsed.data.amount) : parsed.data.amount,
      type: parsed.data.type,
      description: parsed.data.description,
    },
    include: {
      worker: { select: { id: true, name: true } },
    },
  });

  return ok(payment, 201);
}, [Role.SUPER_ADMIN, Role.MANAGER]);

// PATCH /api/payments - mark payments as paid (bulk)
export const PATCH = withAuth(async (req, user) => {
  const body = await req.json();
  const { paymentIds, workerId } = body;

  const where: Record<string, unknown> = { isPaid: false };
  if (paymentIds?.length) where.id = { in: paymentIds };
  if (workerId) where.workerId = workerId;

  const { count } = await db.payment.updateMany({
    where,
    data: { isPaid: true, paidAt: new Date() },
  });

  return ok({ message: `${count} payment(s) marked as paid` });
}, [Role.SUPER_ADMIN, Role.MANAGER]);
