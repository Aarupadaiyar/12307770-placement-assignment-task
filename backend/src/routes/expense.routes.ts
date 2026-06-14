import { Router } from "express";
import { createExpense } from "../services/expense.service";
import { z } from "zod";
import { Currency, SplitType } from "@prisma/client";

const router = Router({ mergeParams: true });

const createExpenseSchema = z.object({
  description: z.string().min(1),
  date: z.string().transform((str) => new Date(str)),
  amount: z.number().positive(),
  currency: z.nativeEnum(Currency),
  splitType: z.nativeEnum(SplitType),
  paidById: z.string().cuid(),
  splits: z.array(z.object({
    userId: z.string().cuid(),
    shareValue: z.number().optional()
  })).min(1),
  notes: z.string().optional(),
  fxRateToInr: z.number().optional()
});

// POST /api/groups/:groupId/expenses
router.post("/", async (req: any, res: any) => {
  try {
    const { groupId } = req.params;
    const parsed = createExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    }

    const expense = await createExpense({
      ...parsed.data,
      groupId
    });
    
    res.json(expense);
  } catch (error: any) {
    console.error("Error creating expense:", error);
    res.status(500).json({ error: error.message || "Failed to create expense" });
  }
});

export default router;
