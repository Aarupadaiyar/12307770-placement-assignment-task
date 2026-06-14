"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, ApiError } from "@/context/AuthContext";
import { UserPlus, Sparkles } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await register(email, password, displayName);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Registration failed. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      {/* Tape style overlay + card with subtle tilt */}
      <div className="w-full max-w-md handdrawn-card p-6 md:p-8 bg-white relative rotate-[1deg] tack-effect mt-6">
        
        <div className="text-center mb-6">
          <div className="inline-block p-2 bg-paper-postit border-2 border-paper-border rounded-full rotate-[-6deg] mb-2">
            <UserPlus className="text-paper-blue" size={28} strokeWidth={2.5} />
          </div>
          <h2 className="marker-heading text-3xl text-paper-text">Register Profile</h2>
          <p className="text-sm text-paper-text/60 font-bold mt-1">// join the expense ledger</p>
        </div>

        <div className="handdrawn-divider mb-6" />

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="displayName" className="block text-sm font-bold uppercase tracking-wider text-paper-text/80 mb-1">
              👤 Scribbler Nickname
            </label>
            <input
              id="displayName"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Aarav"
              disabled={submitting}
              className="w-full"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-bold uppercase tracking-wider text-paper-text/80 mb-1">
              ✉️ Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="flatmate@example.com"
              disabled={submitting}
              className="w-full"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-bold uppercase tracking-wider text-paper-text/80 mb-1">
              🔒 Ledger Key (Password)
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6+ characters"
              disabled={submitting}
              className="w-full"
            />
          </div>

          {error && (
            <div className="border-2 border-paper-accent bg-paper-accent/5 p-3 rounded rotate-[-1deg]" style={{ borderRadius: "15px 225px 15px 255px / 255px 15px 225px 15px" }}>
              <p className="text-sm font-bold text-paper-accent">
                ⚠️ ERROR: {error}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full handdrawn-btn py-3 mt-4 text-white bg-paper-accent border-paper-border uppercase font-bold text-lg"
          >
            {submitting ? "LEDGER CREATION IN PROGRESS..." : "REGISTER PROFILE →"}
          </button>
        </form>

        <div className="handdrawn-divider my-6" />

        <div className="text-center font-bold text-sm">
          <p className="text-paper-text/60">
            Already have an active profile?
          </p>
          <Link
            href="/login"
            className="text-paper-blue underline hover:text-paper-accent transition-colors inline-block mt-1.5"
          >
            Log in to session →
          </Link>
        </div>
      </div>
    </main>
  );
}
