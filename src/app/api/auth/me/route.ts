import { NextRequest } from "next/server";
import { ok, err, getAuthUser } from "@/lib/api";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return err("Unauthorized", 401);
  return ok(user);
}
