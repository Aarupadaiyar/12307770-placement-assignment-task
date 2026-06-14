"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getImportJob, ImportJob, ApiError } from "@/lib/api";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  BarChart3,
  FileCheck2,
  ExternalLink,
} from "lucide-react";

function Stat({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number | string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="handdrawn-card bg-white p-5 text-center flex flex-col items-center gap-1">
      <span className={`${color} mb-1`}>{icon}</span>
      <p className={`marker-heading text-4xl ${color}`}>{value}</p>
      <p className="text-xs font-bold text-paper-text/50">{label}</p>
    </div>
  );
}

export default function ImportSummaryPage() {
  const { groupId, jobId } = useParams<{ groupId: string; jobId: string }>();
  const [job, setJob] = useState<ImportJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getImportJob(groupId, jobId)
      .then((res) => setJob(res.job))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load import summary."))
      .finally(() => setLoading(false));
  }, [groupId, jobId]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="marker-heading text-xl text-paper-text/60 animate-bounce">
          ✏️ loading import summary...
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

  const report = job.report;
  const committedRows = (job.rows ?? []).filter((r) => r.status === "COMMITTED");
  const excludedRows = (job.rows ?? []).filter((r) => r.status === "EXCLUDED");
  const isCommitted = job.status === "COMMITTED";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-5 flex items-center gap-3 flex-wrap">
        <Link
          href={`/groups/${groupId}`}
          className="handdrawn-btn-secondary text-sm py-1.5 px-4 flex items-center gap-2"
        >
          <ArrowLeft size={14} /> Group
        </Link>
        <span className="text-paper-text/30 font-bold">›</span>
        <Link
          href={`/groups/${groupId}/import/${jobId}`}
          className="handdrawn-btn-secondary text-sm py-1.5 px-4"
        >
          Review
        </Link>
        <span className="text-paper-text/30 font-bold">›</span>
        <span className="text-xs font-bold text-paper-text/60">Summary</span>
      </div>

      {/* Header */}
      <div className="handdrawn-card bg-white p-6 mb-6 notebook-margin-line pl-8 rotate-[-0.3deg]">
        <div className="flex items-start gap-3">
          {isCommitted ? (
            <CheckCircle2 size={40} className="text-green-500 shrink-0 mt-1" strokeWidth={1.5} />
          ) : (
            <BarChart3 size={40} className="text-paper-blue shrink-0 mt-1" strokeWidth={1.5} />
          )}
          <div>
            <p className="text-xs text-paper-blue font-bold uppercase tracking-wider">
              📊 import / summary
            </p>
            <h1 className="marker-heading text-3xl text-paper-text mt-0.5">
              [ {job.fileName} ]
            </h1>
            <p className="text-sm font-bold text-paper-text/60 mt-1">
              {isCommitted
                ? `✅ Successfully committed on ${new Date(job.committedAt!).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
                : `⏳ Status: ${job.status}`}
            </p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      {report && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <Stat
            label="Total Rows"
            value={report.totalRows}
            color="text-paper-text"
            icon={<FileCheck2 size={22} strokeWidth={1.5} />}
          />
          <Stat
            label="Clean Rows"
            value={report.cleanRows}
            color="text-green-600"
            icon={<CheckCircle2 size={22} strokeWidth={1.5} />}
          />
          <Stat
            label="Anomalies Found"
            value={report.anomaliesCount}
            color="text-amber-600"
            icon={<BarChart3 size={22} strokeWidth={1.5} />}
          />
          <Stat
            label="Resolved"
            value={report.resolvedCount}
            color="text-blue-600"
            icon={<CheckCircle2 size={22} strokeWidth={1.5} />}
          />
          <Stat
            label="Excluded"
            value={report.excludedCount}
            color="text-gray-500"
            icon={<XCircle size={22} strokeWidth={1.5} />}
          />
          <Stat
            label="Duplicates Flagged"
            value={report.duplicatesCount}
            color="text-orange-500"
            icon={<BarChart3 size={22} strokeWidth={1.5} />}
          />
        </div>
      )}

      {/* Committed rows table */}
      {committedRows.length > 0 && (
        <div className="handdrawn-card bg-white p-4 mb-5">
          <p className="marker-heading text-lg text-green-700 mb-3">
            ✅ Committed Rows ({committedRows.length})
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-paper-text">
              <thead>
                <tr className="border-b-2 border-dashed border-paper-border">
                  <th className="text-left py-1.5 px-2 font-bold text-paper-text/50">#</th>
                  <th className="text-left py-1.5 px-2 font-bold text-paper-text/50">Date</th>
                  <th className="text-left py-1.5 px-2 font-bold text-paper-text/50">Description</th>
                  <th className="text-right py-1.5 px-2 font-bold text-paper-text/50">Amount</th>
                  <th className="text-left py-1.5 px-2 font-bold text-paper-text/50">Paid By</th>
                </tr>
              </thead>
              <tbody>
                {committedRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-paper-border/30 hover:bg-paper-muted/30 transition-colors"
                  >
                    <td className="py-1.5 px-2 font-mono text-paper-text/40">
                      {row.rowNumber}
                    </td>
                    <td className="py-1.5 px-2">{row.rawData.date}</td>
                    <td className="py-1.5 px-2 max-w-[180px] truncate" title={row.rawData.description}>
                      {row.rawData.description || "—"}
                    </td>
                    <td className="py-1.5 px-2 text-right font-bold">
                      {row.rawData.amount} {row.rawData.currency}
                    </td>
                    <td className="py-1.5 px-2">{row.rawData.paid_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Excluded rows table */}
      {excludedRows.length > 0 && (
        <div className="handdrawn-card bg-white p-4 mb-5 opacity-70">
          <p className="marker-heading text-lg text-gray-500 mb-3">
            🚫 Excluded Rows ({excludedRows.length})
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-paper-text">
              <thead>
                <tr className="border-b-2 border-dashed border-paper-border">
                  <th className="text-left py-1.5 px-2 font-bold text-paper-text/50">#</th>
                  <th className="text-left py-1.5 px-2 font-bold text-paper-text/50">Description</th>
                  <th className="text-left py-1.5 px-2 font-bold text-paper-text/50">Reason</th>
                </tr>
              </thead>
              <tbody>
                {excludedRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-paper-border/30 line-through text-gray-400"
                  >
                    <td className="py-1.5 px-2 font-mono">{row.rowNumber}</td>
                    <td className="py-1.5 px-2">{row.rawData.description || "—"}</td>
                    <td className="py-1.5 px-2">
                      {row.decisions[0]?.resolution ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        <Link
          href={`/groups/${groupId}`}
          className="handdrawn-btn flex-1 text-center text-sm py-2.5 flex items-center justify-center gap-2"
          style={{ borderRadius: "120px 20px 100px 20px / 20px 100px 20px 120px" }}
        >
          <ArrowLeft size={14} /> Back to Group
        </Link>
        <Link
          href={`/groups/${groupId}/import`}
          className="handdrawn-btn-secondary flex-1 text-center text-sm py-2.5 flex items-center justify-center gap-2"
          style={{ borderRadius: "20px 120px 20px 100px / 100px 20px 120px 20px" }}
        >
          <ExternalLink size={14} /> Import Another CSV
        </Link>
      </div>
    </main>
  );
}
