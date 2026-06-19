import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok } from "@/lib/api";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { refreshToken } = body;
  if (refreshToken) {
    await db.refreshToken.deleteMany({ where: { token: refreshToken } }).catch(() => {});
  }
  return ok({ message: "Logged out" });
}
