import { PrismaClient, Prisma, ImportRowStatus, ImportRow, ImportDecision, User } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { parseCsv } from "./csvParser";
import { detectAnomalies, RawRowData } from "./anomalyDetector";
import { extractCsvParticipants, upsertCsvIdentitiesForJob } from "./memberMapping.service";
import {
  AnomalyType,
  AnomalySeverity,
  AnomalyResolution,
  ImportJobStatus,
  Currency,
  SplitType,
  CsvMappingStatus,
} from "shared";

const prisma = new PrismaClient();

// Hardcoded fallback exchange rates around March 2026 for USD -> INR
const MOCK_FX_FALLBACK: Record<string, number> = {
  "2026-03": 83.45,
  "2026-04": 83.62,
  "default": 83.50,
};

function getMockFxRate(date: Date): number {
  const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  return MOCK_FX_FALLBACK[monthKey] || MOCK_FX_FALLBACK["default"];
}

/**
 * Creates and processes an import job.
 * NEW: Extracts participant names and runs member-mapping auto-suggest FIRST.
 * If any names are unresolved, the job is set to AWAITING_MAPPING and
 * anomaly detection is deferred until the admin resolves all mappings.
 */
export async function createImportJob(
  groupId: string,
  fileName: string,
  csvContent: string,
  uploadedById: string
) {
  const parsedRows = parseCsv(csvContent);
  const totalRows = parsedRows.length;

  // ── Step 1: Extract unique participant names from CSV ────────────────────
  const participantNames = await extractCsvParticipants(csvContent);

  // ── Step 2: Auto-suggest mappings (check CsvIdentity + fuzzy GroupMember) 
  const mappings = await upsertCsvIdentitiesForJob(groupId, participantNames);
  const hasPendingMappings = mappings.some((m) => m.status === CsvMappingStatus.PENDING);

  // ── Step 3: Create the ImportJob record ─────────────────────────────────
  const job = await prisma.importJob.create({
    data: {
      groupId,
      fileName,
      totalRows,
      uploadedById,
      participantNames,                 // stored for the mapping screen to read back
      mappingComplete: !hasPendingMappings,
      status: hasPendingMappings
        ? ImportJobStatus.AWAITING_MAPPING
        : ImportJobStatus.PROCESSING,
    },
  });

  // ── Step 4: Stage rows ───────────────────────────────────────────────────
  const rowDataToStage = parsedRows.map((row, idx) => ({
    importJobId: job.id,
    rowNumber: idx + 1,
    rawData: row as any,
    status: ImportRowStatus.PENDING,
  }));

  await prisma.importRow.createMany({ data: rowDataToStage });

  // ── Step 5: If mapping is already complete, run anomaly detection now ────
  if (!hasPendingMappings) {
    return runAnomalyPhase(job.id, groupId);
  }

  // Otherwise, return the job in AWAITING_MAPPING state — the frontend
  // will redirect to the mapping screen.
  return job;
}

/**
 * Runs anomaly detection on all staged rows for a job.
 * Called after all member mappings are confirmed.
 */
export async function runAnomalyPhase(jobId: string, groupId: string) {
  const job = await prisma.importJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Import job not found");

  const stagedRows = await prisma.importRow.findMany({
    where: { importJobId: jobId },
    orderBy: { rowNumber: "asc" },
  });

  let totalAnomalies = 0;

  for (const row of stagedRows) {
    const raw = row.rawData as RawRowData;
    const anomalies = await detectAnomalies(
      groupId,
      row.rowNumber,
      raw,
      stagedRows.map((r: ImportRow) => ({ rowNumber: r.rowNumber, rawData: r.rawData as RawRowData }))
    );

    if (anomalies.length > 0) {
      totalAnomalies += anomalies.length;

      await prisma.importAnomaly.createMany({
        data: anomalies.map((a) => ({
          importRowId: row.id,
          anomalyType: a.anomalyType,
          severity: a.severity,
          rowNumber: row.rowNumber,
          description: a.description,
          suggestedAction: a.suggestedAction,
        })),
      });

      await prisma.importRow.update({
        where: { id: row.id },
        data: { status: ImportRowStatus.PENDING },
      });
    } else {
      await prisma.importRow.update({
        where: { id: row.id },
        data: { status: ImportRowStatus.CLEAN },
      });
    }
  }

  const cleanRows = stagedRows.length - (await prisma.importRow.count({
    where: { importJobId: jobId, anomalies: { some: {} } },
  }));

  const updatedStatus =
    cleanRows === stagedRows.length ? ImportJobStatus.READY : ImportJobStatus.IN_REVIEW;

  const updatedJob = await prisma.importJob.update({
    where: { id: jobId },
    data: { status: updatedStatus, mappingComplete: true },
  });

  // Create / update the ImportReport
  const existing = await prisma.importReport.findUnique({ where: { importJobId: jobId } });
  if (existing) {
    await prisma.importReport.update({
      where: { importJobId: jobId },
      data: { totalRows: stagedRows.length, cleanRows, anomaliesCount: totalAnomalies },
    });
  } else {
    await prisma.importReport.create({
      data: {
        importJobId: jobId,
        totalRows: stagedRows.length,
        cleanRows,
        anomaliesCount: totalAnomalies,
        resolvedCount: 0,
        excludedCount: 0,
        duplicatesCount: 0,
      },
    });
  }

  return updatedJob;
}

/**
 * Registers a user decision on an anomaly row.
 */
export async function submitDecision(
  jobId: string,
  rowId: string,
  resolution: AnomalyResolution,
  details: Prisma.InputJsonValue | undefined,
  userId: string
) {
  // Upsert decision record
  await prisma.importDecision.upsert({
    where: { importRowId: rowId },
    update: {
      resolution,
      decisionDetails: (details as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      resolvedById: userId,
      resolvedAt: new Date(),
    },
    create: {
      importJobId: jobId,
      importRowId: rowId,
      resolution,
      decisionDetails: (details as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      resolvedById: userId,
    },
  });

  // Update row status
  let newStatus: ImportRowStatus = ImportRowStatus.RESOLVED;
  if (resolution === AnomalyResolution.EXCLUDE_ROW) {
    newStatus = ImportRowStatus.EXCLUDED;
  }

  await prisma.importRow.update({
    where: { id: rowId },
    data: { status: newStatus },
  });

  // Update job report stats
  await updateReportStats(jobId);

  // Check if all rows are resolved
  const pendingRows = await prisma.importRow.count({
    where: {
      importJobId: jobId,
      status: ImportRowStatus.PENDING,
    },
  });

  if (pendingRows === 0) {
    await prisma.importJob.update({
      where: { id: jobId },
      data: { status: ImportJobStatus.READY },
    });
  }

  return { rowId, status: newStatus };
}

/**
 * Updates stats in the generated ImportReport.
 */
async function updateReportStats(jobId: string) {
  const rows = await prisma.importRow.findMany({
    where: { importJobId: jobId },
    include: { decisions: true },
  });

  const totalRows = rows.length;
  const cleanRows = rows.filter((r: ImportRow & { decisions: ImportDecision | null }) => r.status === ImportRowStatus.CLEAN).length;
  const resolvedCount = rows.filter((r: ImportRow & { decisions: ImportDecision | null }) => r.status === ImportRowStatus.RESOLVED).length;
  const excludedCount = rows.filter((r: ImportRow & { decisions: ImportDecision | null }) => r.status === ImportRowStatus.EXCLUDED).length;
  const duplicatesCount = rows.filter(
    (r: ImportRow & { decisions: ImportDecision | null }) => r.decisions?.resolution === AnomalyResolution.MARK_AS_DUPLICATE_OF
  ).length;

  const anomaliesCount = await prisma.importAnomaly.count({
    where: { importRow: { importJobId: jobId } },
  });

  await prisma.importReport.update({
    where: { importJobId: jobId },
    data: {
      totalRows,
      cleanRows,
      anomaliesCount,
      resolvedCount,
      excludedCount,
      duplicatesCount,
    },
  });
}

/**
 * Commits staging rows into real Expense and Settlement tables.
 */
export async function commitImportJob(jobId: string, userId: string) {
  const job = await prisma.importJob.findUnique({
    where: { id: jobId },
    include: { rows: { include: { decisions: true } } },
  });

  if (!job) throw new Error("Import job not found");
  if (job.status === ImportJobStatus.COMMITTED) throw new Error("Job already committed");

  const uncommittedPending = job.rows.filter((r: ImportRow) => r.status === ImportRowStatus.PENDING);
  if (uncommittedPending.length > 0) {
    throw new Error(`Cannot commit: ${uncommittedPending.length} rows are still pending review.`);
  }

  // Atomically write staging data to real tables inside database transaction
  const resultReport = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const row of job.rows) {
      if (row.status === ImportRowStatus.EXCLUDED) {
        continue;
      }

      const decision = row.decisions;
      const raw = row.rawData as RawRowData;
      const details = decision?.decisionDetails as any || {};

      // If user chose to exclude this row during duplicate checks
      if (decision?.resolution === AnomalyResolution.EXCLUDE_ROW || decision?.resolution === AnomalyResolution.MARK_AS_DUPLICATE_OF) {
        continue;
      }

      // Merge raw row values with user-submitted manual details overrides
      const dateStr = details.date || raw.date;
      const descStr = details.description || raw.description || "Unlabelled Expense";
      const amountStr = details.amount || raw.amount;
      const currencyStr = (details.currency || raw.currency || "INR").toUpperCase();
      const paidByStr = details.paid_by || raw.paid_by;
      const splitTypeStr = (details.split_type || raw.split_type || "EQUAL").toUpperCase();
      const splitWithStr = details.split_with || raw.split_with;
      const splitDetailsStr = details.split_details || raw.split_details;
      const categoryStr = details.category || raw.category || "General";
      const notesStr = details.notes || raw.notes;

      // Parse fields
      const date = new Date(dateStr);
      const parsedAmount = new Decimal(parseFloat(amountStr.replace(/,/g, "")));
      const currency = currencyStr === "USD" ? Currency.USD : Currency.INR;
      const splitType = splitTypeStr as SplitType;

      // Resolve payer user
      const payer = await tx.user.findFirst({
        where: {
          OR: [
            { email: { equals: paidByStr.trim(), mode: "insensitive" } },
            { displayName: { equals: paidByStr.trim(), mode: "insensitive" } },
            { aliases: { some: { rawValue: { equals: paidByStr.trim(), mode: "insensitive" } } } },
          ],
        },
      });

      if (!payer) throw new Error(`Could not resolve payer "${paidByStr}" for row #${row.rowNumber}`);

      // Handle user alias registration if name mismatch resolved
      if (paidByStr.trim() !== payer.email && paidByStr.trim() !== payer.displayName) {
        const existingAlias = await tx.userAlias.findUnique({
          where: { rawValue: paidByStr.trim() },
        });
        if (!existingAlias) {
          await tx.userAlias.create({
            data: {
              rawValue: paidByStr.trim(),
              userId: payer.id,
            },
          });
        }
      }

      // Reclassify settlement check
      const isSettlement =
        decision?.resolution === AnomalyResolution.ACCEPT_SUGGESTED &&
        (details.reclassifyAsSettlement || /paid.*back|settle|refund|repay/i.test(descStr));

      if (isSettlement) {
        // Find split recipient
        const receiverStr = splitWithStr ? splitWithStr.split(/[;,]/)[0].trim() : "";
        const receiver = await tx.user.findFirst({
          where: {
            OR: [
              { email: { equals: receiverStr, mode: "insensitive" } },
              { displayName: { equals: receiverStr, mode: "insensitive" } },
              { aliases: { some: { rawValue: { equals: receiverStr, mode: "insensitive" } } } },
            ],
          },
        });

        if (!receiver) throw new Error(`Could not resolve settlement receiver "${receiverStr}" for row #${row.rowNumber}`);

        // Create settlement
        await tx.settlement.create({
          data: {
            groupId: job.groupId,
            fromUserId: payer.id,
            toUserId: receiver.id,
            amount: parsedAmount,
            date,
            notes: notesStr || descStr,
            importedFromRowId: row.id,
          },
        });
      } else {
        // Calculate FX Conversion (USD -> INR)
        let amountInr = parsedAmount;
        let fxRateToInr: Decimal | null = null;
        let fxRateDate: Date | null = null;

        if (currency === Currency.USD) {
          const rate = getMockFxRate(date);
          fxRateToInr = new Decimal(rate);
          amountInr = parsedAmount.mul(fxRateToInr);
          fxRateDate = date;
        }

        // Create Expense
        const expense = await tx.expense.create({
          data: {
            groupId: job.groupId,
            description: descStr,
            date,
            amount: parsedAmount,
            currency,
            splitType,
            amountInr,
            fxRateToInr,
            fxRateDate,
            paidById: payer.id,
            importedFromRowId: row.id,
            notes: notesStr,
          },
        });

        // Compute participant splits
        const participants = splitWithStr.split(/[;,]/).map((p: string) => p.trim()).filter(Boolean);
        const resolvedParticipants: User[] = [];
        for (const p of participants) {
          const resolvedPart = await tx.user.findFirst({
            where: {
              OR: [
                { email: { equals: p, mode: "insensitive" } },
                { displayName: { equals: p, mode: "insensitive" } },
                { aliases: { some: { rawValue: { equals: p, mode: "insensitive" } } } },
              ],
            },
          });
          if (resolvedPart) {
            resolvedParticipants.push(resolvedPart);
          }
        }

        const memberCount = resolvedParticipants.length;
        if (memberCount === 0) throw new Error(`Row #${row.rowNumber} has 0 valid split participants`);

        const splitsData: Prisma.ExpenseSplitCreateManyInput[] = [];

        if (splitType === SplitType.EQUAL) {
          const splitShare = amountInr.div(memberCount);
          resolvedParticipants.forEach((part: User) => {
            splitsData.push({
              expenseId: expense.id,
              userId: part.id,
              amount: splitShare,
            });
          });
        } else if (splitType === SplitType.PERCENTAGE && splitDetailsStr) {
          const pairs = splitDetailsStr.split(/[;,]/).map((p: string) => p.trim()).filter(Boolean);
          const percentMap: Record<string, number> = {};
          pairs.forEach((pair: string) => {
            const parts = pair.split(/\s+/);
            const val = parseFloat(parts[parts.length - 1]);
            const name = pair.substring(0, pair.lastIndexOf(parts[parts.length - 1])).trim();
            if (name && !isNaN(val)) {
              percentMap[name.toLowerCase()] = val;
            }
          });

          // Calculate normalized percent sum if sum != 100
          let sumPercent = Object.values(percentMap).reduce((a: number, b: number) => a + b, 0);
          const needsNormalize = Math.abs(sumPercent - 100) > 0.01;

          for (const part of resolvedParticipants) {
            const rawPct = percentMap[part.displayName.toLowerCase()] || percentMap[part.email.toLowerCase()] || 0;
            const pct = needsNormalize ? (rawPct / sumPercent) * 100 : rawPct;
            const splitShare = amountInr.mul(new Decimal(pct / 100));

            splitsData.push({
              expenseId: expense.id,
              userId: part.id,
              amount: splitShare,
              shareValue: new Decimal(rawPct),
            });
          }
        } else if (splitType === SplitType.SHARE && splitDetailsStr) {
          const pairs = splitDetailsStr.split(/[;,]/).map((p: string) => p.trim()).filter(Boolean);
          const shareMap: Record<string, number> = {};
          pairs.forEach((pair: string) => {
            const parts = pair.split(/\s+/);
            const val = parseFloat(parts[parts.length - 1]);
            const name = pair.substring(0, pair.lastIndexOf(parts[parts.length - 1])).trim();
            if (name && !isNaN(val)) {
              shareMap[name.toLowerCase()] = val;
            }
          });

          const totalShares = Object.values(shareMap).reduce((a: number, b: number) => a + b, 0);

          for (const part of resolvedParticipants) {
            const rawShare = shareMap[part.displayName.toLowerCase()] || shareMap[part.email.toLowerCase()] || 0;
            const splitShare = totalShares > 0 ? amountInr.mul(new Decimal(rawShare / totalShares)) : new Decimal(0);

            splitsData.push({
              expenseId: expense.id,
              userId: part.id,
              amount: splitShare,
              shareValue: new Decimal(rawShare),
            });
          }
        } else if (splitType === SplitType.UNEQUAL && splitDetailsStr) {
          const pairs = splitDetailsStr.split(/[;,]/).map((p: string) => p.trim()).filter(Boolean);
          const amountMap: Record<string, number> = {};
          pairs.forEach((pair: string) => {
            const parts = pair.split(/\s+/);
            const val = parseFloat(parts[parts.length - 1]);
            const name = pair.substring(0, pair.lastIndexOf(parts[parts.length - 1])).trim();
            if (name && !isNaN(val)) {
              amountMap[name.toLowerCase()] = val;
            }
          });

          // Check rescaling if sum does not match total amount
          let sumSplitVal = Object.values(amountMap).reduce((a: number, b: number) => a + b, 0);
          const originalTotal = parseFloat(amountStr.replace(/,/g, ""));
          const needsRescale = Math.abs(sumSplitVal - originalTotal) > 0.05;

          for (const part of resolvedParticipants) {
            const rawVal = amountMap[part.displayName.toLowerCase()] || amountMap[part.email.toLowerCase()] || 0;
            let finalValInr = new Decimal(rawVal);
            if (needsRescale && sumSplitVal > 0) {
              finalValInr = new Decimal((rawVal / sumSplitVal) * originalTotal);
            }
            // If original was USD, scale is in USD so we must multiply by FX rate to get INR
            if (currency === Currency.USD && fxRateToInr) {
              finalValInr = finalValInr.mul(fxRateToInr);
            }

            splitsData.push({
              expenseId: expense.id,
              userId: part.id,
              amount: finalValInr,
              shareValue: new Decimal(rawVal),
            });
          }
        }

        // Batch insert ExpenseSplits
        await tx.expenseSplit.createMany({
          data: splitsData,
        });
      }

      // Set row committed status
      await tx.importRow.update({
        where: { id: row.id },
        data: { status: ImportRowStatus.COMMITTED },
      });
    }

    // Set job committed status
    await tx.importJob.update({
      where: { id: jobId },
      data: {
        status: ImportJobStatus.COMMITTED,
        committedAt: new Date(),
      },
    });

    // Fetch final report
    return await tx.importReport.findUnique({
      where: { importJobId: jobId },
    });
  });

  return resultReport;
}

/**
 * Retrieves an import job details by ID.
 */
export async function getImportJobDetails(jobId: string) {
  return await prisma.importJob.findUnique({
    where: { id: jobId },
    include: {
      rows: {
        include: {
          anomalies: true,
          decisions: true,
        },
        orderBy: { rowNumber: "asc" },
      },
      report: true,
    },
  });
}
