import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

const prisma = new PrismaClient();

export interface UserBalance {
  userId: string;
  displayName: string;
  totalPaid: Decimal;
  totalOwed: Decimal;
  netBalance: Decimal;
}

export interface SettlementAction {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: Decimal;
}

export async function getGroupBalances(groupId: string): Promise<{
  balances: UserBalance[];
  suggestedSettlements: SettlementAction[];
}> {
  // Fetch all users in the group
  const memberships = await prisma.groupMembership.findMany({
    where: { groupId },
    include: { user: true },
  });

  const balanceMap = new Map<string, UserBalance>();

  for (const m of memberships) {
    balanceMap.set(m.userId, {
      userId: m.userId,
      displayName: m.user.displayName,
      totalPaid: new Decimal(0),
      totalOwed: new Decimal(0),
      netBalance: new Decimal(0),
    });
  }

  // Fetch all expenses in the group
  const expenses = await prisma.expense.findMany({
    where: { groupId },
  });

  for (const exp of expenses) {
    const amountInr = exp.amountInr ?? new Decimal(0);
    const payerBalance = balanceMap.get(exp.paidById);
    if (payerBalance) {
      payerBalance.totalPaid = payerBalance.totalPaid.add(amountInr);
      payerBalance.netBalance = payerBalance.netBalance.add(amountInr);
    }
  }

  // Fetch all splits in the group
  const splits = await prisma.expenseSplit.findMany({
    where: { expense: { groupId } },
  });

  for (const split of splits) {
    if (split.userId) {
      const userBalance = balanceMap.get(split.userId);
      if (userBalance) {
        userBalance.totalOwed = userBalance.totalOwed.add(split.amount);
        userBalance.netBalance = userBalance.netBalance.sub(split.amount);
      }
    }
  }

  // Fetch all settlements in the group
  const settlements = await prisma.settlement.findMany({
    where: { groupId },
  });

  for (const settlement of settlements) {
    const fromBalance = balanceMap.get(settlement.fromUserId);
    if (fromBalance) {
      fromBalance.netBalance = fromBalance.netBalance.add(settlement.amount);
    }
    const toBalance = balanceMap.get(settlement.toUserId);
    if (toBalance) {
      toBalance.netBalance = toBalance.netBalance.sub(settlement.amount);
    }
  }

  const balances = Array.from(balanceMap.values());
  const suggestedSettlements = calculateSettlements(balances);

  return {
    balances,
    suggestedSettlements,
  };
}

function calculateSettlements(balances: UserBalance[]): SettlementAction[] {
  const debtors = balances.filter(b => b.netBalance.lt(0)).sort((a, b) => a.netBalance.cmp(b.netBalance)); // most negative first
  const creditors = balances.filter(b => b.netBalance.gt(0)).sort((a, b) => b.netBalance.cmp(a.netBalance)); // most positive first

  const settlements: SettlementAction[] = [];
  let dIndex = 0;
  let cIndex = 0;

  // We clone the balances to mutate them locally
  const remainingDebts = debtors.map(d => ({ ...d, amount: d.netBalance.abs() }));
  const remainingCredits = creditors.map(c => ({ ...c, amount: c.netBalance }));

  while (dIndex < remainingDebts.length && cIndex < remainingCredits.length) {
    const debtor = remainingDebts[dIndex];
    const creditor = remainingCredits[cIndex];

    const settleAmount = Decimal.min(debtor.amount, creditor.amount);

    if (settleAmount.gt(0)) {
      settlements.push({
        fromUserId: debtor.userId,
        fromUserName: debtor.displayName,
        toUserId: creditor.userId,
        toUserName: creditor.displayName,
        amount: settleAmount.toDecimalPlaces(2),
      });
    }

    debtor.amount = debtor.amount.sub(settleAmount);
    creditor.amount = creditor.amount.sub(settleAmount);

    if (debtor.amount.lte(0.005)) dIndex++;
    if (creditor.amount.lte(0.005)) cIndex++;
  }

  return settlements;
}
