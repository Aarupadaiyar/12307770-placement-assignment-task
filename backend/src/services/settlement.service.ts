import { PrismaClient } from "@prisma/client";
import { logAuditAction } from "./audit.service";

const prisma = new PrismaClient();

export interface CreateSettlementParams {
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  date: Date;
  notes?: string;
}

export async function createSettlement(params: CreateSettlementParams) {
  if (params.fromUserId === params.toUserId) {
    throw new Error("Cannot create a settlement with the same user");
  }

  // Ensure both users exist in the group
  const fromMember = await prisma.groupMembership.findFirst({
    where: { groupId: params.groupId, userId: params.fromUserId },
  });
  if (!fromMember) throw new Error("Payer is not a member of the group");

  const toMember = await prisma.groupMembership.findFirst({
    where: { groupId: params.groupId, userId: params.toUserId },
  });
  if (!toMember) throw new Error("Receiver is not a member of the group");

  const settlement = await prisma.settlement.create({
    data: {
      groupId: params.groupId,
      fromUserId: params.fromUserId,
      toUserId: params.toUserId,
      amount: params.amount,
      date: params.date,
      notes: params.notes,
    },
  });

  await logAuditAction({
    userId: params.fromUserId,
    action: "CREATE_SETTLEMENT",
    entityType: "Settlement",
    entityId: settlement.id,
    afterData: { amount: params.amount, toUserId: params.toUserId },
  });

  return settlement;
}

export async function deleteSettlement(id: string, groupId: string) {
  const settlement = await prisma.settlement.findUnique({
    where: { id },
  });

  if (!settlement) throw new Error("Settlement not found");
  if (settlement.groupId !== groupId) throw new Error("Settlement does not belong to this group");

  await prisma.settlement.delete({
    where: { id },
  });

  await logAuditAction({
    userId: settlement.fromUserId,
    action: "DELETE_SETTLEMENT",
    entityType: "Settlement",
    entityId: id,
    beforeData: { amount: settlement.amount, toUserId: settlement.toUserId },
  });

  return settlement;
}
