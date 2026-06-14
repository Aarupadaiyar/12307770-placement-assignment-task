// backend/src/services/anomalyDetector.ts

import { PrismaClient, User, GroupMembership } from "@prisma/client";
import { AnomalyType, AnomalySeverity, Currency, SplitType } from "shared";

const prisma = new PrismaClient();

export interface RawRowData {
  date?: string;
  description?: string;
  amount?: string;
  currency?: string;
  paid_by?: string;
  split_type?: string;
  split_with?: string;
  split_details?: string;
  category?: string;
  notes?: string;
}

export interface DetectedAnomaly {
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  description: string;
  suggestedAction: string;
}

/**
 * Normalizes text to assist in fuzzy string comparisons.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Computes Levenshtein distance to check description similarity.
 */
function getLevenshteinDistance(a: string, b: string): number {
  const tmp: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
}

/**
 * Checks similarity score between two descriptions.
 */
function areDescriptionsSimilar(desc1: string, desc2: string): boolean {
  const n1 = normalizeText(desc1);
  const n2 = normalizeText(desc2);
  if (n1 === n2) return true;
  const maxLen = Math.max(n1.length, n2.length);
  if (maxLen === 0) return true;
  const dist = getLevenshteinDistance(n1, n2);
  const similarity = 1 - dist / maxLen;
  return similarity > 0.75; // 75% similarity threshold
}

/**
 * Scans a staging row and runs all 17 anomaly checks.
 */
export async function detectAnomalies(
  groupId: string,
  rowNumber: number,
  rawData: RawRowData,
  allJobRows: { rowNumber: number; rawData: RawRowData }[]
): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = [];

  // 1. Date Validation
  let parsedDate: Date | null = null;
  const dateStr = rawData.date?.trim();
  if (!dateStr) {
    anomalies.push({
      anomalyType: AnomalyType.INVALID_DATE,
      severity: AnomalySeverity.ERROR,
      description: "Expense date field is missing or empty.",
      suggestedAction: "SKIP_ROW or MANUALLY_ENTER_DATE",
    });
  } else {
    // Attempt parse
    // Expected formats: DD-MM-YYYY, YYYY-MM-DD, or DD/MM/YYYY
    const dParts = dateStr.split(/[-/]/);
    if (dParts.length === 3) {
      let day = parseInt(dParts[0], 10);
      let month = parseInt(dParts[1], 10) - 1;
      let year = parseInt(dParts[2], 10);

      // Handle YYYY-MM-DD
      if (dParts[0].length === 4) {
        year = parseInt(dParts[0], 10);
        month = parseInt(dParts[1], 10) - 1;
        day = parseInt(dParts[2], 10);
      }

      const testDate = new Date(year, month, day);
      if (!isNaN(testDate.getTime())) {
        parsedDate = testDate;
      }
    }

    if (!parsedDate) {
      const fallbackDate = new Date(dateStr);
      if (!isNaN(fallbackDate.getTime())) {
        parsedDate = fallbackDate;
      }
    }

    if (!parsedDate) {
      anomalies.push({
        anomalyType: AnomalyType.INVALID_DATE,
        severity: AnomalySeverity.ERROR,
        description: `Failed to parse date string: "${dateStr}".`,
        suggestedAction: "CORRECT_DATE_FORMAT (DD-MM-YYYY)",
      });
    } else if (parsedDate > new Date()) {
      anomalies.push({
        anomalyType: AnomalyType.INVALID_DATE,
        severity: AnomalySeverity.WARNING,
        description: `Expense date "${dateStr}" is in the future.`,
        suggestedAction: "ADJUST_DATE_TO_TODAY or SKIP",
      });
    }
  }

  // 2. Amount Validation
  let parsedAmount = 0;
  const amountStr = rawData.amount?.trim();
  if (!amountStr) {
    anomalies.push({
      anomalyType: AnomalyType.INVALID_AMOUNT,
      severity: AnomalySeverity.ERROR,
      description: "Amount field is empty.",
      suggestedAction: "SKIP_ROW or ENTER_AMOUNT",
    });
  } else {
    // Check for commas (e.g. "1,200")
    if (amountStr.includes(",")) {
      anomalies.push({
        anomalyType: AnomalyType.INVALID_AMOUNT,
        severity: AnomalySeverity.INFO,
        description: `Amount "${amountStr}" contains formatting commas.`,
        suggestedAction: "STRIP_COMMAS_AND_PARSE",
      });
    }

    const cleanedAmount = amountStr.replace(/,/g, "");
    parsedAmount = parseFloat(cleanedAmount);

    if (isNaN(parsedAmount)) {
      anomalies.push({
        anomalyType: AnomalyType.INVALID_AMOUNT,
        severity: AnomalySeverity.ERROR,
        description: `Amount "${amountStr}" is not a valid number.`,
        suggestedAction: "MANUALLY_ENTER_AMOUNT",
      });
    } else {
      // Check decimal precision (e.g. 899.995)
      const dotIndex = cleanedAmount.indexOf(".");
      if (dotIndex !== -1 && cleanedAmount.length - dotIndex - 1 > 2) {
        anomalies.push({
          anomalyType: AnomalyType.INVALID_AMOUNT,
          severity: AnomalySeverity.INFO,
          description: `Amount "${amountStr}" has precision exceeding 2 decimals.`,
          suggestedAction: "ROUND_TO_TWO_DECIMALS",
        });
      }

      // Negative amount check
      if (parsedAmount < 0) {
        anomalies.push({
          anomalyType: AnomalyType.NEGATIVE_AMOUNT,
          severity: AnomalySeverity.WARNING,
          description: `Amount "${amountStr}" is negative.`,
          suggestedAction: "TREAT_AS_REFUND (Negative balances split)",
        });
      } else if (parsedAmount === 0) {
        anomalies.push({
          anomalyType: AnomalyType.INVALID_AMOUNT,
          severity: AnomalySeverity.WARNING,
          description: "Expense amount is zero.",
          suggestedAction: "MARK_AS_ZERO_VALUE",
        });
      }
    }
  }

  // 3. Payer checks
  const paidBy = rawData.paid_by?.trim();
  let payerUser: User | null = null;
  if (!paidBy) {
    anomalies.push({
      anomalyType: AnomalyType.MISSING_PAYER,
      severity: AnomalySeverity.ERROR,
      description: "Payer column is missing or blank.",
      suggestedAction: "ASSIGN_TO_GROUP_ADMIN",
    });
  } else {
    // Attempt alias/user match in database
    const resolvedPayer = await resolveUserByAliasOrEmail(paidBy);
    if (!resolvedPayer) {
      anomalies.push({
        anomalyType: AnomalyType.UNKNOWN_MEMBER,
        severity: AnomalySeverity.ERROR,
        description: `Payer "${paidBy}" cannot be matched to any registered flatmate.`,
        suggestedAction: "RESOLVE_USER_ALIAS or SKIP",
      });
    } else {
      payerUser = resolvedPayer;
      // Check membership dates
      if (parsedDate) {
        const membership = await checkMembershipStatus(groupId, payerUser.id, parsedDate);
        if (!membership.exists) {
          anomalies.push({
            anomalyType: AnomalyType.UNKNOWN_MEMBER,
            severity: AnomalySeverity.ERROR,
            description: `Payer "${payerUser.displayName}" is not a member of the group.`,
            suggestedAction: "ADD_MEMBER_TO_GROUP",
          });
        } else {
          if (membership.joinedAfter) {
            anomalies.push({
              anomalyType: AnomalyType.EXPENSE_BEFORE_MEMBER_JOINED,
              severity: AnomalySeverity.WARNING,
              description: `Payer "${payerUser.displayName}" paid before they joined (Joined: ${membership.joinedAt?.toLocaleDateString()}).`,
              suggestedAction: "BACKDATE_JOIN_DATE or REASSIGN_PAYER",
            });
          }
          if (membership.leftBefore) {
            anomalies.push({
              anomalyType: AnomalyType.EXPENSE_AFTER_MEMBER_LEFT,
              severity: AnomalySeverity.WARNING,
              description: `Payer "${payerUser.displayName}" paid after they left the flat (Left: ${membership.leftAt?.toLocaleDateString()}).`,
              suggestedAction: "EXTEND_MEMBERSHIP_EXIT_DATE or REASSIGN_PAYER",
            });
          }
        }
      }
    }
  }

  // 4. Currency Checks
  const currencyStr = rawData.currency?.trim().toUpperCase();
  if (!currencyStr) {
    anomalies.push({
      anomalyType: AnomalyType.CURRENCY_MISMATCH,
      severity: AnomalySeverity.INFO,
      description: "Currency field is missing. Defaulting to group currency.",
      suggestedAction: "ASSIGN_DEFAULT_CURRENCY_INR",
    });
  } else if (currencyStr !== Currency.INR && currencyStr !== Currency.USD) {
    anomalies.push({
      anomalyType: AnomalyType.CURRENCY_MISMATCH,
      severity: AnomalySeverity.ERROR,
      description: `Unsupported currency code "${currencyStr}".`,
      suggestedAction: "MAP_TO_INR",
    });
  } else if (currencyStr === Currency.USD) {
    anomalies.push({
      anomalyType: AnomalyType.USD_CONVERSION_REQUIRED,
      severity: AnomalySeverity.INFO,
      description: "USD transaction. Historical currency conversion required.",
      suggestedAction: "FETCH_HISTORICAL_FX_RATE",
    });
  }

  // 5. Settlement Reclassification check
  const description = rawData.description?.trim() || "";
  const splitType = rawData.split_type?.trim().toUpperCase();
  const splitWith = rawData.split_with?.trim();
  const isSettlementText =
    /paid.*back|settle|refund|repay/i.test(description) ||
    (!splitType && splitWith && !splitWith.includes(";") && !splitWith.includes(","));
  if (isSettlementText) {
    anomalies.push({
      anomalyType: AnomalyType.SETTLEMENT_LOGGED_AS_EXPENSE,
      severity: AnomalySeverity.INFO,
      description: `Description "${description}" suggests a direct debt settlement rather than a shared expense.`,
      suggestedAction: "RECLASSIFY_AS_SETTLEMENT",
    });
  }

  // 6. Split Details Validation
  if (!isSettlementText) {
    if (!splitType) {
      anomalies.push({
        anomalyType: AnomalyType.UNKNOWN_SPLIT_TYPE,
        severity: AnomalySeverity.ERROR,
        description: "Split type is missing.",
        suggestedAction: "SET_SPLIT_TYPE_TO_EQUAL",
      });
    } else if (
      splitType !== SplitType.EQUAL &&
      splitType !== SplitType.PERCENTAGE &&
      splitType !== SplitType.SHARE &&
      splitType !== SplitType.UNEQUAL
    ) {
      anomalies.push({
        anomalyType: AnomalyType.UNKNOWN_SPLIT_TYPE,
        severity: AnomalySeverity.ERROR,
        description: `Unknown split type "${splitType}".`,
        suggestedAction: "REPLACE_WITH_EQUAL_SPLIT",
      });
    }

    // Participants validation
    if (!splitWith) {
      anomalies.push({
        anomalyType: AnomalyType.INVALID_PARTICIPANT_LIST,
        severity: AnomalySeverity.ERROR,
        description: "Participant list (split_with) is empty.",
        suggestedAction: "SPLIT_WITH_ALL_CURRENT_MEMBERS",
      });
    } else {
      const participants = splitWith.split(/[;,]/).map((p) => p.trim()).filter(Boolean);
      if (participants.length === 0) {
        anomalies.push({
          anomalyType: AnomalyType.INVALID_PARTICIPANT_LIST,
          severity: AnomalySeverity.ERROR,
          description: "No participants resolved in split_with.",
          suggestedAction: "SPLIT_WITH_ALL_CURRENT_MEMBERS",
        });
      } else {
        // Validate each participant
        for (const p of participants) {
          const resolvedPart = await resolveUserByAliasOrEmail(p);
          if (!resolvedPart) {
            anomalies.push({
              anomalyType: AnomalyType.UNKNOWN_MEMBER,
              severity: AnomalySeverity.ERROR,
              description: `Split participant "${p}" cannot be matched to any registered flatmate.`,
              suggestedAction: "RESOLVE_USER_ALIAS or REMOVE_FROM_SPLIT",
            });
          } else if (parsedDate) {
            const membership = await checkMembershipStatus(groupId, resolvedPart.id, parsedDate);
            if (!membership.exists) {
              anomalies.push({
                anomalyType: AnomalyType.INVALID_PARTICIPANT_LIST,
                severity: AnomalySeverity.ERROR,
                description: `Participant "${resolvedPart.displayName}" is not a member of the group.`,
                suggestedAction: "EXCLUDE_PARTICIPANT_FROM_SPLIT",
              });
            } else {
              if (membership.joinedAfter) {
                anomalies.push({
                  anomalyType: AnomalyType.EXPENSE_BEFORE_MEMBER_JOINED,
                  severity: AnomalySeverity.WARNING,
                  description: `Participant "${resolvedPart.displayName}" split before joining (Joined: ${membership.joinedAt?.toLocaleDateString()}).`,
                  suggestedAction: "EXCLUDE_PARTICIPANT or BACKDATE_JOIN",
                });
              }
              if (membership.leftBefore) {
                anomalies.push({
                  anomalyType: AnomalyType.EXPENSE_AFTER_MEMBER_LEFT,
                  severity: AnomalySeverity.WARNING,
                  description: `Participant "${resolvedPart.displayName}" split after leaving (Left: ${membership.leftAt?.toLocaleDateString()}).`,
                  suggestedAction: "EXCLUDE_PARTICIPANT or EXTEND_EXIT",
                });
              }
            }
          }
        }
      }
    }

    // Split value totals (mismatch validation)
    const splitDetailsStr = rawData.split_details?.trim();
    if (splitType === SplitType.PERCENTAGE && splitDetailsStr) {
      const pairs = splitDetailsStr.split(/[;,]/).map((p) => p.trim()).filter(Boolean);
      let totalPercent = 0;
      pairs.forEach((pair) => {
        const parts = pair.split(/\s+/);
        const val = parseFloat(parts[parts.length - 1]);
        if (!isNaN(val)) {
          totalPercent += val;
        }
      });
      if (Math.abs(totalPercent - 100) > 0.01) {
        anomalies.push({
          anomalyType: AnomalyType.TOTAL_SPLIT_NOT_EQUAL_TO_AMOUNT,
          severity: AnomalySeverity.ERROR,
          description: `Sum of split percentages totals ${totalPercent}% instead of 100%.`,
          suggestedAction: "NORMALIZE_PERCENTAGES_TO_100",
        });
      }
    } else if (splitType === SplitType.UNEQUAL && splitDetailsStr && !isNaN(parsedAmount)) {
      const pairs = splitDetailsStr.split(/[;,]/).map((p) => p.trim()).filter(Boolean);
      let totalSplitVal = 0;
      pairs.forEach((pair) => {
        const parts = pair.split(/\s+/);
        const val = parseFloat(parts[parts.length - 1]);
        if (!isNaN(val)) {
          totalSplitVal += val;
        }
      });
      if (Math.abs(totalSplitVal - parsedAmount) > 0.05) {
        anomalies.push({
          anomalyType: AnomalyType.TOTAL_SPLIT_NOT_EQUAL_TO_AMOUNT,
          severity: AnomalySeverity.ERROR,
          description: `Sum of split details values (${totalSplitVal}) does not equal total amount (${parsedAmount}).`,
          suggestedAction: "RESCALE_SPLITS_PROPORTIONALLY",
        });
      }
    }
  }

  // 7. Category Check
  const category = rawData.category?.trim();
  if (!category) {
    anomalies.push({
      anomalyType: AnomalyType.MISSING_CATEGORY,
      severity: AnomalySeverity.INFO,
      description: "Expense row is missing a category.",
      suggestedAction: "ASSIGN_CATEGORY_UNGROUPED",
    });
  }

  // 8. Duplicate / Near-Duplicate checks
  if (parsedDate && !isNaN(parsedAmount) && paidBy) {
    // A. Check intra-job duplicates in the currently uploaded file list
    const intraDuplicate = allJobRows.find(
      (r: { rowNumber: number; rawData: RawRowData }) =>
        r.rowNumber !== rowNumber &&
        r.rawData.date === rawData.date &&
        r.rawData.amount === rawData.amount &&
        r.rawData.paid_by === rawData.paid_by
    );

    if (intraDuplicate) {
      if (intraDuplicate.rawData.description === rawData.description) {
        anomalies.push({
          anomalyType: AnomalyType.DUPLICATE_EXPENSE,
          severity: AnomalySeverity.WARNING,
          description: `Row has identical date, amount, payer, and description as row #${intraDuplicate.rowNumber}.`,
          suggestedAction: `MERGE_WITH_ROW_${intraDuplicate.rowNumber} or IGNORE`,
        });
      } else if (areDescriptionsSimilar(description, intraDuplicate.rawData.description || "")) {
        anomalies.push({
          anomalyType: AnomalyType.NEAR_DUPLICATE_EXPENSE,
          severity: AnomalySeverity.WARNING,
          description: `Row has matching date, amount, payer, and a highly similar description to row #${intraDuplicate.rowNumber}.`,
          suggestedAction: `MERGE_WITH_ROW_${intraDuplicate.rowNumber} or KEEP_BOTH`,
        });
      }
    }

    // B. Check inter-job duplicates against database records in the group
    const dbDuplicates = await prisma.expense.findMany({
      where: {
        groupId,
        amount: parsedAmount,
        date: parsedDate,
      },
      include: {
        paidBy: true,
      },
    });

    for (const dbExp of dbDuplicates) {
      if (dbExp.paidBy.email === payerUser?.email || dbExp.paidBy.displayName === paidBy) {
        if (dbExp.description === description) {
          anomalies.push({
            anomalyType: AnomalyType.DUPLICATE_EXPENSE,
            severity: AnomalySeverity.WARNING,
            description: `Row matches date, amount, payer, and description of existing Expense ID: ${dbExp.id.slice(0, 8)}.`,
            suggestedAction: "EXCLUDE_ROW (Already imported)",
          });
        } else if (areDescriptionsSimilar(description, dbExp.description)) {
          anomalies.push({
            anomalyType: AnomalyType.NEAR_DUPLICATE_EXPENSE,
            severity: AnomalySeverity.WARNING,
            description: `Row matches date, amount, and payer of existing Expense: "${dbExp.description}" (ID: ${dbExp.id.slice(0, 8)}).`,
            suggestedAction: "KEEP_BOTH or EXCLUDE_ROW",
          });
        }
      }
    }
  }

  return anomalies;
}

/**
 * Resolves a raw name/email string from CSV to a database User.
 */
async function resolveUserByAliasOrEmail(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  
  // Direct email match
  const userByEmail = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: "insensitive" } },
  });
  if (userByEmail) return userByEmail;

  // DisplayName match
  const userByDisplay = await prisma.user.findFirst({
    where: { displayName: { equals: identifier.trim(), mode: "insensitive" } },
  });
  if (userByDisplay) return userByDisplay;

  // Alias lookup
  const alias = await prisma.userAlias.findFirst({
    where: { rawValue: { equals: identifier.trim(), mode: "insensitive" } },
    include: { user: true },
  });
  if (alias) return alias.user;

  return null;
}

/**
 * Checks if a user is/was a member of the group on a specific date.
 */
async function checkMembershipStatus(groupId: string, userId: string, date: Date) {
  const memberships = await prisma.groupMembership.findMany({
    where: { groupId, userId },
  });

  if (memberships.length === 0) {
    return { exists: false };
  }

  // Find membership window covering date
  const valid = memberships.find((m: GroupMembership) => {
    const start = new Date(m.joinedAt);
    const end = m.leftAt ? new Date(m.leftAt) : null;
    return start <= date && (end === null || end >= date);
  });

  if (valid) {
    return { exists: true, joinedAt: valid.joinedAt, leftAt: valid.leftAt };
  }

  // If no valid window found, identify if it falls outside bounds
  const firstMem = memberships[0];
  const joinedAt = firstMem.joinedAt;
  const leftAt = firstMem.leftAt;

  return {
    exists: true,
    joinedAt,
    leftAt,
    joinedAfter: date < new Date(joinedAt),
    leftBefore: leftAt ? date > new Date(leftAt) : false,
  };
}
