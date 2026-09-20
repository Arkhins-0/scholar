import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import { parseBody } from "@/lib/api";
import { portalKeyGenSchema } from "@/lib/schemas";
import { generatePortalKey, hashPortalKey, portalKeyPrefix } from "@/lib/portal-key";
import { audit } from "@/lib/audit";

/**
 * Generate one-time portal keys. Plaintext keys are returned ONCE in this
 * response — only their SHA-256 hashes are persisted.
 */
export async function POST(req: Request) {
  const auth = await requireRole("RND_ADMIN");
  if (auth.error) return auth.error;

  const body = await parseBody(req, portalKeyGenSchema);
  if (body.error) return body.error;
  const { count, expiresInDays } = body.data;

  const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;

  const keys: string[] = [];
  for (let i = 0; i < count; i++) keys.push(generatePortalKey());

  await prisma.portalKey.createMany({
    data: keys.map((key) => ({
      keyHash: hashPortalKey(key),
      keyPrefix: portalKeyPrefix(key),
      generatedById: auth.user.id,
      expiresAt,
    })),
  });

  await audit({
    actorId: auth.user.id,
    action: "PORTAL_KEYS_GENERATED",
    entityType: "PortalKey",
    entityId: "batch",
    details: { count, expiresInDays: expiresInDays ?? null },
  });

  return NextResponse.json({ keys });
}
