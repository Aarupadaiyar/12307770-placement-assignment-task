// backend/src/services/memberMapping.service.ts

import { PrismaClient, CsvMappingStatus, GroupMembership, CsvIdentityMapping, GroupMember } from "@prisma/client";
import { MappingAction } from "shared";
import { parseCsv } from "./csvParser";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function levenshtein(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= al; i++) matrix[i] = [i];
  for (let j = 0; j <= bl; j++) matrix[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }
  return matrix[al][bl];
}

export function normalizeCsvName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ").replace(/^["']|["']$/g, "");
}

// ---------------------------------------------------------------------------
// extractCsvParticipants
// ---------------------------------------------------------------------------

/**
 * Parse CSV content and collect every unique name that appears in
 * "paid_by" or "split_with" (comma / semicolon separated).
 */
export async function extractCsvParticipants(csvContent: string): Promise<string[]> {
  const records = parseCsv(csvContent);

  const participants = new Set<string>();

  for (const row of records) {
    if (row.paid_by?.trim()) participants.add(row.paid_by.trim());

    if (row.split_with?.trim()) {
      for (const p of row.split_with.split(/[,;]+/)) {
        const name = p.trim();
        if (name) participants.add(name);
      }
    }
  }

  return Array.from(participants);
}

// ---------------------------------------------------------------------------
// autoSuggestMappings
// ---------------------------------------------------------------------------

export interface MappingSuggestion {
  groupMemberId: string;
  displayName: string;
  confidence: number;
}

export interface ParticipantMapping {
  csvName: string;
  status: string;
  suggestion: MappingSuggestion | null;
}

/**
 * For each participant name:
 *   1. Check whether a prior CsvIdentityMapping already exists for this group.
 *   2. Fuzzy-match against existing GroupMember.displayName using normalized heuristics.
 *   3. Otherwise → PENDING.
 *
 * This function does NOT write anything to the DB.
 */
export async function autoSuggestMappings(
  groupId: string,
  names: string[]
): Promise<ParticipantMapping[]> {
  const [existingIdentities, members] = await Promise.all([
    prisma.csvIdentityMapping.findMany({
      where: { groupId, originalName: { in: names } },
      include: { approvedMember: true, suggestedMember: true },
    }),
    prisma.groupMember.findMany({ where: { groupId } }),
  ]);

  const identityMap = new Map(existingIdentities.map((i: CsvIdentityMapping & { approvedMember: GroupMember | null, suggestedMember: GroupMember | null }) => [i.originalName, i]));

  return names.map((name: string) => {
    const normName = normalizeCsvName(name);

    // 1. Prior confirmed mapping
    const identity = identityMap.get(name);
    if (identity && identity.decision !== "PENDING") {
      return {
        csvName: name,
        status: identity.decision,
        suggestion: identity.approvedMemberId
          ? {
              groupMemberId: identity.approvedMemberId,
              displayName: identity.approvedMember?.displayName ?? name,
              confidence: identity.confidence,
            }
          : null,
      };
    }

    // 2. Fuzzy match against GroupMember displayNames
    let bestMember: (typeof members)[0] | null = null;
    let bestConfidence = 0;

    for (const member of members) {
      const normMemberName = normalizeCsvName(member.displayName);
      
      let confidence = 0;
      if (normName === normMemberName) {
        confidence = 100;
      } else if (normMemberName.startsWith(normName) || normName.startsWith(normMemberName)) {
        confidence = 90;
      } else if (normMemberName.includes(normName) || normName.includes(normMemberName)) {
        confidence = 90;
      } else {
        const dist = levenshtein(normName, normMemberName);
        if (dist <= 2) {
          confidence = 85;
        }
      }

      if (confidence > bestConfidence) {
        bestConfidence = confidence;
        bestMember = member;
      }
    }

    if (bestMember && bestConfidence > 0) {
      return {
        csvName: name,
        status: CsvMappingStatus.AUTO_MAPPED,
        suggestion: {
          groupMemberId: bestMember.id,
          displayName: bestMember.displayName,
          confidence: bestConfidence / 100, // Frontend expects 0-1
        },
      };
    }

    // 3. No match — admin must resolve
    return { csvName: name, status: CsvMappingStatus.PENDING, suggestion: null };
  });
}

// ---------------------------------------------------------------------------
// upsertCsvIdentitiesForJob
// ---------------------------------------------------------------------------

/**
 * Called immediately after CSV upload.
 * Creates/updates a CsvIdentityMapping row for every unique participant name,
 * applying auto-suggestions where possible.
 * Returns the list of participant mappings.
 */
export async function upsertCsvIdentitiesForJob(
  groupId: string,
  participantNames: string[]
): Promise<ParticipantMapping[]> {
  const suggestions = await autoSuggestMappings(groupId, participantNames);

  for (const s of suggestions) {
    const existingIdentity = await prisma.csvIdentityMapping.findUnique({
      where: { groupId_originalName: { groupId, originalName: s.csvName } },
    });

    if (!existingIdentity) {
      // Create a new identity mapping row
      await prisma.csvIdentityMapping.create({
        data: {
          groupId,
          originalName: s.csvName,
          normalizedName: normalizeCsvName(s.csvName),
          suggestedMemberId: s.suggestion?.groupMemberId ?? null,
          decision: s.suggestion ? CsvMappingStatus.AUTO_MAPPED : CsvMappingStatus.PENDING,
          confidence: s.suggestion?.confidence ?? 0,
        },
      });
    }
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// getMappingStatus
// ---------------------------------------------------------------------------

/**
 * Return the current mapping status for all participants in a job.
 */
export async function getMappingStatus(groupId: string, jobId: string) {
  const job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Import job not found");

  const participantNames = (job.participantNames as string[] | null) ?? [];

  const identities = await prisma.csvIdentityMapping.findMany({
    where: { groupId, originalName: { in: participantNames } },
    include: { approvedMember: true, suggestedMember: true },
  });

  const identityMap = new Map(identities.map((i: CsvIdentityMapping & { approvedMember: GroupMember | null, suggestedMember: GroupMember | null }) => [i.originalName, i]));

  const participants: ParticipantMapping[] = participantNames.map((name: string) => {
    const identity = identityMap.get(name);
    if (!identity) {
      return { csvName: name, status: CsvMappingStatus.PENDING, suggestion: null };
    }
    
    // Fallback to suggestedMember if approvedMember is not set yet
    const member = identity.approvedMember || identity.suggestedMember;
    
    return {
      csvName: name,
      status: identity.decision,
      suggestion: member
        ? {
            groupMemberId: member.id,
            displayName: member.displayName ?? name,
            confidence: identity.confidence,
          }
        : null,
    };
  });

  const pendingCount = participants.filter((p: ParticipantMapping) => p.status === CsvMappingStatus.PENDING).length;

  return {
    jobId,
    jobStatus: job.status,
    participants,
    totalCount: participants.length,
    pendingCount,
  };
}

// ---------------------------------------------------------------------------
// getGroupMembers
// ---------------------------------------------------------------------------

/**
 * List all GroupMember entries for a group, joined with GroupMembership for
 * joinDate/leftAt (drives the dropdowns in the UI).
 */
export async function getGroupMembers(groupId: string) {
  const groupMembers = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: { select: { email: true } } },
    orderBy: { displayName: "asc" },
  });

  // Fetch memberships to attach join/left dates for registered users
  const memberships = await prisma.groupMembership.findMany({
    where: { groupId },
    orderBy: { joinedAt: "asc" },
  });

  return groupMembers.map((gm: GroupMember & { user: { email: string } | null }) => {
    // A single user might have multiple historical memberships, 
    // find the most recent/active one
    const userMemberships = gm.userId ? memberships.filter((m: GroupMembership) => m.userId === gm.userId) : [];
    const activeMembership = userMemberships.find((m: GroupMembership) => m.leftAt === null) || userMemberships[userMemberships.length - 1];
    
    return {
      id: gm.id,
      userId: gm.userId,
      displayName: gm.displayName,
      email: gm.user?.email,
      isPlaceholder: gm.isPlaceholder,
      joinedAt: activeMembership?.joinedAt || null,
      leftAt: activeMembership?.leftAt || null,
    };
  });
}

// ---------------------------------------------------------------------------
// submitMappingDecisions
// ---------------------------------------------------------------------------

export interface MappingDecision {
  csvName: string;
  action: MappingAction;
  groupMemberId?: string;  // for MAP action
  displayName?: string;    // for CREATE_PLACEHOLDER action
}

/**
 * Persist admin decisions for a batch of participants.
 * After all decisions, if nothing remains PENDING the job advances
 * to PROCESSING so the anomaly detector can run.
 */
export async function submitMappingDecisions(
  groupId: string,
  jobId: string,
  decisions: MappingDecision[],
  _adminUserId: string
) {
  const job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job || job.groupId !== groupId) {
    throw new Error("Import job not found or does not belong to this group");
  }

  for (const d of decisions) {
    const { csvName, action } = d;
    if (!csvName || !action) continue;

    // Ensure the CsvIdentityMapping row exists
    await prisma.csvIdentityMapping.upsert({
      where: { groupId_originalName: { groupId, originalName: csvName } },
      update: {},
      create: { groupId, originalName: csvName, normalizedName: normalizeCsvName(csvName) },
    });

    if (action === MappingAction.IGNORE) {
      await prisma.csvIdentityMapping.update({
        where: { groupId_originalName: { groupId, originalName: csvName } },
        data: {
          decision: CsvMappingStatus.IGNORED,
          approvedMemberId: null,
          confidence: 1,
        },
      });
      continue;
    }

    let memberId: string | null = null;

    if (action === MappingAction.MAP) {
      if (!d.groupMemberId) {
        throw new Error(`MAP action for "${csvName}" requires a groupMemberId`);
      }
      memberId = d.groupMemberId;
    } else if (action === MappingAction.CREATE_PLACEHOLDER) {
      const placeholder = await prisma.groupMember.create({
        data: {
          groupId,
          displayName: d.displayName ?? csvName,
          hasAccount: false,
          isPlaceholder: true,
        },
      });
      memberId = placeholder.id;
    }

    if (memberId) {
      await prisma.csvIdentityMapping.update({
        where: { groupId_originalName: { groupId, originalName: csvName } },
        data: {
          approvedMemberId: memberId,
          decision: CsvMappingStatus.MAPPED,
          confidence: 1,
        },
      });
    }
  }

  // Check whether any participants for this job are still PENDING
  const participantNames = (job.participantNames as string[] | null) ?? [];
  const pendingCount = await prisma.csvIdentityMapping.count({
    where: {
      groupId,
      originalName: { in: participantNames },
      decision: CsvMappingStatus.PENDING,
    },
  });

  // Advance the job: when all are resolved, trigger anomaly detection
  if (pendingCount === 0) {
    // Import runAnomalyPhase lazily to avoid a circular-import issue
    const { runAnomalyPhase } = await import("./importJob.service");
    await runAnomalyPhase(jobId, groupId);
  }

  return { success: true, pendingCount };
}
