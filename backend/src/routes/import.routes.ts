// backend/src/routes/import.routes.ts

import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
  createImportJob,
  getImportJobDetails,
  submitDecision,
  commitImportJob,
} from "../services/importJob.service";
import { resolveAnomalySchema } from "../validation/import.validation";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const router = Router({ mergeParams: true });

// All routes require authentication
router.use(requireAuth);

// Middleware to check if the user is an active member of the group
export async function requireGroupMembership(req: any, res: any, next: any) {
  const { groupId } = req.params;
  const userId = req.userId!;

  try {
    const membership = await prisma.groupMembership.findFirst({
      where: {
        groupId,
        userId,
        leftAt: null, // must be currently active
      },
    });

    if (!membership) {
      return res.status(403).json({ error: "Access denied: You are not an active member of this group." });
    }

    req.groupRole = membership.role;
    next();
  } catch (err) {
    console.error("Group membership check error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Middleware to check if the user is an admin of the group
export function requireGroupAdmin(req: any, res: any, next: any) {
  if (req.groupRole !== "ADMIN") {
    return res.status(403).json({ error: "Access denied: Administrator permissions required." });
  }
  next();
}

router.use(requireGroupMembership);

// POST /api/groups/:groupId/imports
// Uploads, parses CSV, extracts participant names, and either:
//   a) proceeds to anomaly detection immediately (all names auto-mapped), or
//   b) returns requiresMapping=true so the frontend shows the mapping screen.
router.post("/", async (req: any, res) => {
  const { fileName, csvContent } = req.body;

  if (!fileName || !csvContent) {
    return res.status(400).json({ error: "Missing required fields: fileName or csvContent." });
  }

  try {
    const job = await createImportJob(req.params.groupId, fileName, csvContent, req.userId!);
    // Tell the frontend whether to redirect to the mapping screen or review screen
    const requiresMapping = job.status === "AWAITING_MAPPING";
    return res.status(201).json({ job, requiresMapping });
  } catch (err: any) {
    console.error("createImportJob error:", err);
    return res.status(500).json({ error: err.message || "Something went wrong during CSV import staging." });
  }
});

// GET /api/groups/:groupId/imports/:jobId
// Fetches the import job details, staging rows, anomalies, and reports.
router.get("/:jobId", async (req: any, res) => {
  try {
    const details = await getImportJobDetails(req.params.jobId);
    if (!details) {
      return res.status(404).json({ error: "Import job not found" });
    }
    return res.json({ job: details });
  } catch (err) {
    console.error("getImportJobDetails error:", err);
    return res.status(500).json({ error: "Something went wrong fetching import details." });
  }
});

// POST /api/groups/:groupId/imports/:jobId/rows/:rowId/resolve
// Submits a resolution decision for a staged row (Admin only).
router.post("/:jobId/rows/:rowId/resolve", requireGroupAdmin, async (req: any, res) => {
  const parsed = resolveAnomalySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  const { jobId, rowId } = req.params;

  try {
    const result = await submitDecision(
      jobId,
      rowId,
      parsed.data.resolution,
      parsed.data.decisionDetails,
      req.userId!
    );
    return res.json(result);
  } catch (err: any) {
    console.error("submitDecision error:", err);
    return res.status(500).json({ error: err.message || "Failed to submit resolution decision." });
  }
});

// POST /api/groups/:groupId/imports/:jobId/commit
// Commits all resolved/clean rows to Expense/Settlement tables (Admin only).
router.post("/:jobId/commit", requireGroupAdmin, async (req: any, res) => {
  try {
    const report = await commitImportJob(req.params.jobId, req.userId!);
    return res.json({ success: true, report });
  } catch (err: any) {
    console.error("commitImportJob error:", err);
    return res.status(400).json({ error: err.message || "Failed to commit import job to ledger." });
  }
});

export default router;
