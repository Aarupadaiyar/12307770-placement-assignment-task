"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  getMappingStatus,
  getMappingMembers,
  submitMappingDecisions,
  ApiError,
  type ParticipantMapping,
  type CsvGroupMember,
  type MappingDecision,
  type MappingAction,
} from "@/lib/api";
import {
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  XCircle,
  Loader2,
  Users,
  ArrowRight,
  Sparkles,
  HelpCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LocalDecision = {
  action: MappingAction | null;
  groupMemberId?: string;
  displayName?: string;
};

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    AUTO_MAPPED: { label: "✨ Auto-mapped", cls: "bg-green-100 text-green-800 border-green-300" },
    MAPPED:      { label: "✅ Mapped",      cls: "bg-blue-100 text-blue-800 border-blue-300" },
    IGNORED:     { label: "🚫 Ignored",     cls: "bg-gray-100 text-gray-500 border-gray-300" },
    PENDING:     { label: "⏳ Pending",     cls: "bg-amber-100 text-amber-800 border-amber-300" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-500" };
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function MappingPage() {
  const router = useRouter();
  const { groupId, jobId } = useParams<{ groupId: string; jobId: string }>();

  const [participants, setParticipants] = useState<ParticipantMapping[]>([]);
  const [members, setMembers]           = useState<CsvGroupMember[]>([]);
  const [decisions, setDecisions]       = useState<Record<string, LocalDecision>>({});
  const [loading, setLoading]           = useState(true);
  const [submitting, setSubmitting]     = useState(false);
  const [error, setError]               = useState<string | null>(null);

  // Load participants + group members in parallel
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, membersRes] = await Promise.all([
        getMappingStatus(groupId, jobId),
        getMappingMembers(groupId, jobId),
      ]);

      setParticipants(statusRes.participants);
      setMembers(membersRes.members);

      // Pre-fill decisions from any auto-mapping suggestions
      const initial: Record<string, LocalDecision> = {};
      for (const p of statusRes.participants) {
        if (p.status === "AUTO_MAPPED" && p.suggestion) {
          initial[p.csvName] = {
            action: "MAP",
            groupMemberId: p.suggestion.groupMemberId,
          };
        } else if (p.status === "IGNORED") {
          initial[p.csvName] = { action: "IGNORE" };
        } else if (p.status === "MAPPED" && p.suggestion) {
          initial[p.csvName] = {
            action: "MAP",
            groupMemberId: p.suggestion.groupMemberId,
          };
        }
      }
      setDecisions(initial);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load mapping data");
    } finally {
      setLoading(false);
    }
  }, [groupId, jobId]);

  useEffect(() => { load(); }, [load]);

  // Derived counts
  const resolvedCount = Object.values(decisions).filter((d) => d.action !== null).length;
  const totalCount    = participants.length;
  const allResolved   = resolvedCount === totalCount && totalCount > 0;
  const progressPct   = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0;

  // Decision setters
  const setMap = (csvName: string, groupMemberId: string) => {
    setDecisions((prev) => ({ ...prev, [csvName]: { action: "MAP", groupMemberId } }));
  };
  const setPlaceholder = (csvName: string) => {
    setDecisions((prev) => ({
      ...prev,
      [csvName]: { action: "CREATE_PLACEHOLDER", displayName: csvName },
    }));
  };
  const setIgnore = (csvName: string) => {
    setDecisions((prev) => ({ ...prev, [csvName]: { action: "IGNORE" } }));
  };
  const clearDecision = (csvName: string) => {
    setDecisions((prev) => ({ ...prev, [csvName]: { action: null } }));
  };

  // Submit all decisions
  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const payload: MappingDecision[] = participants.map((p) => {
        const d = decisions[p.csvName];
        if (!d || !d.action) {
          // shouldn't happen if button is disabled properly, but safety fallback
          return { csvName: p.csvName, action: "IGNORE" as MappingAction };
        }
        return {
          csvName: p.csvName,
          action: d.action,
          groupMemberId: d.groupMemberId,
          displayName: d.displayName,
        };
      });

      await submitMappingDecisions(groupId, jobId, payload);
      // Redirect to anomaly review page
      router.push(`/groups/${groupId}/import/${jobId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to submit mapping decisions");
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href={`/groups/${groupId}`}
          className="handdrawn-btn-secondary flex items-center gap-2 text-sm w-fit py-1.5 px-4"
        >
          <ArrowLeft size={14} /> ← back to group
        </Link>
      </div>

      {/* Header card */}
      <div className="handdrawn-card bg-white p-6 mb-6 notebook-margin-line pl-8 rotate-[-0.3deg]">
        <p className="text-xs text-paper-blue font-bold uppercase tracking-wider mb-0.5">
          📂 import / step 2 of 3
        </p>
        <h1 className="marker-heading text-4xl text-paper-text uppercase tracking-wide">
          [ Map Participants ]
        </h1>
        <p className="text-sm text-paper-text/60 mt-1 font-bold">
          Match each CSV name to an existing user or create a placeholder member before anomaly detection runs.
        </p>
      </div>

      {/* Progress bar */}
      <div className="handdrawn-card bg-white p-4 mb-6">
        <div className="flex justify-between text-xs font-bold text-paper-text/70 mb-2">
          <span>Progress</span>
          <span>{resolvedCount} / {totalCount} mapped</span>
        </div>
        <div className="h-3 bg-paper-muted rounded-full overflow-hidden border border-paper-text/10">
          <div
            className="h-full bg-paper-blue transition-all duration-300 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-6 text-xs text-paper-text/70 font-bold">
        <span className="flex items-center gap-1"><Sparkles size={12} className="text-green-600"/> Auto-mapped — suggestion from prior import</span>
        <span className="flex items-center gap-1"><Users size={12} className="text-blue-600"/> Map to existing user</span>
        <span className="flex items-center gap-1"><UserPlus size={12} className="text-amber-600"/> Create placeholder</span>
        <span className="flex items-center gap-1"><XCircle size={12} className="text-gray-500"/> Ignore this name</span>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 border-2 border-paper-accent bg-paper-accent/5 p-3 rounded flex items-start gap-2">
          <AlertTriangle size={16} className="text-paper-accent shrink-0 mt-0.5" />
          <p className="text-sm font-bold text-paper-accent">{error}</p>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="handdrawn-card bg-white p-12 flex flex-col items-center gap-4">
          <Loader2 size={36} className="text-paper-blue animate-spin" />
          <p className="text-sm font-bold text-paper-text/50">Loading participant names…</p>
        </div>
      ) : (
        <div className="handdrawn-card bg-white overflow-hidden mb-6">
          {/* Table header */}
          <div className="grid grid-cols-[1.5fr_1.5fr_0.5fr_2fr_auto] gap-4 px-5 py-3 border-b-2 border-dashed border-paper-text/20 bg-paper-muted/30">
            <span className="text-xs font-bold uppercase tracking-wider text-paper-text/60">CSV Name</span>
            <span className="text-xs font-bold uppercase tracking-wider text-paper-text/60">Suggestion</span>
            <span className="text-xs font-bold uppercase tracking-wider text-paper-text/60">Confidence</span>
            <span className="text-xs font-bold uppercase tracking-wider text-paper-text/60">User Decision</span>
            <span className="text-xs font-bold uppercase tracking-wider text-paper-text/60 text-right">Status</span>
          </div>

          {/* Rows */}
          {participants.map((p) => {
            const d = decisions[p.csvName];
            const hasDecision = d?.action != null;

            // Determine displayed status for badge
            let displayStatus: string = "PENDING";
            if (d?.action === "MAP") displayStatus = "MAPPED";
            else if (d?.action === "CREATE_PLACEHOLDER") displayStatus = "MAPPED";
            else if (d?.action === "IGNORE") displayStatus = "IGNORED";

            // Find the currently selected member name (if mapped)
            const selectedMember = d?.groupMemberId
              ? members.find((m) => m.id === d.groupMemberId)
              : null;

            return (
              <div
                key={p.csvName}
                className={`grid grid-cols-[1.5fr_1.5fr_0.5fr_2fr_auto] gap-4 items-center px-5 py-4 border-b border-dashed border-paper-text/10
                  ${hasDecision ? "bg-green-50/30" : "bg-white"}
                  transition-colors duration-150`}
              >
                {/* CSV Name */}
                <div>
                  <p className="font-bold text-paper-text font-mono text-sm">&ldquo;{p.csvName}&rdquo;</p>
                </div>

                {/* Suggestion */}
                <div>
                  {p.suggestion ? (
                    <p className="font-bold text-paper-text text-sm flex items-center gap-1">
                      {p.suggestion.confidence >= 0.9 && <Sparkles size={12} className="text-green-500" />}
                      {p.suggestion.displayName}
                    </p>
                  ) : (
                    <span className="text-xs text-paper-text/40 italic">—</span>
                  )}
                </div>

                {/* Confidence */}
                <div>
                  {p.suggestion ? (
                    <span className="text-xs font-bold text-paper-text/70">{Math.round(p.suggestion.confidence * 100)}%</span>
                  ) : (
                    <span className="text-xs text-paper-text/40 italic">—</span>
                  )}
                </div>

                {/* Dropdown / action area */}
                <div className="flex items-center gap-2 flex-wrap">
                  {d?.action === "CREATE_PLACEHOLDER" ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-amber-100 border border-amber-300 text-amber-800 px-2 py-1 rounded-full font-bold flex items-center gap-1">
                        <UserPlus size={11} /> Placeholder: &ldquo;{p.csvName}&rdquo;
                      </span>
                      <button
                        onClick={() => clearDecision(p.csvName)}
                        className="text-xs text-paper-text/40 hover:text-paper-accent underline"
                      >
                        change
                      </button>
                    </div>
                  ) : d?.action === "IGNORE" ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-gray-100 border border-gray-300 text-gray-500 px-2 py-1 rounded-full font-bold flex items-center gap-1">
                        <XCircle size={11} /> Ignored
                      </span>
                      <button
                        onClick={() => clearDecision(p.csvName)}
                        className="text-xs text-paper-text/40 hover:text-paper-accent underline"
                      >
                        change
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Member dropdown */}
                      <select
                        id={`mapping-select-${p.csvName.replace(/\s+/g, "-")}`}
                        value={d?.groupMemberId ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) setMap(p.csvName, val);
                          else clearDecision(p.csvName);
                        }}
                        className="text-sm border-2 border-dashed border-paper-text/30 rounded px-2 py-1.5 bg-white text-paper-text
                          focus:outline-none focus:border-paper-blue min-w-[180px]"
                      >
                        {members.length === 0 ? (
                          <option value="" disabled>No group members found</option>
                        ) : (
                          <option value="">— Select user —</option>
                        )}
                        {members.map((m) => {
                          const dateStr = m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : '';
                          const leftStr = m.leftAt ? ` (Left: ${new Date(m.leftAt).toLocaleDateString()})` : '';
                          return (
                            <option key={m.id} value={m.id}>
                              {m.displayName}
                              {m.user?.email ? ` (${m.user.email})` : ""}
                              {m.isPlaceholder ? " [placeholder]" : ""}
                              {dateStr ? ` [Joined: ${dateStr}${leftStr}]` : ""}
                            </option>
                          );
                        })}
                      </select>

                      {/* OR separator */}
                      <span className="text-xs text-paper-text/30 font-bold">or</span>

                      {/* Create placeholder button */}
                      <button
                        id={`placeholder-btn-${p.csvName.replace(/\s+/g, "-")}`}
                        onClick={() => setPlaceholder(p.csvName)}
                        className="text-xs border border-dashed border-amber-400 text-amber-700 px-2 py-1.5 rounded
                          hover:bg-amber-50 font-bold flex items-center gap-1 transition-colors"
                      >
                        <UserPlus size={12} /> New placeholder
                      </button>

                      {/* Ignore button */}
                      <button
                        id={`ignore-btn-${p.csvName.replace(/\s+/g, "-")}`}
                        onClick={() => setIgnore(p.csvName)}
                        className="text-xs border border-dashed border-gray-300 text-gray-400 px-2 py-1.5 rounded
                          hover:bg-gray-50 font-bold flex items-center gap-1 transition-colors"
                      >
                        <XCircle size={12} /> Ignore
                      </button>
                    </>
                  )}
                </div>

                {/* Status badge */}
                <div className="flex justify-end">
                  <StatusBadge status={displayStatus} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ignore-as-payer notice */}
      {Object.values(decisions).some((d) => d.action === "IGNORE") && (
        <div
          className="postit-card p-4 mb-6 text-sm text-paper-text"
          style={{ background: "#fff3cd" }}
        >
          <p className="marker-heading text-base mb-1">⚠️ Ignored names</p>
          <p className="text-paper-text/70 font-bold text-xs">
            Any row where an ignored name is the <strong>payer</strong> will be flagged as an error during anomaly review.
            Rows where they only appear in &ldquo;split with&rdquo; will silently exclude them from the split calculation.
          </p>
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href={`/groups/${groupId}`}
          className="handdrawn-btn-secondary flex items-center gap-2 text-sm py-2 px-5"
        >
          <ArrowLeft size={14} /> Cancel import
        </Link>

        <div className="flex items-center gap-3">
          {!allResolved && (
            <p className="text-xs text-paper-text/50 font-bold">
              {totalCount - resolvedCount} name{totalCount - resolvedCount !== 1 ? "s" : ""} still pending
            </p>
          )}
          <button
            id="save-mapping-btn"
            onClick={handleSubmit}
            disabled={!allResolved || submitting || loading}
            className={`handdrawn-btn flex items-center gap-2 py-3 px-8 text-base
              ${allResolved && !submitting ? "bg-paper-accent text-white" : "opacity-40 cursor-not-allowed"}`}
            style={{ borderRadius: "120px 20px 100px 20px / 20px 100px 20px 120px" }}
          >
            {submitting ? (
              <><Loader2 size={16} className="animate-spin" /> Saving…</>
            ) : (
              <>Save & Continue <ArrowRight size={16} /></>
            )}
          </button>
        </div>
      </div>

      {submitting && (
        <p className="text-center text-xs text-paper-text/50 mt-3 font-bold animate-pulse">
          Saving mappings and running anomaly detection…
        </p>
      )}
    </main>
  );
}
