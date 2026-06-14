// backend/src/routes/group.routes.ts
//
// =============================================================================
// WHY THIS FILE EXISTS
// =============================================================================
// HTTP layer for all group + membership operations. Each handler follows the
// same three-step shape: validate input → call service → respond.
//
// Business logic lives in group.service.ts. This file's only job is HTTP
// translation: parse request, call the right service function, map errors to
// status codes, format the response body.
//
// =============================================================================
// ENDPOINTS
// =============================================================================
//
//   POST   /api/groups                               Create a group
//   GET    /api/groups                               List current user's groups
//   GET    /api/groups/:groupId                      Get group detail
//   PATCH  /api/groups/:groupId                      Rename group (admin only)
//   POST   /api/groups/:groupId/members              Add member (admin only)
//   PATCH  /api/groups/:groupId/members/:userId/end  End membership (admin only)
//   GET    /api/groups/:groupId/members              List all members (any member)
//
// =============================================================================
// AUTH
// =============================================================================
// requireAuth is applied to the router as a whole — no individual handler
// needs to check authentication. req.userId is guaranteed to be set for every
// handler in this file.
// =============================================================================

import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import {
  createGroupSchema,
  renameGroupSchema,
  addMemberSchema,
  endMembershipSchema,
  editMemberSchema,
} from "../validation/group.validation";
import {
  createGroup,
  listGroupsForUser,
  getGroupDetail,
  renameGroup,
  addMember,
  editMember,
  endMembership,
  listMembers,
  GroupNotFoundError,
  NotAMemberError,
  NotAnAdminError,
  UserNotFoundError,
  AlreadyMemberError,
  MembershipNotFoundError,
  MembershipAlreadyEndedError,
  LastAdminError,
  CannotEndOwnMembershipError,
} from "../services/group.service";

const router = Router();

// All group routes require authentication
router.use(requireAuth);

// ---------------------------------------------------------------------------
// Group CRUD
// ---------------------------------------------------------------------------

// POST /api/groups
// Create a new group. Requester becomes its first ADMIN.
router.post("/", async (req, res) => {
  const parsed = createGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  try {
    const group = await createGroup({
      name: parsed.data.name,
      creatorId: req.userId!,
    });
    return res.status(201).json({ group });
  } catch (err) {
    console.error("createGroup error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// GET /api/groups
// List all groups the current user is an active member of.
router.get("/", async (req, res) => {
  try {
    const groups = await listGroupsForUser(req.userId!);
    return res.json({ groups });
  } catch (err) {
    console.error("listGroups error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// GET /api/groups/:groupId
// Get full group detail (current + past members). Must be an active member.
router.get("/:groupId", async (req, res) => {
  try {
    const group = await getGroupDetail({
      groupId: req.params.groupId,
      requesterId: req.userId!,
    });
    return res.json({ group });
  } catch (err) {
    if (err instanceof GroupNotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    if (err instanceof NotAMemberError) {
      return res.status(403).json({ error: err.message });
    }
    console.error("getGroupDetail error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// PATCH /api/groups/:groupId
// Rename a group. Admin-only.
router.patch("/:groupId", async (req, res) => {
  const parsed = renameGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  try {
    const group = await renameGroup({
      groupId: req.params.groupId,
      requesterId: req.userId!,
      name: parsed.data.name,
    });
    return res.json({ group });
  } catch (err) {
    if (err instanceof GroupNotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    if (err instanceof NotAMemberError) {
      return res.status(403).json({ error: err.message });
    }
    if (err instanceof NotAnAdminError) {
      return res.status(403).json({ error: err.message });
    }
    console.error("renameGroup error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// ---------------------------------------------------------------------------
// Membership management
// ---------------------------------------------------------------------------

// POST /api/groups/:groupId/members
// Add a member by email. Admin-only.
router.post("/:groupId/members", async (req, res) => {
  const parsed = addMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  try {
    const member = await addMember({
      groupId: req.params.groupId,
      requesterId: req.userId!,
      email: parsed.data.email,
      joinedAt: parsed.data.joinedAt ? new Date(parsed.data.joinedAt) : undefined,
      leftAt: parsed.data.leftAt ? new Date(parsed.data.leftAt) : undefined,
    });
    return res.status(201).json({ member });
  } catch (err) {
    if (err instanceof GroupNotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    if (err instanceof NotAMemberError) {
      return res.status(403).json({ error: err.message });
    }
    if (err instanceof NotAnAdminError) {
      return res.status(403).json({ error: err.message });
    }
    if (err instanceof UserNotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    if (err instanceof AlreadyMemberError) {
      return res.status(409).json({ error: err.message });
    }
    console.error("addMember error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// PATCH /api/groups/:groupId/members/:userId/end
// End a user's membership (set leftAt). Admin-only.
router.patch("/:groupId/members/:userId/end", async (req, res) => {
  const parsed = endMembershipSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  try {
    const membership = await endMembership({
      groupId: req.params.groupId,
      requesterId: req.userId!,
      targetUserId: req.params.userId,
      leftAt: new Date(parsed.data.leftAt),
    });
    return res.json({ membership });
  } catch (err) {
    if (err instanceof GroupNotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    if (err instanceof NotAMemberError) {
      return res.status(403).json({ error: err.message });
    }
    if (err instanceof NotAnAdminError) {
      return res.status(403).json({ error: err.message });
    }
    if (err instanceof MembershipNotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    if (err instanceof MembershipAlreadyEndedError) {
      return res.status(409).json({ error: err.message });
    }
    if (err instanceof LastAdminError) {
      return res.status(409).json({ error: err.message });
    }
    if (err instanceof CannotEndOwnMembershipError) {
      return res.status(403).json({ error: err.message });
    }
    console.error("endMembership error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// PATCH /api/groups/:groupId/members/:userId
// Edit a user's membership (joinedAt/leftAt). Admin-only.
router.patch("/:groupId/members/:userId", async (req, res) => {
  const parsed = editMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  try {
    const membership = await editMember({
      groupId: req.params.groupId,
      targetUserId: req.params.userId,
      requesterId: req.userId!,
      joinedAt: new Date(parsed.data.joinedAt),
      leftAt: parsed.data.leftAt ? new Date(parsed.data.leftAt) : null,
    });
    return res.json({ membership });
  } catch (err) {
    if (err instanceof GroupNotFoundError || err instanceof UserNotFoundError || err instanceof MembershipNotFoundError) {
      return res.status(404).json({ error: (err as Error).message });
    }
    if (err instanceof NotAMemberError || err instanceof NotAnAdminError) {
      return res.status(403).json({ error: (err as Error).message });
    }
    if (err instanceof Error && err.message.includes("joinedAt must be before leftAt")) {
      return res.status(400).json({ error: err.message });
    }
    console.error("editMember error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// GET /api/groups/:groupId/members
// List all members (current + historical). Any active member can view.
router.get("/:groupId/members", async (req, res) => {
  try {
    const memberships = await listMembers({
      groupId: req.params.groupId,
      requesterId: req.userId!,
    });
    return res.json({ memberships });
  } catch (err) {
    if (err instanceof GroupNotFoundError) {
      return res.status(404).json({ error: err.message });
    }
    if (err instanceof NotAMemberError) {
      return res.status(403).json({ error: err.message });
    }
    console.error("listMembers error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

export default router;
