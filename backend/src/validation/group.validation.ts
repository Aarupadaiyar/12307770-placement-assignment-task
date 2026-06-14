// backend/src/validation/group.validation.ts
//
// =============================================================================
// WHY THIS FILE EXISTS
// =============================================================================
// Zod validation schemas for every group + membership write operation. By
// keeping validation here (not inline in route handlers), we get:
//   1. One place to audit "what inputs does the API accept" during a live
//      session — just open this file.
//   2. z.infer<> gives us TypeScript types that can never drift from the
//      runtime checks — the shape you validate IS the shape you get.
//   3. Route handlers stay thin: validate → call service → respond.
//
// Every route that accepts a request body imports its schema from here.
// =============================================================================

import { z } from "zod";

// ---------------------------------------------------------------------------
// Group CRUD
// ---------------------------------------------------------------------------

/**
 * POST /api/groups
 * Create a new group. Just a name — the creator becomes ADMIN automatically.
 */
export const createGroupSchema = z.object({
  name: z
    .string()
    .min(1, "Group name is required")
    .max(100, "Group name must be 100 characters or fewer")
    .trim(),
});

/**
 * PATCH /api/groups/:groupId
 * Rename a group. Only group ADMINs can call this.
 */
export const renameGroupSchema = z.object({
  name: z
    .string()
    .min(1, "Group name is required")
    .max(100, "Group name must be 100 characters or fewer")
    .trim(),
});

// ---------------------------------------------------------------------------
// Membership management
// ---------------------------------------------------------------------------

/**
 * POST /api/groups/:groupId/members
 * Add a member to a group. Admin-only.
 *
 * joinedAt is optional — defaults to today if omitted. Stored as an ISO
 * date string in the request; the service converts to a JS Date. We accept
 * the date as a string (not a Date object) because JSON has no Date type —
 * storing/transferring dates as ISO strings is the convention used everywhere
 * in this codebase (matching Prisma's @default(now()) behavior).
 */
export const addMemberSchema = z.object({
  email: z.string().email("Must be a valid email address"),
  joinedAt: z
    .string()
    .datetime({ offset: true, message: "joinedAt must be a valid ISO 8601 date string" })
    .optional(),
});

/**
 * PATCH /api/groups/:groupId/members/:userId/end
 * End a membership by setting leftAt. Admin-only.
 *
 * leftAt is required here — the caller must explicitly state the effective
 * departure date. We do not default to "now" silently for membership endings,
 * because a backdated departure (e.g. "Meera actually left March 31") must be
 * expressible. Setting leftAt to today is valid but must be the caller's
 * explicit choice, not a silent default that might be wrong.
 */
export const endMembershipSchema = z.object({
  leftAt: z
    .string()
    .datetime({ offset: true, message: "leftAt must be a valid ISO 8601 date string" }),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript types (used by the service layer)
// ---------------------------------------------------------------------------

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type RenameGroupInput = z.infer<typeof renameGroupSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type EndMembershipInput = z.infer<typeof endMembershipSchema>;
