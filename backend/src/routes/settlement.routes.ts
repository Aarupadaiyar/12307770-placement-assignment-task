import { Router } from "express";
import { createSettlement, deleteSettlement } from "../services/settlement.service";
import { z } from "zod";

const router = Router({ mergeParams: true });

const createSettlementSchema = z.object({
  fromUserId: z.string().cuid(),
  toUserId: z.string().cuid(),
  amount: z.number().positive(),
  date: z.string().transform((str) => new Date(str)),
  notes: z.string().optional(),
});

// POST /api/groups/:groupId/settlements
router.post("/", async (req: any, res: any) => {
  try {
    const { groupId } = req.params;
    const parsed = createSettlementSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid payload", details: parsed.error.flatten() });
    }

    const settlement = await createSettlement({
      ...parsed.data,
      groupId
    });
    
    res.json(settlement);
  } catch (error: any) {
    console.error("Error creating settlement:", error);
    res.status(500).json({ error: error.message || "Failed to create settlement" });
  }
});

// DELETE /api/groups/:groupId/settlements/:id
router.delete("/:id", async (req: any, res: any) => {
  try {
    const { groupId, id } = req.params;
    await deleteSettlement(id, groupId);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting settlement:", error);
    res.status(500).json({ error: error.message || "Failed to delete settlement" });
  }
});

export default router;
