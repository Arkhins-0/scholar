import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Write an audit trail row. Never throws — an audit failure must not mask the
 * outcome of the action itself (the action is already committed).
 */
export async function audit(params: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        details: params.details,
      },
    });
  } catch (e) {
    console.error("audit log write failed", e);
  }
}
