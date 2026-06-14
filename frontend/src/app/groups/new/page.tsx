"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { createGroup, ApiError } from "@/lib/api";
import { Sparkles, PenTool } from "lucide-react";

export default function NewGroupPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  if (authLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="marker-heading text-xl text-paper-text/60 animate-bounce">
          ✏️ initializing new canvas...
        </p>
      </main>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Group name cannot be empty");
      return;
    }
    setSubmitting(true);
    try {
      const res = await createGroup(trimmed);
      router.push(`/groups/${res.group.id}`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-8">
      {/* Back button link */}
      <Link
        href="/groups"
        className="text-sm font-bold text-paper-text/60 hover:text-paper-accent transition-colors flex items-center gap-1 mb-6"
      >
        ← BACK_TO_DIRECTORY
      </Link>

      {/* Creation form */}
      <div className="handdrawn-card p-6 md:p-8 bg-white rotate-[1deg] relative tape-effect">
        <div className="text-center mb-6">
          <h1 className="marker-heading text-3xl text-paper-text">
            Initialize Group
          </h1>
          <p className="text-sm font-bold text-paper-text/60 mt-1">
            // configure new expense cluster
          </p>
        </div>

        <div className="handdrawn-divider mb-6" />

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-bold uppercase tracking-wider text-paper-text/80 mb-2">
              📂 Group Folder Name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. FLAT_4B_EXPENSES"
              maxLength={100}
              disabled={submitting}
              autoFocus
              className="w-full"
            />
            <p className="mt-2 text-xs text-paper-text/50 font-bold">
              * you will automatically be assigned as ADMIN
            </p>
          </div>

          {error && (
            <div className="border-2 border-paper-accent bg-paper-accent/5 p-3 rounded rotate-[-1deg]" style={{ borderRadius: "15px 225px 15px 255px / 255px 15px 225px 15px" }}>
              <p className="text-sm font-bold text-paper-accent">
                ⚠️ ERROR: {error}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="flex-1 handdrawn-btn bg-paper-accent text-white py-3 font-bold"
            >
              {submitting ? "CREATING..." : "CREATE GROUP"}
            </button>
            <Link
              href="/groups"
              className="handdrawn-btn-secondary py-3 px-4 font-bold flex items-center justify-center"
            >
              ABORT
            </Link>
          </div>
        </form>
      </div>

      {/* Sticky tips */}
      <div className="postit-card p-5 mt-8 rotate-[-1.5deg]">
        <h3 className="marker-heading text-lg text-paper-text mb-1">✍️ What's next?</h3>
        <p className="text-xs text-paper-text/80 leading-relaxed">
          Once created, you can:
        </p>
        <ul className="mt-1 space-y-1 text-xs text-paper-text/80 font-bold">
          <li>• Invite other flatmates via their email addresses</li>
          <li>• Adjust custom joined/departure dates</li>
          <li>• Upload and resolve CSV reports</li>
        </ul>
      </div>
    </main>
  );
}
