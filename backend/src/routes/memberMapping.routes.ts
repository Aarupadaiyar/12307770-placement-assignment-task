// backend/src/routes/memberMapping.routes.ts

import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
  getMappingStatus,
  getGroupMembers,
  submitMappingDecisions,
} from "../services/memberMapping.service";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router({ mergeParams: true });

// All routes require authentication
router.use(requireAuth);

// Middleware – ensure the current user is a member of the group (used by import router)
async function requireGroupMembership(req: any, res: any, next: any) {
  const { groupId } = req.params;
  const userId = req.userId!;
  try {
    const membership = await prisma.groupMembership.findFirst({
      where: { groupId, userId, leftAt: null },
    });
    if (!membership) {
      return res
        .status(403)
        .json({ error: "Access denied: You are not an active member of this group." });
    }
    req.groupRole = membership.role;
    next();
  } catch (err) {
    console.error("Group membership check error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

router.use(requireGroupMembership);

// GET /api/groups/:groupId/imports/:jobId/mapping – status of each participant name
router.get("/", async (req: any, res: any) => {
  const { groupId, jobId } = req.params;
  try {
    const status = await getMappingStatus(groupId, jobId);
    return res.json(status);
  } catch (err: any) {
    console.error("getMappingStatus error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Failed to load mapping status" });
  }
});

// GET /api/groups/:groupId/imports/:jobId/mapping/members – list of group members for dropdowns
router.get("/members", async (req: any, res: any) => {
  const { groupId } = req.params;
  console.log(`[API /members] Fetching members for groupId: ${groupId}`);
  
  if (!groupId) {
    console.warn(`[API /members] Missing groupId in request params`);
    return res.status(400).json({ error: "Missing groupId" });
  }

  try {
    const members = await getGroupMembers(groupId);
    console.log(`[API /members] Fetched ${members.length} members for groupId: ${groupId}`);
    
    if (members.length === 0) {
      console.warn(`[API /members] Empty query result for groupId: ${groupId}. Ensure GroupMembership or GroupMember rows exist.`);
    }

    return res.json({ members });
  } catch (err: any) {
    console.error(`[API /members] API failure while fetching members for groupId: ${groupId}`, err);
    return res
      .status(500)
      .json({ error: err.message || "Failed to load group members" });
  }
});

// POST /api/groups/:groupId/imports/:jobId/mapping/submit – admin submits all decisions
router.post("/submit", async (req: any, res: any) => {
  const { groupId, jobId } = req.params;
  const { decisions } = req.body; // array of { csvName, action, ... }
  if (!Array.isArray(decisions) || decisions.length === 0) {
    return res
      .status(400)
      .json({ error: "Missing or empty \"decisions\" array in request body" });
  }
  try {
    const result = await submitMappingDecisions(groupId, jobId, decisions, req.userId!);
    return res.json(result);
  } catch (err: any) {
    console.error("submitMappingDecisions error:", err);
    return res
      .status(500)
      .json({ error: err.message || "Failed to submit mapping decisions" });
  }
});

export default router;
