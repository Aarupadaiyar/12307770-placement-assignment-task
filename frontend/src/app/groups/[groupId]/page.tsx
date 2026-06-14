"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  getGroup,
  renameGroup,
  addGroupMember,
  editGroupMember,
  endGroupMembership,
  GroupDetail,
  GroupMember,
  ApiError,
} from "@/lib/api";
import { UserPlus, Settings, Check, X, Calendar, Edit2, ShieldCheck, UploadCloud } from "lucide-react";

export default function GroupDetailPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;

  const { user, loading: authLoading } = useAuth();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Rename state
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameSubmitting, setRenameSubmitting] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // Add member state
  const [addEmail, setAddEmail] = useState("");
  const [addJoinedAt, setAddJoinedAt] = useState("");
  const [addLeftAt, setAddLeftAt] = useState("");
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  // Edit membership state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editJoinedAt, setEditJoinedAt] = useState("");
  const [editLeftAt, setEditLeftAt] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // End membership state
  const [endingUserId, setEndingUserId] = useState<string | null>(null);
  const [endLeftAt, setEndLeftAt] = useState(todayIso());
  const [endSubmitting, setEndSubmitting] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);

  // Past members toggle
  const [showPast, setShowPast] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  function fetchGroup() {
    setFetchError(null);
    return getGroup(groupId)
      .then((res) => setGroup(res.group))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setFetchError("Group folder not found.");
        else if (err instanceof ApiError && err.status === 403) setFetchError("Access denied to this group folder.");
        else setFetchError("Failed to load group details.");
      })
      .finally(() => setFetchLoading(false));
  }

  useEffect(() => {
    if (!user) return;
    fetchGroup();
  }, [user, groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    setRenameError(null);
    const trimmed = newName.trim();
    if (!trimmed) { setRenameError("Name is required"); return; }
    setRenameSubmitting(true);
    try {
      await renameGroup(groupId, trimmed);
      setRenaming(false);
      await fetchGroup();
    } catch (err) {
      setRenameError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setRenameSubmitting(false);
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    setAddSuccess(null);
    if (!addEmail.trim()) { setAddError("Email is required"); return; }
    setAddSubmitting(true);
    try {
      const joinedAtIso = addJoinedAt ? new Date(addJoinedAt).toISOString() : undefined;
      const leftAtIso = addLeftAt ? new Date(addLeftAt).toISOString() : undefined;
      const res = await addGroupMember(groupId, addEmail.trim(), joinedAtIso, leftAtIso);
      setAddSuccess(`${res.member.displayName} added successfully.`);
      setAddEmail("");
      setAddJoinedAt("");
      setAddLeftAt("");
      await fetchGroup();
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setAddSubmitting(false);
    }
  }

  async function handleEditMembership(targetUserId: string) {
    setEditError(null);
    setEditSubmitting(true);
    try {
      const joinedAtIso = new Date(editJoinedAt).toISOString();
      const leftAtIso = editLeftAt ? new Date(editLeftAt).toISOString() : undefined;
      await editGroupMember(groupId, targetUserId, joinedAtIso, leftAtIso);
      setEditingUserId(null);
      await fetchGroup();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleEndMembership(targetUserId: string) {
    setEndError(null);
    setEndSubmitting(true);
    try {
      const leftAtIso = new Date(endLeftAt).toISOString();
      await endGroupMembership(groupId, targetUserId, leftAtIso);
      setEndingUserId(null);
      await fetchGroup();
    } catch (err) {
      setEndError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setEndSubmitting(false);
    }
  }

  function MemberRow({ member, isAdmin }: { member: GroupMember; isAdmin: boolean }) {
    const isCurrentUser = member.userId === user?.id;
    const isBeingEnded = endingUserId === member.userId;

    return (
      <li className="py-3 border-b-2 border-dashed border-paper-border last:border-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-paper-text text-base">
                👤 {member.displayName}
              </span>
              <span className="text-xs text-paper-text/60 font-mono">({member.email})</span>
              {member.role === "ADMIN" && (
                <span className="text-xs font-bold border border-paper-accent text-paper-accent bg-paper-accent/5 px-1.5 py-0.2 rounded rotate-[-2deg]">
                  ADMIN
                </span>
              )}
              {isCurrentUser && (
                <span className="text-xs font-bold text-paper-blue">(you)</span>
              )}
            </div>
            <div className="text-xs text-paper-text/60 font-mono mt-1">
              <span>JOINED: {formatDate(member.joinedAt)}</span>
              {member.leftAt && <span className="ml-3 correction-text">LEFT: {formatDate(member.leftAt)}</span>}
            </div>
          </div>
          {isAdmin && !isCurrentUser && !isBeingEnded && editingUserId !== member.userId && (
            <div className="flex gap-2 self-start sm:self-auto">
              <button
                onClick={() => {
                  setEditingUserId(member.userId);
                  setEditJoinedAt(member.joinedAt ? member.joinedAt.split('T')[0] : todayIso());
                  setEditLeftAt(member.leftAt ? member.leftAt.split('T')[0] : "");
                  setEditError(null);
                  setEndingUserId(null);
                }}
                className="text-xs font-bold text-paper-blue hover:underline border border-dashed border-paper-blue px-2 py-0.5 rounded transition-colors"
              >
                Edit Dates
              </button>
              <button
                onClick={() => {
                  setEndingUserId(member.userId);
                  setEndLeftAt(todayIso());
                  setEndError(null);
                  setEditingUserId(null);
                }}
                className="text-xs font-bold text-paper-accent hover:underline border border-dashed border-paper-accent px-2 py-0.5 rounded transition-colors"
              >
                End Membership
              </button>
            </div>
          )}
        </div>

        {editingUserId === member.userId && (
          <div className="mt-3 border-2 border-paper-blue bg-paper-blue/5 p-4 rounded rotate-[-0.5deg]">
            <p className="font-bold text-sm text-paper-blue mb-2">
              ✏️ Edit Membership Dates for {member.displayName}
            </p>
            <div className="flex flex-col sm:flex-row items-end gap-3 flex-wrap">
              <div>
                <label className="block text-xs font-bold text-paper-text/85 mb-1 uppercase">Joined Date</label>
                <input
                  type="date"
                  value={editJoinedAt}
                  onChange={(e) => setEditJoinedAt(e.target.value)}
                  className="px-2 py-1 text-xs border border-paper-border"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-paper-text/85 mb-1 uppercase">Departure Date</label>
                <input
                  type="date"
                  value={editLeftAt}
                  onChange={(e) => setEditLeftAt(e.target.value)}
                  className="px-2 py-1 text-xs border border-paper-border"
                />
              </div>
              <div className="flex gap-2 mt-2 sm:mt-0">
                <button
                  onClick={() => handleEditMembership(member.userId)}
                  disabled={editSubmitting}
                  className="px-3 py-1 text-xs font-bold bg-paper-blue text-white border-2 border-paper-border rounded"
                >
                  {editSubmitting ? "SAVING..." : "SAVE"}
                </button>
                <button
                  onClick={() => { setEditingUserId(null); setEditError(null); }}
                  disabled={editSubmitting}
                  className="px-3 py-1 text-xs font-bold bg-paper-muted text-paper-text border-2 border-paper-border rounded"
                >
                  CANCEL
                </button>
              </div>
            </div>
            {editError && (
              <p className="mt-2 text-xs font-bold text-paper-accent">ERROR: {editError}</p>
            )}
          </div>
        )}

        {isBeingEnded && (
          <div className="mt-3 border-2 border-paper-accent bg-paper-accent/5 p-4 rounded rotate-[0.5deg]">
            <p className="font-bold text-sm text-paper-accent mb-1">
              ⚠️ Warning: Ending {member.displayName}&apos;s membership
            </p>
            <p className="text-xs text-paper-text/70 leading-relaxed mb-3">
              This will assign an exit timestamp. Note that their historical share weights are retained.
            </p>
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="block text-xs font-bold text-paper-text/85 mb-1 uppercase">Departure Date</label>
                <input
                  type="date"
                  value={endLeftAt}
                  onChange={(e) => setEndLeftAt(e.target.value)}
                  max={todayIso()}
                  className="px-2 py-1 text-xs"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEndMembership(member.userId)}
                  disabled={endSubmitting}
                  className="px-3 py-1 text-xs font-bold bg-paper-accent text-white border-2 border-paper-border rounded"
                >
                  {endSubmitting ? "PROCESSING..." : "CONFIRM"}
                </button>
                <button
                  onClick={() => { setEndingUserId(null); setEndError(null); }}
                  disabled={endSubmitting}
                  className="px-3 py-1 text-xs font-bold bg-paper-muted text-paper-text border-2 border-paper-border rounded"
                >
                  ABORT
                </button>
              </div>
            </div>
            {endError && (
              <p className="mt-2 text-xs font-bold text-paper-accent">ERROR: {endError}</p>
            )}
          </div>
        )}
      </li>
    );
  }

  // Loading / error checks
  if (authLoading || (fetchLoading && !group)) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="marker-heading text-xl text-paper-text/60 animate-bounce">
          ✏️ loading group folder details...
        </p>
      </main>
    );
  }

  if (fetchError || !group) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Link href="/groups" className="text-sm font-bold text-paper-text/60 hover:text-paper-accent transition-colors">
          ← BACK_TO_DIRECTORY
        </Link>
        <div className="mt-8 border-2 border-paper-accent bg-paper-accent/5 p-4 rounded rotate-[-1deg]">
          <p className="font-bold text-paper-accent text-sm">
            ⚠️ ERROR: {fetchError ?? "Folder not found."}
          </p>
        </div>
      </main>
    );
  }

  const isAdmin = group.myRole === "ADMIN";

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {/* Back Link */}
      <Link href="/groups" className="text-sm font-bold text-paper-text/60 hover:text-paper-accent transition-colors">
        ← BACK_TO_DIRECTORY
      </Link>

      {/* Title block */}
      <div className="mt-6 handdrawn-card p-6 bg-white rotate-[-0.5deg] relative notebook-margin-line pl-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {renaming ? (
            <form onSubmit={handleRename} className="flex items-center gap-2 flex-1 max-w-md">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                maxLength={100}
                className="flex-1 text-xl font-bold py-1 px-2 border-2 border-paper-border rounded"
              />
              <button
                type="submit"
                disabled={renameSubmitting}
                className="handdrawn-btn py-1 px-3 text-xs bg-paper-accent text-white"
              >
                {renameSubmitting ? "SAVING..." : "SAVE"}
              </button>
              <button
                type="button"
                onClick={() => { setRenaming(false); setRenameError(null); }}
                className="handdrawn-btn-secondary py-1 px-3 text-xs"
              >
                CANCEL
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-3">
              <h1 className="marker-heading text-3xl text-paper-text uppercase tracking-wide">
                📁 {group.name}
              </h1>
              {isAdmin && (
                <button
                  onClick={() => { setRenaming(true); setNewName(group.name); setRenameError(null); }}
                  className="text-xs text-paper-blue hover:text-paper-accent font-bold border border-dashed border-paper-blue px-2 py-0.5 rounded transition-all"
                >
                  RENAME
                </button>
              )}
            </div>
          )}

          {isAdmin ? (
            <span className="text-xs font-bold border-2 border-paper-accent text-paper-accent bg-paper-accent/5 px-2.5 py-1 rounded rotate-[2deg] self-start md:self-auto flex items-center gap-1.5">
              <ShieldCheck size={14} strokeWidth={2.5} /> ADMIN ACCOUNT
            </span>
          ) : (
            <span className="text-xs font-bold border-2 border-paper-border bg-paper-muted px-2.5 py-1 rounded rotate-[-2deg] self-start md:self-auto">
              MEMBER ACCESS
            </span>
          )}
        </div>

        {renameError && (
          <p className="mt-2 text-xs font-bold text-paper-accent">ERROR: {renameError}</p>
        )}
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        
        {/* Left Column: Active Members List */}
        <div className="md:col-span-2 space-y-6">
          <div className="handdrawn-card p-6 bg-white rotate-[0.5deg]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="marker-heading text-xl text-paper-text uppercase tracking-wide">
                👥 Active Flatmates
              </h2>
              <span className="text-xs font-bold bg-paper-muted border border-paper-border px-2 py-0.5 rounded">
                COUNT: {(group.currentMembers ?? []).length}
              </span>
            </div>

            {(group.currentMembers ?? []).length === 0 ? (
              <p className="text-sm text-paper-text/60 italic font-bold">// No active flatmates listed</p>
            ) : (
              <ul className="divide-y-2 divide-dashed divide-paper-border">
                {(group.currentMembers ?? []).map((m) => (
                  <MemberRow key={m.membershipId} member={m} isAdmin={isAdmin} />
                ))}
              </ul>
            )}
          </div>

          {/* Past Members Section */}
          {(group.pastMembers ?? []).length > 0 && (
            <div className="handdrawn-card p-6 bg-white rotate-[-0.5deg]">
              <button
                onClick={() => setShowPast((s) => !s)}
                className="flex items-center justify-between w-full text-left marker-heading text-lg text-paper-text uppercase hover:text-paper-blue transition-colors"
              >
                <span>📁 Past Flatmates ({(group.pastMembers ?? []).length})</span>
                <span>{showPast ? "▾" : "▸"}</span>
              </button>

              {showPast && (
                <ul className="mt-4 divide-y-2 divide-dashed divide-paper-border pt-2">
                  {(group.pastMembers ?? []).map((m) => (
                    <MemberRow key={m.membershipId} member={m} isAdmin={isAdmin} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Invite Member Card (Admin Only) */}
        <div>
          {isAdmin ? (
            <div className="postit-card p-6 rotate-[-1deg]">
              <h2 className="marker-heading text-xl text-paper-text flex items-center gap-1.5">
                <UserPlus size={18} strokeWidth={2.5} /> Invite Member
              </h2>
              <p className="text-xs text-paper-text/70 mt-1 leading-relaxed">
                Add an active roommate. Note: they must possess an existing registered profile.
              </p>
              
              <div className="handdrawn-divider my-4" />

              <form onSubmit={handleAddMember} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-paper-text/80 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="flatmate@gmail.com"
                    disabled={addSubmitting}
                    className="w-full text-xs"
                  />
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-paper-text/80 mb-1">
                      Joined On <span className="text-paper-text/40">(optional)</span>
                    </label>
                    <input
                      type="date"
                      value={addJoinedAt}
                      onChange={(e) => setAddJoinedAt(e.target.value)}
                      disabled={addSubmitting}
                      className="w-full text-xs"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-paper-text/80 mb-1">
                      Left On <span className="text-paper-text/40">(optional)</span>
                    </label>
                    <input
                      type="date"
                      value={addLeftAt}
                      onChange={(e) => setAddLeftAt(e.target.value)}
                      disabled={addSubmitting}
                      className="w-full text-xs"
                    />
                  </div>
                </div>

                {addError && (
                  <p className="text-xs font-bold text-paper-accent">⚠️ ERROR: {addError}</p>
                )}
                {addSuccess && (
                  <p className="text-xs font-bold text-green-700">✅ OK: {addSuccess}</p>
                )}

                <button
                  type="submit"
                  disabled={addSubmitting || !addEmail.trim()}
                  className="w-full handdrawn-btn py-2 text-sm bg-paper-accent text-white"
                >
                  {addSubmitting ? "ADDING..." : "ADD MEMBER"}
                </button>
              </form>
            </div>
          ) : (
            <div className="postit-card p-6 rotate-[1deg] bg-paper-muted/20">
              <h2 className="marker-heading text-lg text-paper-text">Membership Notice</h2>
              <div className="handdrawn-divider my-3" />
              <p className="text-xs text-paper-text/80 leading-relaxed font-bold">
                You are registered as a regular member. Only group Admins have permission to rename the ledger folder, invite new roommates, or set departure bounds.
              </p>
            </div>
          )}

          {/* Upload CSV quick-action card */}
          <div className="handdrawn-card bg-white p-5 mt-5 rotate-[0.5deg]">
            <h2 className="marker-heading text-lg text-paper-text flex items-center gap-2">
              <UploadCloud size={18} strokeWidth={2} /> Import CSV
            </h2>
            <p className="text-xs text-paper-text/60 mt-1 leading-relaxed font-bold">
              Upload a raw expenses CSV export. We&apos;ll scan every row for anomalies before committing.
            </p>
            <Link
              href={`/groups/${groupId}/import`}
              id="go-to-import-btn"
              className="mt-4 handdrawn-btn bg-paper-blue text-white text-sm w-full text-center flex items-center justify-center gap-2 py-2"
              style={{ borderRadius: "100px 15px 90px 15px / 15px 90px 15px 100px" }}
            >
              <UploadCloud size={14} /> Upload CSV →
            </Link>
          </div>
        </div>

      </div>

      {/* Info bottom footer */}
      <div className="mt-8 text-center text-xs text-paper-text/50 font-bold">
        <span>GROUP_ID: {groupId}</span>
      </div>
    </main>
  );
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
