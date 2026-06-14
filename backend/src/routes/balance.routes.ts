import { Router } from "express";
import { getGroupBalances } from "../services/balance.service";

const router = Router({ mergeParams: true });

// GET /api/groups/:groupId/balances
router.get("/", async (req: any, res: any) => {
  try {
    const { groupId } = req.params;
    const result = await getGroupBalances(groupId);
    res.json(result);
  } catch (error: any) {
    console.error("Error fetching balances:", error);
    res.status(500).json({ error: "Failed to fetch balances" });
  }
});

export default router;
