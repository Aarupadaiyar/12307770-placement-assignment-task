import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

export interface AuditLogParams {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeData?: any;
  afterData?: any;
}

export async function logAuditAction(params: AuditLogParams, tx?: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">) {
  const db = tx || prisma;
  
  await db.auditLog.create({
    data: {
      userId: params.userId || null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      beforeData: params.beforeData ? (params.beforeData as Prisma.InputJsonValue) : Prisma.JsonNull,
      afterData: params.afterData ? (params.afterData as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });
}
