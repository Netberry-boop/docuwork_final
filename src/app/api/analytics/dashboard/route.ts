import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, withAuth } from "@/lib/api";
import { Role } from "@prisma/client";

// GET /api/analytics/dashboard
export const GET = withAuth(async (req, user) => {
  const isWorker = user!.role === Role.WORKER;

  if (isWorker) {
    const [tasks, payments, submissions] = await Promise.all([
      db.task.groupBy({
        by: ["status"],
        where: { workerId: user!.id },
        _count: true,
      }),
      db.payment.aggregate({
        where: { workerId: user!.id },
        _sum: { amount: true },
      }),
      db.submission.count({
        where: { workerId: user!.id, isDraft: false },
      }),
    ]);

    const taskMap = tasks.reduce(
      (acc: Record<string, number>, t: { status: string; _count: number }) => ({ ...acc, [t.status]: t._count }),
      {} as Record<string, number>
    );

    return ok({
      totalTasks: (Object.values(taskMap) as number[]).reduce((a, b) => a + b, 0),
      completedTasks: (taskMap.APPROVED || 0) + (taskMap.COMPLETED || 0),
      pendingTasks: taskMap.ASSIGNED || 0,
      inProgressTasks: taskMap.IN_PROGRESS || 0,
      totalEarnings: payments._sum.amount || 0,
      submissions,
    });
  }

  // Manager / Super Admin
  const workerWhere = user!.role === Role.MANAGER
    ? { role: Role.WORKER, managedById: user!.id }
    : { role: Role.WORKER };
  const taskWhere = user!.role === Role.MANAGER
    ? { createdById: user!.id }
    : {};
  const paymentWhere = user!.role === Role.MANAGER
    ? { worker: { managedById: user!.id } }
    : {};

  const [
    totalWorkers,
    activeWorkers,
    taskStats,
    recentTasks,
    totalPayments,
  ] = await Promise.all([
    db.user.count({ where: workerWhere }),
    db.user.count({ where: { ...workerWhere, isActive: true } }),
    db.task.groupBy({ by: ["status"], where: taskWhere, _count: true }),
    db.task.findMany({
      where: taskWhere,
      take: 5,
      orderBy: { updatedAt: "desc" },
      include: {
        worker: { select: { id: true, name: true } },
        document: { select: { name: true } },
      },
    }),
    db.payment.aggregate({ where: paymentWhere, _sum: { amount: true } }),
  ]);

  const taskMap = taskStats.reduce(
    (acc: Record<string, number>, t: { status: string; _count: number }) => ({ ...acc, [t.status]: t._count }),
    {} as Record<string, number>
  );

  return ok({
    totalWorkers,
    activeWorkers,
    totalTasks: (Object.values(taskMap) as number[]).reduce((a, b) => a + b, 0),
    completedTasks: (taskMap.APPROVED || 0) + (taskMap.COMPLETED || 0),
    pendingTasks: taskMap.ASSIGNED || 0,
    inProgressTasks: taskMap.IN_PROGRESS || 0,
    submittedTasks: taskMap.SUBMITTED || 0,
    totalPayout: totalPayments._sum.amount || 0,
    recentTasks,
    tasksByStatus: taskMap,
  });
});
