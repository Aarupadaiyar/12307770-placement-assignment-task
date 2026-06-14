"use client";

import Link from "next/link";
import { HelpCircle, ChevronRight, CheckSquare, ShieldCheck, HelpCircle as HelpIcon } from "lucide-react";

const sections = [
  {
    id: "overview",
    title: "1. System Overview",
    content: "FlatTrack is a household expense tracker built for flatmates. It tracks who paid what, when each person lived in the flat, and fairly calculates each person's share — even when membership changes mid-period. Supports both USD and INR currencies.",
  },
  {
    id: "auth",
    title: "2. Authentication",
    steps: [
      { cmd: "REGISTER", desc: "Create an account with your nickname, email, and password." },
      { cmd: "LOGIN", desc: "Sign in to access your groups and expense datasets." },
      { cmd: "LOGOUT", desc: "Session is JWT-based. Logging out clears the secure cookie." },
    ],
  },
  {
    id: "groups",
    title: "3. Group Management",
    steps: [
      { cmd: "CREATE_GROUP", desc: "Any user can create a group. Creator is assigned ADMIN role." },
      { cmd: "ADD_MEMBER", desc: "Admins can add registered users via email. Optionally set the date they joined." },
      { cmd: "END_MEMBERSHIP", desc: "Admins can set departure dates. Expense split weights are recalculated relative to their bounds." },
      { cmd: "RENAME_GROUP", desc: "Admins can edit the group name folder description." },
    ],
  },
  {
    id: "membership",
    title: "4. Membership Rules",
    rules: [
      "A member's 'joined' date defaults to when they were added, but can be set to any past date.",
      "Expenses are split only among members who were active during the expense period.",
      "A member with no departure date is considered currently active.",
      "Admins cannot end their own membership (prevents group lockout).",
      "At least one ADMIN must remain in each group at all times.",
    ],
  },
  {
    id: "import",
    title: "5. CSV Import & Anomalies",
    content: "The CSV parser processes bulk uploads. When anomalies are encountered, it suspends imports into a 'REVIEW' workflow. You must configure corrections manually for the following cases:",
    anomalies: [
      { code: "MISSING_AMOUNT", desc: "Row lacks numeric values. Force skip or assign 0.00." },
      { code: "NEGATIVE_AMOUNT", desc: "Less than zero values. Treat as refunds or reject." },
      { code: "FUTURE_DATE", desc: "Timestamp exceeds current date. Correct date manually." },
      { code: "UNKNOWN_CURRENCY", desc: "Unsupported code. Map to active currency index." },
      { code: "DUPLICATE_ROW", desc: "Double entries detected. Skip duplicate entries automatically." },
      { code: "MISSING_PAYER", desc: "Empty email. Default to group admin account." },
      { code: "NONMEMBER_PAYER", desc: "Payer was not a member during that time. Update membership dates." },
    ],
  },
];

export default function GuidePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {/* Header card */}
      <div className="handdrawn-card p-6 bg-white rotate-[-0.5deg] mb-8 relative notebook-margin-line pl-8">
        <p className="text-xs text-paper-blue font-bold uppercase tracking-wider mb-0.5">
          📖 documentation / user guide
        </p>
        <h1 className="marker-heading text-4xl text-paper-text uppercase tracking-wide">
          [ Instruction Manual ]
        </h1>
        <p className="text-sm text-paper-text/70 mt-1">
          Handwritten system documentation and membership rules.
        </p>
      </div>

      {/* Table of Contents Sticky Note */}
      <div className="postit-card p-6 rotate-[1deg] mb-8">
        <h3 className="marker-heading text-xl text-paper-text mb-3 flex items-center gap-1.5">
          <HelpIcon size={18} strokeWidth={2.5} /> Binder Contents
        </h3>
        <ul className="space-y-1.5 text-sm font-bold text-paper-text/85">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-paper-blue hover:text-paper-accent transition-colors flex items-center gap-1">
                <ChevronRight size={14} strokeWidth={2.5} /> {s.title}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Section Content Lists */}
      <div className="space-y-8">
        {sections.map((section, idx) => (
          <section key={section.id} id={section.id} className="scroll-mt-6">
            <div className="handdrawn-card p-6 bg-white relative rotate-[-0.5deg] notebook-margin-line pl-8">
              <h2 className="marker-heading text-2xl text-paper-text mb-4 underline decoration-dashed decoration-paper-blue">
                {section.title}
              </h2>

              {section.content && (
                <p className="text-sm font-bold text-paper-text/80 leading-relaxed mb-4">
                  {section.content}
                </p>
              )}

              {section.steps && (
                <ul className="space-y-3">
                  {section.steps.map((step) => (
                    <li key={step.cmd} className="flex gap-3 items-start text-sm font-bold">
                      <span className="text-xs border-2 border-paper-border bg-paper-muted text-paper-text px-2 py-0.5 rounded rotate-[-2deg] shrink-0 font-mono">
                        {step.cmd}
                      </span>
                      <span className="text-paper-text/80">{step.desc}</span>
                    </li>
                  ))}
                </ul>
              )}

              {section.rules && (
                <ul className="space-y-2">
                  {section.rules.map((rule, i) => (
                    <li key={i} className="flex gap-2 items-start text-sm font-bold text-paper-text/80">
                      <span className="text-paper-accent select-none font-bold text-base mt-[-2px]">&gt;</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              )}

              {section.anomalies && (
                <div className="space-y-3 mt-4">
                  <p className="text-xs text-paper-blue font-bold uppercase tracking-wider">// Resolution Protocols:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {section.anomalies.map((anomaly) => (
                      <div
                        key={anomaly.code}
                        className="p-3 bg-paper-bg/40 border-2 border-paper-border rounded text-xs font-bold"
                        style={{ borderRadius: "15px 225px 15px 255px / 255px 15px 225px 15px" }}
                      >
                        <span className="text-paper-accent font-mono block mb-1">
                          {anomaly.code}
                        </span>
                        <span className="text-paper-text/75">{anomaly.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        ))}
      </div>

      {/* Footer Navigation */}
      <div className="mt-10 border-t-2 border-dashed border-paper-border pt-6 text-center flex justify-center gap-4 font-bold text-sm">
        <Link href="/about" className="text-paper-blue hover:text-paper-accent transition-colors underline">
          about_developer
        </Link>
        <span className="text-paper-text/30">|</span>
        <Link href="/dashboard" className="text-paper-blue hover:text-paper-accent transition-colors underline">
          back_to_dashboard
        </Link>
      </div>
    </main>
  );
}
