"use client";

import React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { BookOpen, User, Users, LogOut, LayoutDashboard, Sparkles } from "lucide-react";

export default function TerminalFrame({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const isActive = (path: string) => pathname === path;

  // Reusable active tab style
  const getTabClass = (path: string, exact = false) => {
    const active = exact ? isActive(path) : pathname.startsWith(path);
    return `relative font-bold px-3 py-1 text-sm border-2 border-paper-border transition-all hover:bg-paper-accent hover:text-white ${
      active
        ? "bg-paper-accent text-white -rotate-1 translate-y-[-2px] shadow-solidSm"
        : "bg-white text-paper-text rotate-1 hover:rotate-0 hover:translate-y-[-1px] shadow-none"
    }`;
  };

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-6 bg-paper-bg max-w-5xl mx-auto">
      {/* Hand-Drawn Notebook Header */}
      <header className="handdrawn-card p-5 mb-6 relative rotate-[-0.5deg]">
        {/* Ring binder hole punches at the top */}
        <div className="absolute top-[-8px] left-8 right-8 flex justify-between pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="w-4 h-4 bg-paper-bg border-2 border-paper-border rounded-full shadow-inner"
            />
          ))}
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📓</span>
            <span className="marker-heading text-2xl tracking-wide text-paper-text">
              FlatTrack Planner <span className="text-xs correction-text inline-block rotate-12 ml-2 border border-dashed border-paper-accent p-0.5">v1.1</span>
            </span>
          </div>
          <div className="text-xs font-bold font-mono bg-paper-muted border border-paper-border px-2 py-0.5 rounded rotate-1 text-paper-text">
            DATE: {new Date().toLocaleDateString("en-IN")}
          </div>
        </div>

        {/* Notebook margin red double line */}
        <div className="handdrawn-divider my-4" />

        {/* Navigation / Prompt */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-paper-blue text-sm">
              ✍️ {loading ? "loading..." : user ? `${user.displayName.toLowerCase()}@planner` : "guest"}
            </span>
            <span className="text-paper-text/60 font-mono text-xs">/ {pathname.replace("/", "") || "home"}</span>
          </div>

          <nav className="flex gap-2.5 flex-wrap items-center">
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className={getTabClass("/dashboard", true)}
                  style={{ borderRadius: "120px 20px 100px 20px / 20px 100px 20px 120px" }}
                >
                  <span className="flex items-center gap-1.5">
                    <LayoutDashboard size={14} strokeWidth={2.5} /> DASHBOARD
                  </span>
                </Link>
                <Link
                  href="/groups"
                  className={getTabClass("/groups")}
                  style={{ borderRadius: "20px 120px 20px 100px / 100px 20px 120px 20px" }}
                >
                  <span className="flex items-center gap-1.5">
                    <Users size={14} strokeWidth={2.5} /> GROUPS
                  </span>
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className={getTabClass("/login")}
                  style={{ borderRadius: "120px 20px 100px 20px / 20px 100px 20px 120px" }}
                >
                  [ LOGIN ]
                </Link>
                <Link
                  href="/register"
                  className={getTabClass("/register")}
                  style={{ borderRadius: "20px 120px 20px 100px / 100px 20px 120px 20px" }}
                >
                  [ SIGN_UP ]
                </Link>
              </>
            )}

            <Link
              href="/guide"
              className={getTabClass("/guide")}
              style={{ borderRadius: "100px 20px 120px 20px / 20px 100px 20px 120px" }}
            >
              <span className="flex items-center gap-1.5">
                <BookOpen size={14} strokeWidth={2.5} /> USER_GUIDE
              </span>
            </Link>

            <Link
              href="/about"
              className={getTabClass("/about")}
              style={{ borderRadius: "20px 100px 20px 120px / 120px 20px 100px 20px" }}
            >
              <span className="flex items-center gap-1.5">
                <User size={14} strokeWidth={2.5} /> BIO
              </span>
            </Link>

            {user && (
              <button
                onClick={handleLogout}
                className="bg-paper-muted hover:bg-paper-accent hover:text-white border-2 border-paper-border px-3 py-1 text-sm font-bold transition-all rotate-[-1deg] hover:rotate-0 flex items-center gap-1.5"
                style={{ borderRadius: "120px 20px 100px 20px / 20px 100px 20px 120px" }}
              >
                <LogOut size={14} strokeWidth={2.5} /> OUT
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Sketchbook Page Content */}
      <div className="flex-1 flex flex-col relative">
        {children}
      </div>

      {/* Sketchy Footer */}
      <footer className="mt-8 pt-4 border-t-2 border-dashed border-paper-border text-center text-sm font-bold flex flex-col md:flex-row justify-between items-center gap-2 select-none">
        <div className="text-paper-text/60">
          SYSTEM STATUS: <span className="text-paper-blue">SCRIBBLING... ✏️</span>
        </div>
        <div className="text-paper-text/70 marker-heading">
          Built by Aarupadaiyar KJ (Aarav) 🌟
        </div>
      </footer>
    </div>
  );
}
