import "server-only";
import { after, NextResponse, type NextRequest } from "next/server";
import type { AnyObject, ObjectSchema } from "yup";
import { can, type PermissionAction, type PermissionModule } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";
import { connectDB } from "../db";
import { invalidateSessionCache, loadSessionUser } from "../auth/session";
import { SESSION_COOKIE } from "../auth/token";
import { affectsStorefront, notifyStorefront } from "../storefront/notify";
import { AppError, errorResponse } from "./errors";

type Guard = { module: PermissionModule; action: PermissionAction } | "authenticated";

type Ctx<P> = { params: Promise<P> };

/** API calls slower than this are logged as "[slow api]" (override with SLOW_API_MS). */
const SLOW_MS = Number(process.env.SLOW_API_MS) || 500;

/** Writes must come from this site (defence in depth on top of SameSite cookies). */
function isCrossSiteWrite(req: NextRequest): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return false;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.headers.get("host");
  } catch {
    return true;
  }
}

/**
 * Wraps a route handler with: DB connection, session check, permission check and error mapping.
 *   export const GET = apiHandler({ module: "product", action: "view" }, async ({ req, user }) => ...)
 */
export function apiHandler<P = Record<string, never>>(
  guard: Guard,
  handler: (args: { req: NextRequest; user: SessionUser; params: P }) => Promise<unknown>
) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    const started = performance.now();
    const res = await run(req, ctx);
    const ms = Math.round(performance.now() - started);
    // Server-Timing shows up in the browser's Network tab; slow calls are also written to the server log
    res.headers.set("Server-Timing", `app;dur=${ms}`);
    if (ms >= SLOW_MS) console.warn(`[slow api] ${req.method} ${req.nextUrl.pathname}${req.nextUrl.search} ${ms} ms (status ${res.status})`);
    return res;
  };

  async function run(req: NextRequest, ctx: Ctx<P>): Promise<NextResponse> {
    try {
      if (isCrossSiteWrite(req)) throw new AppError("Cross-site request blocked", 403);
      await connectDB();
      const user = await loadSessionUser(req.cookies.get(SESSION_COOKIE)?.value);
      if (!user) throw new AppError("Your session has expired. Please sign in again.", 401);
      if (guard !== "authenticated" && !can(user, guard.module, guard.action)) {
        throw new AppError("You do not have permission to perform this action", 403);
      }
      const params = ((await ctx?.params) ?? {}) as P;
      const result = await handler({ req, user, params });
      // A user or role was changed: drop cached sessions so new permissions apply on the next click
      if (req.method !== "GET" && guard !== "authenticated" && (guard.module === "user" || guard.module === "role")) {
        invalidateSessionCache();
      }
      // Product / offer / category / stock changed: refresh the online store once this response is sent
      if (affectsStorefront(req.method, req.nextUrl.pathname)) {
        const reason = `${req.method} ${req.nextUrl.pathname}`;
        after(() => notifyStorefront(reason));
      }
      return result instanceof NextResponse ? result : NextResponse.json(result ?? { success: true });
    } catch (error) {
      return errorResponse(error);
    }
  }
}

/** Parses the JSON body and validates it with the shared Yup schema (unknown keys are stripped). */
export async function readBody<T extends AnyObject>(req: NextRequest, schema: ObjectSchema<T>): Promise<T> {
  const body = await req.json();
  return (await schema.validate(body, { abortEarly: false, stripUnknown: true })) as T;
}
