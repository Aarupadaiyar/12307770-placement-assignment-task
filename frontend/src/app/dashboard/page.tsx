"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { BookOpen, Users, Compass, ShieldAlert, Sparkles } from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="marker-heading text-xl text-paper-text/60 animate-bounce">
          ✏️ opening sketchbook...
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {/* Welcome Board */}
      <div className="handdrawn-card p-6 md:p-8 bg-white rotate-[-0.5deg] mb-8 relative notebook-margin-line pl-8">
        <div className="absolute top-4 right-4 text-3xl select-none animate-bounce">🌟</div>
        <p className="text-sm text-paper-blue font-bold tracking-wider uppercase mb-1">
          // welcome back, flatmate
        </p>
        <h1 className="marker-heading text-4xl text-paper-text">
          Hello, {user.displayName}!
        </h1>
        <p className="mt-2 text-lg text-paper-text/70 leading-relaxed max-w-2xl">
          This is your household expense board. Here you can track shared flat expenses, managing member entry/departure dates, and resolving anomalies from CSV exports.
        </p>

        <div className="handdrawn-divider my-6" />

        <div className="flex gap-4 flex-wrap font-bold">
          <Link
            href="/groups"
            className="handdrawn-btn flex items-center gap-2 bg-paper-accent text-white"
            style={{ borderRadius: "120px 20px 100px 20px / 20px 100px 20px 120px" }}
          >
            <Users size={16} strokeWidth={2.5} /> VIEW GROUPS →
          </Link>
          <Link
            href="/guide"
            className="handdrawn-btn-secondary flex items-center gap-2"
            style={{ borderRadius: "20px 120px 20px 100px / 100px 20px 120px 20px" }}
          >
            <BookOpen size={16} strokeWidth={2.5} /> USER GUIDE
          </Link>
        </div>
      </div>

      {/* Grid of Sticky Notes / Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Post-it 1: System Check */}
        <div className="postit-card p-6 rotate-[-1deg]">
          <span className="text-xl">🎛️</span>
          <h3 className="marker-heading text-xl text-paper-text mt-2">Ledger Status</h3>
          <div className="handdrawn-divider my-3" />
          <ul className="space-y-2 text-sm font-bold text-paper-text/80">
            <li className="flex justify-between">
              <span>STATE:</span>
              <span className="text-green-700">ACTIVE [OK]</span>
            </li>
            <li className="flex justify-between">
              <span>SECURE:</span>
              <span className="text-paper-blue">JWT httpOnly</span>
            </li>
            <li className="flex justify-between">
              <span>CURRENCY:</span>
              <span>USD & INR</span>
            </li>
          </ul>
        </div>

        {/* Post-it 2: Quick tips */}
        <div className="postit-card p-6 rotate-[1.5deg]">
          <span className="text-xl">💡</span>
          <h3 className="marker-heading text-xl text-paper-text mt-2">Scribble Rule</h3>
          <div className="handdrawn-divider my-3" />
          <p className="text-xs text-paper-text/80 leading-relaxed">
            Expenses split only among active members. Be sure to log entry/exit dates accurately inside each group panel!
          </p>
        </div>

        {/* Post-it 3: Shortcuts */}
        <div className="postit-card p-6 rotate-[-0.5deg]">
          <span className="text-xl">📌</span>
          <h3 className="marker-heading text-xl text-paper-text mt-2">Actions</h3>
          <div className="handdrawn-divider my-3" />
          <ul className="space-y-1.5 text-sm font-bold">
            <li>
              <Link href="/groups/new" className="text-paper-blue hover:text-paper-accent transition-colors">
                📝 create_new_group
              </Link>
            </li>
            <li>
              <Link href="/about" className="text-paper-blue hover:text-paper-accent transition-colors">
                👨‍💻 developer_profile
              </Link>
            </li>
            <li>
              <Link href="/guide#import" className="text-paper-blue hover:text-paper-accent transition-colors">
                📥 check_csv_rules
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Diagnostic Board */}
      <div className="handdrawn-card p-6 bg-white rotate-[0.5deg]">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="text-paper-accent" size={20} strokeWidth={2.5} />
          <h2 className="marker-heading text-xl text-paper-text uppercase tracking-wide">
            LEDGER_DIAGNOSTICS_REPORT
          </h2>
        </div>

        <div className="overflow-x-auto border-2 border-paper-border" style={{ borderRadius: "15px 225px 15px 255px / 255px 15px 225px 15px" }}>
          <table className="min-w-full text-left font-bold text-sm">
            <thead className="bg-paper-muted border-b-2 border-paper-border text-paper-text uppercase tracking-wider text-xs">
              <tr>
                <th className="px-4 py-2 border-r-2 border-paper-border">DIAGNOSTIC_PARAMETER</th>
                <th className="px-4 py-2 border-r-2 border-paper-border">VALUE</th>
                <th className="px-4 py-2">EVALUATION</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-paper-border text-paper-text/80">
              <tr className="bg-white">
                <td className="px-4 py-2 border-r-2 border-paper-border font-mono">auth_mode</td>
                <td className="px-4 py-2 border-r-2 border-paper-border">JWT cookie</td>
                <td className="px-4 py-2 text-green-700">OK // SAFE</td>
              </tr>
              <tr className="bg-paper-bg/40">
                <td className="px-4 py-2 border-r-2 border-paper-border font-mono">cost_distribution</td>
                <td className="px-4 py-2 border-r-2 border-paper-border">Membership-aligned</td>
                <td className="px-4 py-2 text-green-700">OK // TIME_AWARE</td>
              </tr>
              <tr className="bg-white">
                <td className="px-4 py-2 border-r-2 border-paper-border font-mono">db_state</td>
                <td className="px-4 py-2 border-r-2 border-paper-border">Prisma / PostgreSQL</td>
                <td className="px-4 py-2 text-green-700">OK // ACTIVE</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
