"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, ApiError } from "@/context/AuthContext";
import { Sparkles, PenTool } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      {/* Tape style overlay + card with subtle tilt */}
      <div className="w-full max-w-md handdrawn-card p-6 md:p-8 bg-white relative rotate-[-1deg] tack-effect mt-6">
        
        <div className="text-center mb-6">
          <div className="inline-block p-2 bg-paper-postit border-2 border-paper-border rounded-full rotate-6 mb-2">
            <PenTool className="text-paper-blue" size={28} strokeWidth={2.5} />
          </div>
          <h2 className="marker-heading text-3xl text-paper-text">Initiate Session</h2>
          <p className="text-sm text-paper-text/60 font-bold mt-1">// enter credentials below</p>
        </div>

        <div className="handdrawn-divider mb-6" />

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-bold uppercase tracking-wider text-paper-text/80 mb-1.5">
              ✏️ Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@flattrack.com"
              disabled={submitting}
              className="w-full"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-bold uppercase tracking-wider text-paper-text/80 mb-1.5">
              🔑 Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={submitting}
              className="w-full"
            />
          </div>

          {error && (
            <div className="border-2 border-paper-accent bg-paper-accent/5 p-3 rounded rotate-1" style={{ borderRadius: "15px 225px 15px 255px / 255px 15px 225px 15px" }}>
              <p className="text-sm font-bold text-paper-accent">
                ⚠️ ERROR: {error}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full handdrawn-btn py-3 mt-2 text-white bg-paper-accent border-paper-border uppercase font-bold text-lg"
          >
            {submitting ? "VERIFYING..." : "LOG IN →"}
          </button>
        </form>

        <div className="handdrawn-divider my-6" />

        <div className="text-center font-bold text-sm">
          <p className="text-paper-text/60">
            First time logging into FlatTrack?
          </p>
          <Link
            href="/register"
            className="text-paper-blue underline hover:text-paper-accent transition-colors inline-block mt-1.5"
          >
            Create a scribbler profile →
          </Link>
        </div>
      </div>
    </main>
  );
}
