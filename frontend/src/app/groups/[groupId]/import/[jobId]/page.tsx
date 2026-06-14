"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  getImportJob,
  resolveImportRow,
  commitImport,
  ImportJob,
  ImportRow,
  AnomalyResolution,
  ApiError,
} from "@/lib/api";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  FileCheck2,
  Trash2,
  Copy,
  Pencil,
} from "lucide-react";

// ─── Severity badge ─────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { bg: string; label: string; icon: React.ReactNode }> = {
    ERROR: { bg: "bg-red-100 border-red-400 text-red-700", label: "ERROR", icon: <XCircle size={12} /> },
    WARNING: { bg: "bg-amber-100 border-amber-400 text-amber-700", label: "WARN", icon: <AlertTriangle size={12} /> },
    INFO: { bg: "bg-blue-100 border-blue-400 text-blue-700", label: "INFO", icon: <Info size={12} /> },
  };
  const s = map[severity] ?? map["INFO"];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold border rounded px-1.5 py-0.5 ${s.bg}`}>
      {s.icon} {s.label}
    </span>
  );
}

// ─── Row status badge ────────────────────────────────────────────────────────

function RowStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-50 border-amber-400 text-amber-700",
    CLEAN: "bg-green-50 border-green-500 text-green-700",
    RESOLVED: "bg-blue-50 border-blue-400 text-blue-700",
    EXCLUDED: "bg-gray-100 border-gray-400 text-gray-600",
    COMMITTED: "bg-purple-50 border-purple-400 text-purple-700",
  };
  const emoji: Record<string, string> = {
    PENDING: "⏳",
    CLEAN: "✅",
    RESOLVED: "🔵",
    EXCLUDED: "🚫",
    COMMITTED: "💜",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold border rounded px-1.5 py-0.5 ${map[status] ?? "bg-gray-100 text-gray-600"}`}
    >
      {emoji[status] ?? "?"} {status}
    </span>
  );
}

// ─── Resolution picker ───────────────────────────────────────────────────────

const RESOLUTION_OPTIONS: { value: AnomalyResolution; label: string; description: string }[] = [
  { value: "ACCEPT_AS_IS", label: "Accept As-Is", description: "Import this row without any changes." },
  { value: "ACCEPT_SUGGESTED", label: "Accept Suggestion", description: "Apply the system's suggested correction." },
  { value: "OVERRIDE_WITH_CORRECTION", label: "Override with Correction", description: "Manually provide corrected values." },
  { value: "EXCLUDE_ROW", label: "Exclude Row", description: "Skip this row — it won't be imported." },
  { value: "MARK_AS_DUPLICATE_OF", label: "Mark as Duplicate", description: "Flag this as a duplicate of another row." },
  { value: "IGNORE_WARNING", label: "Ignore Warning", description: "Acknowledge the warning and continue." },
];

interface DecisionState {
  resolution: AnomalyResolution;
  overrideValues: Record<string, string>;
  duplicateOfRow?: string;
}

// ─── Single anomaly row card ─────────────────────────────────────────────────

function AnomalyRowCard({
  row,
  groupId,
  jobId,
  isAdmin,
  onResolved,
}: {
  row: ImportRow;
  groupId: string;
  jobId: string;
  isAdmin: boolean;
  onResolved: (rowId: string, status: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<DecisionState>({
    resolution: "ACCEPT_AS_IS",
    overrideValues: {},
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const hasAnomalies = row.anomalies.length > 0;
  const hasDecision = row.decisions.length > 0;
  const currentDecision = row.decisions[0];

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const details: Record<string, unknown> = {};
      if (decision.resolution === "OVERRIDE_WITH_CORRECTION") {
        Object.assign(details, decision.overrideValues);
      }
      if (decision.resolution === "MARK_AS_DUPLICATE_OF" && decision.duplicateOfRow) {
        details.duplicateOfRow = decision.duplicateOfRow;
      }
      const res = await resolveImportRow(groupId, jobId, row.id, decision.resolution, details);
      onResolved(row.id, res.status);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Failed to submit decision.");
    } finally {
      setSubmitting(false);
    }
  };

  const rawFields = Object.entries(row.rawData);
  const isResolved = ["RESOLVED", "EXCLUDED", "COMMITTED", "CLEAN"].includes(row.status);

  return (
    <div
      className={`handdrawn-card bg-white transition-all duration-150 ${
        row.status === "PENDING"
          ? "border-amber-400 hover:border-amber-500"
          : row.status === "CLEAN"
          ? "border-green-400"
          : row.status === "EXCLUDED"
          ? "opacity-60 border-gray-300"
          : "border-blue-300"
      }`}
    >
      {/* Row header */}
      <button
        className="w-full flex items-start justify-between gap-4 p-4 text-left"
        onClick={() => setOpen((v) => !v)}
        id={`row-toggle-${row.id}`}
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span className="marker-heading text-2xl text-paper-text/30 shrink-0 w-8 text-right">
            #{row.rowNumber}
          </span>
          <div className="min-w-0">
            <p className="font-bold text-paper-text truncate text-sm">
              {row.rawData.description || "(no description)"}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <RowStatusBadge status={row.status} />
              {row.anomalies.map((a) => (
                <SeverityBadge key={a.id} severity={a.severity} />
              ))}
              <span className="text-xs text-paper-text/50 font-bold">
                {row.rawData.date} · {row.rawData.amount} {row.rawData.currency}
              </span>
            </div>
          </div>
        </div>
        <div className="shrink-0 text-paper-text/40 pt-0.5">
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="px-4 pb-5 space-y-4 border-t-2 border-dashed border-paper-border/50 pt-4">
          {/* Raw data table */}
          <div>
            <p className="text-xs font-bold text-paper-text/50 uppercase tracking-wider mb-2">
              📄 Raw CSV Data
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {rawFields.map(([key, val]) => (
                <div key={key} className="bg-paper-muted/40 rounded px-2 py-1.5">
                  <p className="text-[9px] font-bold uppercase text-paper-text/40 tracking-wider">{key}</p>
                  <p className="text-xs font-bold text-paper-text truncate" title={val}>
                    {val || <span className="text-paper-text/30 italic">empty</span>}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Anomalies */}
          {hasAnomalies && (
            <div>
              <p className="text-xs font-bold text-paper-text/50 uppercase tracking-wider mb-2">
                ⚠️ Detected Anomalies ({row.anomalies.length})
              </p>
              <div className="space-y-2">
                {row.anomalies.map((anomaly) => (
                  <div
                    key={anomaly.id}
                    className={`rounded border-l-4 px-3 py-2 text-sm ${
                      anomaly.severity === "ERROR"
                        ? "border-red-500 bg-red-50"
                        : anomaly.severity === "WARNING"
                        ? "border-amber-400 bg-amber-50"
                        : "border-blue-400 bg-blue-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <SeverityBadge severity={anomaly.severity} />
                      <span className="text-xs font-bold text-paper-text/60 font-mono">
                        {anomaly.anomalyType}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-paper-text/80">{anomaly.description}</p>
                    {anomaly.suggestedAction && (
                      <p className="text-xs text-paper-text/50 mt-0.5 italic">
                        💡 {anomaly.suggestedAction}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Previous decision (if any) */}
          {hasDecision && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3">
              <p className="text-xs font-bold text-blue-600 mb-1">✅ Decision recorded</p>
              <p className="text-xs text-blue-700 font-bold">{currentDecision.resolution}</p>
            </div>
          )}

          {/* Decision form — only for pending rows with anomalies, and if admin */}
          {isAdmin && !isResolved && hasAnomalies && (
            <div className="border-t-2 border-dashed border-paper-border/40 pt-4">
              <p className="text-xs font-bold text-paper-text/50 uppercase tracking-wider mb-3">
                🖊️ Your Decision
              </p>

              {/* Resolution picker */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                {RESOLUTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    id={`resolution-${row.id}-${opt.value}`}
                    onClick={() => setDecision((d) => ({ ...d, resolution: opt.value }))}
                    className={`text-left px-3 py-2 rounded border-2 transition-all text-xs font-bold ${
                      decision.resolution === opt.value
                        ? "border-paper-blue bg-paper-blue/10 text-paper-blue"
                        : "border-paper-border bg-white text-paper-text hover:border-paper-blue/50"
                    }`}
                  >
                    <p className="font-bold">{opt.label}</p>
                    <p className="text-paper-text/50 font-normal mt-0.5">{opt.description}</p>
                  </button>
                ))}
              </div>

              {/* Override fields */}
              {decision.resolution === "OVERRIDE_WITH_CORRECTION" && (
                <div className="mb-4 space-y-2">
                  <p className="text-xs font-bold text-paper-text/50 mb-2">
                    ✏️ Enter corrected values (leave blank to keep original)
                  </p>
                  {["date", "amount", "currency", "paid_by", "description"].map((field) => (
                    <div key={field} className="flex items-center gap-2">
                      <label className="text-xs w-24 font-bold text-paper-text/60 shrink-0">
                        {field}
                      </label>
                      <input
                        id={`override-${row.id}-${field}`}
                        placeholder={row.rawData[field] || ""}
                        value={decision.overrideValues[field] ?? ""}
                        onChange={(e) =>
                          setDecision((d) => ({
                            ...d,
                            overrideValues: { ...d.overrideValues, [field]: e.target.value },
                          }))
                        }
                        className="flex-1 text-xs"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Duplicate of row */}
              {decision.resolution === "MARK_AS_DUPLICATE_OF" && (
                <div className="mb-4">
                  <label className="text-xs font-bold text-paper-text/60 block mb-1">
                    Duplicate of row #
                  </label>
                  <input
                    id={`dup-row-${row.id}`}
                    type="number"
                    placeholder="Enter row number..."
                    value={decision.duplicateOfRow ?? ""}
                    onChange={(e) =>
                      setDecision((d) => ({ ...d, duplicateOfRow: e.target.value }))
                    }
                    className="w-32 text-xs"
                  />
                </div>
              )}

              {submitError && (
                <p className="text-xs text-paper-accent font-bold mb-2">⚠️ {submitError}</p>
              )}

              <button
                id={`submit-decision-${row.id}`}
                onClick={handleSubmit}
                disabled={submitting}
                className="handdrawn-btn bg-paper-blue text-white text-sm py-2 px-5 flex items-center gap-2"
                style={{ borderRadius: "100px 15px 90px 15px / 15px 90px 15px 100px" }}
              >
                {submitting ? (
                  <><Loader2 size={14} className="animate-spin" /> Saving...</>
                ) : (
                  <><FileCheck2 size={14} /> Submit Decision</>
                )}
              </button>
            </div>
          )}

          {/* Clean row: no action needed */}
          {row.status === "CLEAN" && (
            <div className="flex items-center gap-2 text-green-600 text-sm font-bold">
              <CheckCircle2 size={16} />
              This row has no anomalies and will be imported automatically.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function ImportReviewPage() {
  const router = useRouter();
  const { groupId, jobId } = useParams<{ groupId: string; jobId: string }>();

  const [job, setJob] = useState<ImportJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "CLEAN" | "RESOLVED" | "EXCLUDED">("ALL");
  const [isAdmin] = useState(true); // TODO: wire real role from AuthContext

  const fetchJob = useCallback(async () => {
    try {
      const res = await getImportJob(groupId, jobId);
      setJob(res.job);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load import job.");
    } finally {
      setLoading(false);
    }
  }, [groupId, jobId]);

  useEffect(() => { fetchJob(); }, [fetchJob]);

  // Update a single row's status in local state without full refetch
  const handleResolved = (rowId: string, newStatus: string) => {
    setJob((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.map((r) =>
          r.id === rowId
            ? { ...r, status: newStatus as ImportRow["status"], decisions: [...r.decisions] }
            : r
        ),
      };
    });
  };

  const handleCommit = async () => {
    if (!job) return;
    setCommitting(true);
    setCommitError(null);
    try {
      await commitImport(groupId, jobId);
      router.push(`/groups/${groupId}/import/${jobId}/summary`);
    } catch (err) {
      setCommitError(err instanceof ApiError ? err.message : "Commit failed.");
      setCommitting(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="marker-heading text-xl text-paper-text/60 animate-bounce">
          ✏️ loading import review...
        </p>
      </main>
    );
  }

  if (error || !job) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="handdrawn-card p-6 bg-red-50 border-red-400">
          <p className="marker-heading text-xl text-paper-accent">⚠️ {error ?? "Job not found"}</p>
          <Link href={`/groups/${groupId}`} className="handdrawn-btn mt-4 text-sm inline-block">
            ← Back to group
          </Link>
        </div>
      </main>
    );
  }

  // Guard: job is waiting for member mapping before anomaly detection can run
  if (job.status === "AWAITING_MAPPING") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="handdrawn-card bg-white p-6 mb-4 border-amber-400">
          <p className="marker-heading text-2xl text-amber-700 mb-2">⏳ Mapping Required</p>
          <p className="text-sm font-bold text-paper-text/70 mb-4">
            This import job cannot be reviewed yet. You must first map all CSV participant names
            to application users (or create placeholder members) before anomaly detection runs.
          </p>
          <Link
            href={`/groups/${groupId}/import/${jobId}/mapping`}
            className="handdrawn-btn bg-paper-accent text-white text-sm inline-flex items-center gap-2"
            style={{ borderRadius: "120px 20px 100px 20px / 20px 100px 20px 120px" }}
          >
            → Go to Member Mapping Screen
          </Link>
        </div>
      </main>
    );
  }

  const report = job.report;
  const pendingCount = job.rows.filter((r) => r.status === "PENDING").length;
  const allResolved = pendingCount === 0;
  const canCommit = allResolved && job.status !== "COMMITTED";

  const filteredRows = filter === "ALL"
    ? job.rows
    : job.rows.filter((r) => r.status === filter);

  const statusCounts = {
    ALL: job.rows.length,
    PENDING: job.rows.filter((r) => r.status === "PENDING").length,
    CLEAN: job.rows.filter((r) => r.status === "CLEAN").length,
    RESOLVED: job.rows.filter((r) => r.status === "RESOLVED").length,
    EXCLUDED: job.rows.filter((r) => r.status === "EXCLUDED").length,
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-3">
        <Link
          href={`/groups/${groupId}`}
          className="handdrawn-btn-secondary text-sm py-1.5 px-4 flex items-center gap-2"
        >
          <ArrowLeft size={14} /> Group
        </Link>
        <span className="text-paper-text/30 font-bold">›</span>
        <Link
          href={`/groups/${groupId}/import`}
          className="handdrawn-btn-secondary text-sm py-1.5 px-4"
        >
          Upload
        </Link>
        <span className="text-paper-text/30 font-bold">›</span>
        <span className="text-xs font-bold text-paper-text/60">Review</span>
      </div>

      {/* Job header */}
      <div className="handdrawn-card bg-white p-5 mb-5 notebook-margin-line pl-8 rotate-[-0.3deg]">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <p className="text-xs text-paper-blue font-bold uppercase tracking-wider">
              📋 import / review
            </p>
            <h1 className="marker-heading text-3xl text-paper-text mt-0.5">
              [ {job.fileName} ]
            </h1>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span
                className={`text-[10px] font-bold border rounded px-1.5 py-0.5 ${
                  job.status === "COMMITTED"
                    ? "bg-purple-50 border-purple-400 text-purple-700"
                    : job.status === "READY"
                    ? "bg-green-50 border-green-500 text-green-700"
                    : job.status === "IN_REVIEW"
                    ? "bg-amber-50 border-amber-400 text-amber-700"
                    : "bg-gray-100 border-gray-400 text-gray-600"
                }`}
              >
                {job.status}
              </span>
              <span className="text-xs text-paper-text/50 font-bold">
                {job.totalRows} rows · {report?.anomaliesCount ?? 0} anomalies
              </span>
            </div>
          </div>
          <button
            onClick={fetchJob}
            className="handdrawn-btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 self-start"
            id="refresh-job-btn"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Total Rows", value: report.totalRows, color: "text-paper-text" },
            { label: "Clean", value: report.cleanRows, color: "text-green-600" },
            { label: "Anomalies", value: report.anomaliesCount, color: "text-amber-600" },
            { label: "Excluded", value: report.excludedCount, color: "text-gray-500" },
          ].map((s) => (
            <div key={s.label} className="handdrawn-card bg-white p-3 text-center">
              <p className={`marker-heading text-3xl ${s.color}`}>{s.value}</p>
              <p className="text-xs font-bold text-paper-text/50 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Pending notice */}
      {pendingCount > 0 && (
        <div className="postit-card p-4 mb-5 text-sm font-bold text-paper-text">
          ⏳ <strong>{pendingCount} row{pendingCount > 1 ? "s" : ""}</strong> still need{pendingCount === 1 ? "s" : ""} your decision before you can commit.
        </div>
      )}

      {/* Commit bar */}
      {canCommit && (
        <div className="handdrawn-card bg-green-50 border-green-400 p-4 mb-5 flex items-center justify-between gap-4">
          <div>
            <p className="marker-heading text-lg text-green-700">✅ All rows resolved!</p>
            <p className="text-xs font-bold text-green-600 mt-0.5">
              Ready to commit {job.rows.filter((r) => !["EXCLUDED"].includes(r.status)).length} rows into the expense ledger.
            </p>
          </div>
          <button
            id="commit-import-btn"
            onClick={handleCommit}
            disabled={committing}
            className="handdrawn-btn bg-green-600 text-white text-sm py-2.5 px-6 flex items-center gap-2 shrink-0"
            style={{ borderRadius: "100px 15px 90px 15px / 15px 90px 15px 100px" }}
          >
            {committing ? (
              <><Loader2 size={14} className="animate-spin" /> Committing...</>
            ) : (
              <><CheckCircle2 size={14} /> Commit Import</>
            )}
          </button>
        </div>
      )}

      {commitError && (
        <div className="border-2 border-paper-accent bg-paper-accent/5 p-3 rounded mb-5 flex items-start gap-2">
          <AlertTriangle size={16} className="text-paper-accent shrink-0 mt-0.5" />
          <p className="text-sm font-bold text-paper-accent">{commitError}</p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(Object.keys(statusCounts) as (keyof typeof statusCounts)[]).map((f) => (
          <button
            key={f}
            id={`filter-${f}`}
            onClick={() => setFilter(f)}
            className={`text-xs font-bold px-3 py-1.5 rounded border-2 transition-all ${
              filter === f
                ? "border-paper-blue bg-paper-blue/10 text-paper-blue"
                : "border-paper-border bg-white text-paper-text/60 hover:border-paper-blue/40"
            }`}
          >
            {f} ({statusCounts[f]})
          </button>
        ))}
      </div>

      {/* Row list */}
      <div className="space-y-3">
        {filteredRows.length === 0 ? (
          <div className="handdrawn-card bg-white p-8 text-center">
            <p className="marker-heading text-xl text-paper-text/40">No rows match this filter.</p>
          </div>
        ) : (
          filteredRows.map((row) => (
            <AnomalyRowCard
              key={row.id}
              row={row}
              groupId={groupId}
              jobId={jobId}
              isAdmin={isAdmin}
              onResolved={handleResolved}
            />
          ))
        )}
      </div>

      {/* Already committed */}
      {job.status === "COMMITTED" && (
        <div className="mt-6 handdrawn-card bg-purple-50 border-purple-400 p-4 text-center">
          <p className="marker-heading text-xl text-purple-700">💜 Import committed!</p>
          <p className="text-sm font-bold text-purple-600 mt-1">
            All approved rows have been written to the expense ledger.
          </p>
          <Link
            href={`/groups/${groupId}/import/${jobId}/summary`}
            className="mt-4 handdrawn-btn bg-purple-600 text-white text-sm inline-block"
            style={{ borderRadius: "100px 15px 90px 15px / 15px 90px 15px 100px" }}
          >
            View Import Summary →
          </Link>
        </div>
      )}
    </main>
  );
}
