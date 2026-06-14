import { PrismaClient, SplitType, Currency, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { getActiveMembership } from "../lib/membership";
import { logAuditAction } from "./audit.service";

const prisma = new PrismaClient();

export interface ExpenseSplitInput {
  userId: string;
  shareValue?: number; // for PERCENTAGE, SHARES, EXACT
}

export interface CreateExpenseParams {
  groupId: string;
  description: string;
  date: Date;
  amount: number;
  currency: Currency;
  splitType: SplitType;
  paidById: string;
  splits: ExpenseSplitInput[];
  notes?: string;
  fxRateToInr?: number;
}

export async function createExpense(params: CreateExpenseParams) {
  return await prisma.$transaction(async (tx) => {
    const amountDec = new Prisma.Decimal(params.amount);
    let amountInr = amountDec;
    let fxRateToInr: Prisma.Decimal | null = null;

    if (params.currency !== Currency.INR) {
      if (!params.fxRateToInr) throw new Error("FX rate to INR is required for non-INR currencies");
      fxRateToInr = new Prisma.Decimal(params.fxRateToInr);
      amountInr = amountDec.mul(fxRateToInr);
    }

    // Issue 1: Validate Membership Dates
    for (const split of params.splits) {
      const membership = await getActiveMembership(split.userId, params.groupId, params.date);
      if (!membership) {
        // Find user to provide a rich error message
        const user = await tx.user.findUnique({ where: { id: split.userId } });
        // Find their nearest membership if any to show bounds
        const allMem = await tx.groupMembership.findMany({ 
          where: { userId: split.userId, groupId: params.groupId },
          orderBy: { joinedAt: "asc" } 
        });
        
        let boundsMsg = "User was never a member of this group.";
        if (allMem.length > 0) {
          const mem = allMem[0];
          boundsMsg = `Membership period: Joined ${mem.joinedAt.toISOString().split('T')[0]}`;
          if (mem.leftAt) boundsMsg += `, Left ${mem.leftAt.toISOString().split('T')[0]}`;
        }
        
        throw new Error(`Validation Error: User ${user?.displayName || split.userId} is not an active member on ${params.date.toISOString().split('T')[0]}. ${boundsMsg}`);
      }
    }

    const expense = await tx.expense.create({
      data: {
        groupId: params.groupId,
        description: params.description,
        date: params.date,
        amount: amountDec,
        currency: params.currency,
        splitType: params.splitType,
        amountInr,
        fxRateToInr,
        fxRateDate: fxRateToInr ? params.date : null,
        paidById: params.paidById,
        notes: params.notes,
      },
    });

    const splitsData: Prisma.ExpenseSplitCreateManyInput[] = [];
    const numSplits = params.splits.length;

    if (numSplits === 0) throw new Error("At least one split is required");

    let totalAllocatedInr = new Prisma.Decimal(0);

    if (params.splitType === SplitType.EQUAL) {
      const splitShareInr = amountInr.div(numSplits).toDecimalPlaces(2, Decimal.ROUND_DOWN);
      let remainderInr = amountInr.sub(splitShareInr.mul(numSplits));

      for (const split of params.splits) {
        let finalShare = splitShareInr;
        if (remainderInr.gt(0)) {
          finalShare = finalShare.add(new Prisma.Decimal(0.01));
          remainderInr = remainderInr.sub(new Prisma.Decimal(0.01));
        }
        splitsData.push({
          expenseId: expense.id,
          userId: split.userId,
          amount: finalShare,
        });
      }
    } else if (params.splitType === SplitType.UNEQUAL) {
      let sumExact = new Prisma.Decimal(0);
      for (const split of params.splits) {
        const share = new Prisma.Decimal(split.shareValue ?? 0);
        sumExact = sumExact.add(share);
        const splitInr = params.currency !== Currency.INR && fxRateToInr ? share.mul(fxRateToInr) : share;
        splitsData.push({
          expenseId: expense.id,
          userId: split.userId,
          amount: splitInr,
          shareValue: share,
        });
        totalAllocatedInr = totalAllocatedInr.add(splitInr);
      }
      if (!sumExact.equals(amountDec)) {
        throw new Error(`Exact splits sum (${sumExact.toString()}) does not match expense amount (${amountDec.toString()})`);
      }
    } else if (params.splitType === SplitType.PERCENTAGE) {
      let sumPercent = new Prisma.Decimal(0);
      for (const split of params.splits) {
        const pct = new Prisma.Decimal(split.shareValue ?? 0);
        sumPercent = sumPercent.add(pct);
        const splitInr = amountInr.mul(pct).div(100).toDecimalPlaces(2, Decimal.ROUND_DOWN);
        splitsData.push({
          expenseId: expense.id,
          userId: split.userId,
          amount: splitInr,
          shareValue: pct,
        });
      }
      if (!sumPercent.equals(100)) {
        throw new Error(`Percentage splits sum to ${sumPercent.toString()}, not 100`);
      }
      
      // Fix rounding errors in PERCENTAGE
      let currentAllocated = splitsData.reduce((acc, curr) => acc.add(curr.amount as Prisma.Decimal), new Prisma.Decimal(0));
      let remainder = amountInr.sub(currentAllocated);
      let idx = 0;
      while (remainder.gt(0) && idx < splitsData.length) {
        splitsData[idx].amount = (splitsData[idx].amount as Prisma.Decimal).add(new Prisma.Decimal(0.01));
        remainder = remainder.sub(new Prisma.Decimal(0.01));
        idx++;
      }
    } else if (params.splitType === SplitType.SHARE) {
      let totalShares = new Prisma.Decimal(0);
      for (const split of params.splits) {
        totalShares = totalShares.add(new Prisma.Decimal(split.shareValue ?? 0));
      }
      for (const split of params.splits) {
        const share = new Prisma.Decimal(split.shareValue ?? 0);
        const splitInr = amountInr.mul(share).div(totalShares).toDecimalPlaces(2, Decimal.ROUND_DOWN);
        splitsData.push({
          expenseId: expense.id,
          userId: split.userId,
          amount: splitInr,
          shareValue: share,
        });
      }
      
      // Fix rounding errors in SHARES
      let currentAllocated = splitsData.reduce((acc, curr) => acc.add(curr.amount as Prisma.Decimal), new Prisma.Decimal(0));
      let remainder = amountInr.sub(currentAllocated);
      let idx = 0;
      while (remainder.gt(0) && idx < splitsData.length) {
        splitsData[idx].amount = (splitsData[idx].amount as Prisma.Decimal).add(new Prisma.Decimal(0.01));
        remainder = remainder.sub(new Prisma.Decimal(0.01));
        idx++;
      }
    }

    await tx.expenseSplit.createMany({ data: splitsData });
    
    await logAuditAction({
      userId: params.paidById,
      action: "CREATE_EXPENSE",
      entityType: "Expense",
      entityId: expense.id,
      afterData: { amount: params.amount, description: params.description, splits: splitsData },
    }, tx);

    return expense;
  });
}
