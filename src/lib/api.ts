import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "./auth";
import { db } from "./db";
import { Role } from "@prisma/client";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function paginate<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return NextResponse.json({
    success: true,
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  });
}

export async function getAuthUser(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const token =
    authHeader?.replace("Bearer ", "") || req.cookies.get("token")?.value;

  if (!token) return null;

  try {
    const payload = await verifyToken(token);
    const user = await db.user.findUnique({
      where: { id: payload.sub as string },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        managedById: true,
      },
    });
    return user?.isActive ? user : null;
  } catch {
    return null;
  }
}

type RouteContext = {
  params: Promise<Record<string, string>>;
};

type AuthHandler = (
  req: NextRequest,
  user: Awaited<ReturnType<typeof getAuthUser>>,
  context: RouteContext
) => Promise<Response>;

/**
 * withAuth wraps a route handler. The returned function matches Next.js's
 * expected signature: (req, context) => Response.
 * context.params carries dynamic segments like { id: "..." }.
 */
export function withAuth(handler: AuthHandler, requiredRoles?: Role[]) {
  return async (req: NextRequest, context: RouteContext) => {
    const user = await getAuthUser(req);
    if (!user) return err("Unauthorized", 401);
    if (requiredRoles && !requiredRoles.includes(user.role)) {
      return err("Forbidden", 403);
    }
    return handler(req, user, context);
  };
}

export function getPagination(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsedPage = Number.parseInt(searchParams.get("page") || "1", 10);
  const parsedLimit = Number.parseInt(searchParams.get("limit") || "20", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(200, Math.max(1, parsedLimit))
    : 20;
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
