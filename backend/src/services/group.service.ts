// backend/src/services/group.service.ts
//
// =============================================================================
// WHY THIS FILE EXISTS
// =============================================================================
// All group + membership business logic lives here. Route handlers validate
// inputs, call functions from this file, then format HTTP responses. This
// separation means:
//
//   - "What happens when an admin adds a member?" → read addMember() here.
//     It's one function, one place, no HTTP layer noise.
//   - Every business rule is unit-testable without an HTTP server.
//   - The route file stays short (validate → call → respond).
//
// =============================================================================
// KEY DECISIONS IMPLEMENTED HERE
// =============================================================================
//
// 1. Creator becomes ADMIN (not MEMBER). See DECISIONS.md D10. Without this,
//    no one can manage the group after creation.
//
// 2. endMembership sets leftAt, never deletes rows. Required by D3 — full
//    membership history must be preserved for the balance engine and import
//    anomaly detector (both need "was X active on date D in the past?").
//
// 3. addMember validates that the target email belongs to a registered user.
//    We do NOT create users on-the-fly — a person must register themselves
//    before being added to a group. This is a deliberate scope choice (no
//    "invite by email" flow in Module 3).
//
// 4. Only one active membership per user per group at a time. Before adding,
//    we check isActiveMember(). If already active, we reject (409). A user
//    CAN have multiple historical GroupMembership rows (left and rejoined) —
//    but only one can be "active" (leftAt IS NULL) at any point.
//
// 5. The last admin cannot be removed from a group. If a group has only one
//    ADMIN member, endMembership refuses — we'd have a group with no admin,
//    which means no one can add/remove members or rename. This is the "admin
//    lock" guard.
//
// =============================================================================

import { prisma } from "../lib/prisma";
import { isActiveMember, getActiveMembership } from "../lib/membership";
import { PrismaClient, GroupRole, Prisma, GroupMembership, Group, User } from "@prisma/client";

// ---------------------------------------------------------------------------
// Custom error classes (service layer only — routes catch these)
// ---------------------------------------------------------------------------

export class GroupNotFoundError extends Error {
  constructor() {
    super("Group not found");
    this.name = "GroupNotFoundError";
  }
}

export class NotAMemberError extends Error {
  constructor() {
    super("You are not a member of this group");
    this.name = "NotAMemberError";
  }
}

export class NotAnAdminError extends Error {
  constructor() {
    super("Only group admins can perform this action");
    this.name = "NotAnAdminError";
  }
}

export class UserNotFoundError extends Error {
  constructor(email: string) {
    super(`No user found with email: ${email}`);
    this.name = "UserNotFoundError";
  }
}

export class AlreadyMemberError extends Error {
  constructor() {
    super("This user is already an active member of the group");
    this.name = "AlreadyMemberError";
  }
}

export class MembershipNotFoundError extends Error {
  constructor() {
    super("No active membership found for this user in this group");
    this.name = "MembershipNotFoundError";
  }
}

export class MembershipAlreadyEndedError extends Error {
  constructor() {
    super("This membership has already ended");
    this.name = "MembershipAlreadyEndedError";
  }
}

export class LastAdminError extends Error {
  constructor() {
    super(
      "Cannot remove the last admin from a group. Promote another member to admin first."
    );
    this.name = "LastAdminError";
  }
}

export class CannotEndOwnMembershipError extends Error {
  constructor() {
    super(
      "Admins cannot end their own membership. Transfer admin role first or have another admin remove you."
    );
    this.name = "CannotEndOwnMembershipError";
  }
}

// ---------------------------------------------------------------------------
// Group CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new group and immediately add the creator as its first ADMIN.
 *
 * Both operations run in a Prisma transaction — you never get a group with
 * no members, or a membership with no group.
 *
 * joinedAt for the creator is set to now() — there is no meaningful "when
 * did you create the group" date separate from when you joined it.
 */
export async function createGroup(params: { name: string; creatorId: string }) {
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const group = await tx.group.create({
      data: { name: params.name },
    });

    await tx.groupMembership.create({
      data: {
        groupId: group.id,
        userId: params.creatorId,
        role: GroupRole.ADMIN,
        joinedAt: new Date(),
      },
    });

    return group;
  });
}

/**
 * List all groups the requesting user currently belongs to (active membership
 * = leftAt IS NULL at the time of the call).
 *
 * Returns a lightweight list (id, name, createdAt, memberCount, caller's role)
 * — not full member lists, which are fetched on the group detail page.
 */
export async function listGroupsForUser(userId: string) {
  const now = new Date();

  // Find all active memberships for this user
  const memberships = await prisma.groupMembership.findMany({
    where: {
      userId,
      joinedAt: { lte: now },
      OR: [{ leftAt: null }, { leftAt: { gte: now } }],
    },
    include: {
      group: {
        include: {
          // Count current members for the group card
          memberships: {
            where: {
              joinedAt: { lte: now },
              OR: [{ leftAt: null }, { leftAt: { gte: now } }],
            },
            select: { id: true },
          },
        },
      },
    },
    orderBy: { group: { createdAt: "desc" } },
  });

  return memberships.map((m: GroupMembership & { group: Group & { memberships: { id: string }[] } }) => ({
    id: m.group.id,
    name: m.group.name,
    createdAt: m.group.createdAt,
    memberCount: m.group.memberships.length,
    myRole: m.role,
  }));
}

/**
 * Get full details for a single group: metadata + current members + historical
 * (ended) members. The caller must be an active member to view this.
 *
 * Returns currentMembers and pastMembers as separate arrays, so the frontend
 * can render them in two distinct sections without additional filtering.
 */
export async function getGroupDetail(params: { groupId: string; requesterId: string }) {
  const { groupId, requesterId } = params;

  // Verify requester is an active member (any role can view)
  const requesterMembership = await getActiveMembership(requesterId, groupId);
  if (!requesterMembership) {
    // Distinguish "group doesn't exist" from "you're not in it" — check existence
    const exists = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true } });
    if (!exists) throw new GroupNotFoundError();
    throw new NotAMemberError();
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      memberships: {
        include: {
          user: {
            select: { id: true, displayName: true, email: true },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!group) throw new GroupNotFoundError();

  const now = new Date();
  const currentMembers = group.memberships
    .filter((m: GroupMembership & { user: { id: string; displayName: string; email: string } }) => m.leftAt === null || m.leftAt >= now)
    .map((m: GroupMembership & { user: { id: string; displayName: string; email: string } }) => ({
      membershipId: m.id,
      userId: m.user.id,
      displayName: m.user.displayName,
      email: m.user.email,
      role: m.role,
      joinedAt: m.joinedAt,
      leftAt: m.leftAt,
    }));

  const pastMembers = group.memberships
    .filter((m: GroupMembership & { user: { id: string; displayName: string; email: string } }) => m.leftAt !== null && m.leftAt < now)
    .map((m: GroupMembership & { user: { id: string; displayName: string; email: string } }) => ({
      membershipId: m.id,
      userId: m.user.id,
      displayName: m.user.displayName,
      email: m.user.email,
      role: m.role,
      joinedAt: m.joinedAt,
      leftAt: m.leftAt,
    }));

  return {
    id: group.id,
    name: group.name,
    createdAt: group.createdAt,
    myRole: requesterMembership.role,
    currentMembers,
    pastMembers,
  };
}

/**
 * Rename a group. Caller must be an ADMIN.
 */
export async function renameGroup(params: {
  groupId: string;
  requesterId: string;
  name: string;
}) {
  const { groupId, requesterId, name } = params;

  await requireAdmin(requesterId, groupId);

  return prisma.group.update({
    where: { id: groupId },
    data: { name },
    select: { id: true, name: true, updatedAt: true },
  });
}

// ---------------------------------------------------------------------------
// Membership management
// ---------------------------------------------------------------------------

/**
 * Add a user to a group by email. Admin-only.
 *
 * joinedAt defaults to now() if not provided. A future date is allowed
 * (e.g. "Priya moves in next Monday") — the expense service will correctly
 * exclude her from expenses before that date.
 */
export async function addMember(params: {
  groupId: string;
  requesterId: string;
  email: string;
  joinedAt?: Date;
}) {
  const { groupId, requesterId, email, joinedAt = new Date() } = params;

  // Guard: requester must be an admin
  await requireAdmin(requesterId, groupId);

  // Guard: target user must be registered
  const targetUser = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, displayName: true, email: true },
  });
  if (!targetUser) throw new UserNotFoundError(email);

  // Guard: target must not already be an active member
  const alreadyActive = await isActiveMember(targetUser.id, groupId, joinedAt);
  if (alreadyActive) throw new AlreadyMemberError();

  const membership = await prisma.groupMembership.create({
    data: {
      groupId,
      userId: targetUser.id,
      role: GroupRole.MEMBER, // new members always start as MEMBER; promote separately
      joinedAt,
    },
    include: {
      user: { select: { id: true, displayName: true, email: true } },
    },
  });

  return {
    membershipId: membership.id,
    userId: membership.user.id,
    displayName: membership.user.displayName,
    email: membership.user.email,
    role: membership.role,
    joinedAt: membership.joinedAt,
    leftAt: membership.leftAt,
  };
}

/**
 * End a membership by setting leftAt. Admin-only.
 *
 * Does NOT delete the row — full history is preserved (D3).
 *
 * Guards:
 *   - Requester must be an admin
 *   - Target user must have an active membership (no leftAt yet)
 *   - Admin cannot end their own membership (would risk admin-less group)
 *   - Cannot end the last admin's membership (admin-lock guard)
 */
export async function endMembership(params: {
  groupId: string;
  requesterId: string;
  targetUserId: string;
  leftAt: Date;
}) {
  const { groupId, requesterId, targetUserId, leftAt } = params;

  // Guard: requester must be an admin
  await requireAdmin(requesterId, groupId);

  // Guard: an admin cannot end their own membership through this route.
  // (They'd need to transfer admin first or have another admin remove them.)
  if (requesterId === targetUserId) {
    throw new CannotEndOwnMembershipError();
  }

  // Find the active membership row for the target user
  const activeMembership = await prisma.groupMembership.findFirst({
    where: {
      userId: targetUserId,
      groupId,
      leftAt: null, // only the currently-open stint
    },
  });

  if (!activeMembership) {
    // Distinguish: does the user exist in the group historically?
    const anyMembership = await prisma.groupMembership.findFirst({
      where: { userId: targetUserId, groupId },
    });
    if (!anyMembership) throw new MembershipNotFoundError();
    throw new MembershipAlreadyEndedError();
  }

  // Guard: if the target is an ADMIN, make sure there's at least one other admin
  if (activeMembership.role === GroupRole.ADMIN) {
    const now = new Date();
    const adminCount = await prisma.groupMembership.count({
      where: {
        groupId,
        role: GroupRole.ADMIN,
        joinedAt: { lte: now },
        OR: [{ leftAt: null }, { leftAt: { gte: now } }],
      },
    });
    if (adminCount <= 1) throw new LastAdminError();
  }

  // Set leftAt — do NOT delete the row
  return prisma.groupMembership.update({
    where: { id: activeMembership.id },
    data: { leftAt },
    select: {
      id: true,
      userId: true,
      groupId: true,
      role: true,
      joinedAt: true,
      leftAt: true,
    },
  });
}

/**
 * List all memberships for a group (current + historical).
 * Any active member can call this (not admin-only).
 * Separated here as a lightweight query for cases where the full
 * getGroupDetail is not needed (e.g. the import engine verifying members).
 */
export async function listMembers(params: { groupId: string; requesterId: string }) {
  const { groupId, requesterId } = params;

  const requesterActive = await isActiveMember(requesterId, groupId);
  if (!requesterActive) {
    const exists = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true } });
    if (!exists) throw new GroupNotFoundError();
    throw new NotAMemberError();
  }

  return prisma.groupMembership.findMany({
    where: { groupId },
    include: {
      user: { select: { id: true, displayName: true, email: true } },
    },
    orderBy: { joinedAt: "asc" },
  });
}

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

/**
 * Throws NotAnAdminError if the requester is not a current ADMIN of groupId.
 * Also throws GroupNotFoundError if the group doesn't exist (since we check
 * membership first — if no active admin membership, we differentiate).
 *
 * Called at the top of every admin-only operation.
 */
async function requireAdmin(requesterId: string, groupId: string): Promise<void> {
  const membership = await getActiveMembership(requesterId, groupId);

  if (!membership) {
    const exists = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true } });
    if (!exists) throw new GroupNotFoundError();
    throw new NotAMemberError();
  }

  if (membership.role !== GroupRole.ADMIN) {
    throw new NotAnAdminError();
  }
}
