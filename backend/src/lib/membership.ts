// backend/src/lib/membership.ts
//
// =============================================================================
// WHY THIS FILE EXISTS
// =============================================================================
// This file contains ONE exported function: `isActiveMember`.
//
// It answers the question: "Was user X an active member of group Y on date D?"
//
// THIS FUNCTION IS THE LINCHPIN OF THE WHOLE SYSTEM. Every later module
// that touches expenses, imports, or balance calculations depends on it:
//
//   - Module 4 (Expenses): before creating an expense, validate that all
//     split participants were active members on the expense date.
//   - Module 5 (Import Engine): anomaly detectors NON_MEMBER_IN_SPLIT,
//     MEMBER_INACTIVE_ON_DATE, and PAYER_NOT_YET_MEMBER all call this.
//   - Module 6 (Balance Engine): when computing "what does X owe Y", only
//     expenses where X was active at that date are included.
//
// WHY A SEPARATE FILE (not inside group.service.ts):
// Because modules 4, 5, and 6 need to import this function WITHOUT importing
// the full group service (which would pull in group CRUD, role checks, etc.).
// A narrow import from lib/membership.ts is explicit about the dependency and
// avoids circular-import risk as the codebase grows.
//
// WHY NOT A METHOD ON A CLASS:
// Simplicity. This is a pure database query with no mutable state. A module-
// level async function is easier to read, test, and point at in a live session
// than a method on a singleton service class.
//
// =============================================================================
// THE CORE QUERY (understand this, everything else follows)
// =============================================================================
//
//   SELECT 1 FROM group_memberships
//   WHERE userId = X
//     AND groupId = Y
//     AND joinedAt <= D
//     AND (leftAt IS NULL OR leftAt >= D)
//
// A user is active if they have at least one GroupMembership row where:
//   - They joined on or before date D  (joinedAt <= D)
//   - AND they have not yet left, OR they left on or after date D
//     (leftAt IS NULL = still active, OR leftAt >= D = left on/after D)
//
// The "leftAt >= D" (not ">") is an inclusive boundary: a user who left on
// the exact date of an expense is still considered a valid participant for
// that expense. This matches the business expectation: "Meera left March 31"
// means she is still responsible for a March 31 expense.
//
// =============================================================================

import { prisma } from "./prisma";

/**
 * Returns true if `userId` was an active member of `groupId` on `date`.
 *
 * "Active" means: there exists a GroupMembership row where:
 *   joinedAt <= date AND (leftAt IS NULL OR leftAt >= date)
 *
 * The date comparison uses midnight UTC of the provided date — callers should
 * normalise their date to midnight UTC before calling if they need exact-day
 * semantics (e.g. compare 2024-03-31T00:00:00Z, not 2024-03-31T15:30:00Z).
 *
 * Used by:
 *   - group.service.ts (addMember validation — can't re-add an already-active member)
 *   - expense.service.ts (Module 4) — validate split participants
 *   - import.service.ts  (Module 5) — anomaly detection
 *   - balance.service.ts (Module 6) — expense attribution
 *
 * @param userId  - the User.id to check
 * @param groupId - the Group.id to check membership in
 * @param date    - the point in time to check; defaults to now if omitted
 */
export async function isActiveMember(
  userId: string,
  groupId: string,
  date: Date = new Date()
): Promise<boolean> {
  const membership = await prisma.groupMembership.findFirst({
    where: {
      userId,
      groupId,
      joinedAt: { lte: date },
      OR: [
        { leftAt: null },           // still active (no departure recorded)
        { leftAt: { gte: date } },  // left on or after the check date
      ],
    },
    select: { id: true }, // we only need to know IF it exists, not the full row
  });

  return membership !== null;
}

/**
 * Returns the active GroupMembership row for `userId` in `groupId` at `date`,
 * or null if not active. Includes the `role` field.
 *
 * Use this when you need the role (e.g. "is this user an ADMIN?"), not just
 * the boolean. Saves a second DB round-trip vs. calling isActiveMember then
 * fetching the membership separately.
 *
 * Used by:
 *   - group.routes.ts — requireGroupRole middleware
 */
export async function getActiveMembership(
  userId: string,
  groupId: string,
  date: Date = new Date()
) {
  return prisma.groupMembership.findFirst({
    where: {
      userId,
      groupId,
      joinedAt: { lte: date },
      OR: [{ leftAt: null }, { leftAt: { gte: date } }],
    },
    select: { id: true, role: true, joinedAt: true, leftAt: true },
  });
}
