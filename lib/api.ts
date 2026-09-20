import { NextResponse } from "next/server";
import type { z } from "zod";

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True if `id` is a syntactically valid UUID. */
export function isUuid(id: string | undefined | null): id is string {
  return typeof id === "string" && UUID_RE.test(id);
}

/**
 * Guard a dynamic route param: returns a 404 response for anything that isn't a
 * UUID, so malformed ids never reach Prisma (which would throw a 500 instead).
 */
export function requireUuidParam(id: string | undefined | null): NextResponse | null {
  return isUuid(id) ? null : jsonError(404, "Not found");
}

/** Parse and validate a JSON body; returns a 400 response on malformed/invalid input. */
export async function parseBody<T extends z.ZodType>(
  req: Request,
  schema: T
): Promise<{ data: z.infer<T>; error?: never } | { data?: never; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: jsonError(400, "Invalid JSON body") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: jsonError(400, first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input") };
  }
  return { data: parsed.data };
}
