"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { listGroups, GroupSummary, ApiError } from "@/lib/api";
import { PlusCircle, ArrowRight, FolderOpen } from "lucide-react";

export default function GroupsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    listGroups()
      .then((res) => setGroups(res.groups))
      .catch((err) => {
        if (err instanceof ApiError) setError(err.message);
        else setError("Failed to load groups");
      })
      .finally(() => setFetchLoading(false));
  }, [user]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="marker-heading text-xl text-paper-text/60 animate-bounce">
          ✏️ loading group clusters...
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {/* Header board */}
      <div className="handdrawn-card p-6 bg-white rotate-[-0.5deg] mb-8 relative notebook-margin-line pl-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs text-paper-blue font-bold uppercase tracking-wider mb-0.5">
              📁 directory / groups
            </p>
            <h1 className="marker-heading text-4xl text-paper-text uppercase tracking-wider">
              [ Group Registry ]
            </h1>
            <p className="text-sm text-paper-text/70 mt-1">
              Active ledger folders you belong to.
            </p>
          </div>
          <Link
            href="/groups/new"
            className="handdrawn-btn flex items-center justify-center gap-1.5 bg-paper-accent text-white py-2 text-sm shrink-0"
            style={{ borderRadius: "120px 20px 100px 20px / 20px 100px 20px 120px" }}
          >
            <PlusCircle size={16} strokeWidth={2.5} /> NEW_GROUP
          </Link>
        </div>
      </div>

      {/* Main Lists */}
      {fetchLoading ? (
        <div className="handdrawn-card p-8 text-center bg-white">
          <p className="marker-heading text-lg text-paper-text/60 animate-pulse">
            ✍️ indexing folders...
          </p>
        </div>
      ) : error ? (
        <div className="border-2 border-paper-accent bg-paper-accent/5 p-4 rounded rotate-[-1deg]">
          <p className="font-bold text-paper-accent text-sm">
            ⚠️ ERROR: {error}
          </p>
        </div>
      ) : (groups ?? []).length === 0 ? (
        <div className="handdrawn-card p-12 text-center bg-white relative tape-effect">
          <span className="text-4xl">🗂️</span>
          <p className="marker-heading text-2xl text-paper-text mt-3">No groups created yet!</p>
          <p className="text-paper-text/60 font-bold mt-1 max-w-sm mx-auto">
            You are not currently active in any shared expense groups. Initialize your first group folder below.
          </p>
          <Link
            href="/groups/new"
            className="mt-6 handdrawn-btn bg-paper-accent text-white"
            style={{ borderRadius: "120px 20px 100px 20px / 20px 100px 20px 120px" }}
          >
            CREATE FIRST GROUP →
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {(groups ?? []).map((group, idx) => {
            // Alternate rotations for authentic sketchbook look
            const rot = idx % 2 === 0 ? "hover:rotate-[1deg]" : "hover:rotate-[-1deg]";
            return (
              <li key={group.id} className="transition-all transform">
                <Link
                  href={`/groups/${group.id}`}
                  className={`handdrawn-card flex items-center justify-between px-6 py-5 bg-white ${rot} hover:bg-paper-muted/30 group`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-paper-postit border-2 border-paper-border rounded-full flex items-center justify-center font-bold text-paper-text shrink-0 rotate-3">
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                    <div>
                      <p className="marker-heading text-xl text-paper-text group-hover:text-paper-blue transition-colors">
                        {group.name}
                      </p>
                      <p className="text-sm font-bold text-paper-text/50">
                        👥 {group.memberCount} active {group.memberCount === 1 ? "scribbler" : "scribblers"}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {group.myRole === "ADMIN" && (
                      <span className="text-xs font-bold border-2 border-paper-accent text-paper-accent bg-paper-accent/5 px-2 py-0.5 rounded rotate-[-3deg]">
                        ADMIN
                      </span>
                    )}
                    <span className="text-paper-text/40 group-hover:text-paper-text transition-colors transform group-hover:translate-x-1">
                      <ArrowRight size={18} strokeWidth={2.5} />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* Footer information */}
      {!fetchLoading && !error && (
        <div className="mt-8 text-center">
          <p className="text-xs text-paper-text/50 font-bold">
            💡 TIP: Click any folder to edit memberships, review CSV inputs, or view balances.
          </p>
        </div>
      )}
    </main>
  );
}
