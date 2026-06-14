"use client";

import Link from "next/link";

const skills = {
  "Languages": ["Python", "Java", "SQL"],
  "AI / ML": ["Scikit-learn", "Regression Modeling", "Feature Engineering", "Predictive Analytics"],
  "Data Analytics": ["Pandas", "NumPy", "EDA", "Data Cleaning", "Data Visualization"],
  "Backend & APIs": ["FastAPI", "RESTful APIs"],
  "Database": ["MySQL", "PostgreSQL"],
  "Core CS": ["Data Structures & Algorithms", "OOP", "DBMS", "Operating Systems"],
  "Tools": ["Git", "GitHub", "Regex", "Web Scraping", "Salesforce Trailhead"],
};

const projects = [
  {
    name: "InternshipIQ",
    subtitle: "AI Internship Aggregator",
    bullets: [
      "Aggregated 10,000+ internship listings from 15+ platforms",
      "Relevance-ranked using NLP/ML pipeline",
      "Automated 3-hour daily manual search to ~5 seconds",
      "Tech: Python, FastAPI, Scikit-learn, Web Scraping, SQL",
    ],
  },
  {
    name: "FlatTrack",
    subtitle: "Household Expense Tracker (this app)",
    bullets: [
      "Multi-currency expense tracking for flatmates (USD/INR)",
      "Dynamic membership with time-scoped cost attribution",
      "Robust CSV import with 17+ anomaly detection & resolution patterns",
      "Tech: Next.js, TypeScript, Node.js, PostgreSQL, Prisma, JWT",
    ],
  },
];

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {/* Tape style overlay + card header */}
      <div className="handdrawn-card p-6 bg-white rotate-[-0.5deg] mb-8 relative notebook-margin-line pl-8">
        <p className="text-xs text-paper-blue font-bold uppercase tracking-wider mb-0.5">
          📂 operator / cv
        </p>
        <h1 className="marker-heading text-4xl text-paper-text uppercase tracking-wide">
          [ Developer Profile ]
        </h1>
        <p className="text-sm text-paper-text/70 mt-1">
          Handwritten portfolio details & résumé download.
        </p>
      </div>

      {/* Main Resume Sheet */}
      <div className="handdrawn-card p-6 md:p-8 bg-white rotate-[0.5deg] relative notebook-margin-line pl-8 space-y-8 mb-8">
        
        {/* Name and Basic Contacts */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-4 pb-4 border-b-2 border-dashed border-paper-border">
          <div>
            <h2 className="marker-heading text-3xl text-paper-text">Aarupadaiyar KJ</h2>
            <p className="text-base text-paper-blue font-bold mt-1">
              Data & AI Engineer · Backend Developer · Placement Candidate
            </p>
          </div>
          <div className="text-sm font-bold text-paper-text/85 space-y-1.5 font-mono">
            <div className="flex items-center gap-1.5">
              <span>📧</span>
              <a href="mailto:aarupadaiyarjeyapal@gmail.com" className="hover:underline">aarupadaiyarjeyapal@gmail.com</a>
            </div>
            <div className="flex items-center gap-1.5">
              <span>📱</span>
              <span>+91-6374597047</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-paper-blue">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                <rect x="2" y="9" width="4" height="12" />
                <circle cx="4" cy="4" r="2" />
              </svg>
              <a
                href="https://linkedin.com/in/aarupadaiyarkj"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-paper-accent transition-colors"
              >
                in/aarupadaiyarkj
              </a>
            </div>
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-paper-text">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
              <a
                href="https://github.com/Aarupadaiyar"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-paper-accent transition-colors"
              >
                github/Aarupadaiyar
              </a>
            </div>
          </div>
        </div>

        {/* Skill matrix */}
        <section>
          <h3 className="marker-heading text-2xl text-paper-text mb-4 underline decoration-wavy decoration-paper-accent">
            Skill Index
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(skills).map(([category, items], idx) => (
              <div
                key={category}
                className="p-4 bg-paper-bg/40 border-2 border-paper-border rounded"
                style={{ borderRadius: idx % 2 === 0 ? "15px 225px 15px 255px / 255px 15px 225px 15px" : "255px 15px 225px 15px / 15px 225px 15px 255px" }}
              >
                <h4 className="marker-heading text-base text-paper-blue mb-2 uppercase tracking-wide">
                  {category}
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((item) => (
                    <span
                      key={item}
                      className="text-xs font-bold border border-paper-border bg-white px-2 py-0.5 rounded"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Work history */}
        <section>
          <h3 className="marker-heading text-2xl text-paper-text mb-4 underline decoration-wavy decoration-paper-blue">
            Work Experience
          </h3>
          <div className="p-5 bg-paper-postit/40 border-2 border-paper-border rounded rotate-[-0.5deg]">
            <div className="flex justify-between items-start flex-wrap gap-2 mb-3">
              <div>
                <h4 className="marker-heading text-xl text-paper-text">DATA & REPORTING INTERN</h4>
                <p className="text-sm font-bold text-paper-blue">Bitzure</p>
              </div>
              <span className="text-xs font-bold bg-white border-2 border-paper-border px-2.5 py-0.5 rounded rotate-2">
                INTERNSHIP
              </span>
            </div>
            <ul className="space-y-2 text-sm font-bold text-paper-text/85">
              <li className="flex gap-2 items-start">
                <span className="text-paper-accent text-base select-none mt-[-2px]">&gt;</span>
                <span>Processed 25,000+ customer and business records through automated extraction workflows.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="text-paper-accent text-base select-none mt-[-2px]">&gt;</span>
                <span>Built dashboards for campaign tracking and sales analysis.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="text-paper-accent text-base select-none mt-[-2px]">&gt;</span>
                <span>Reduced manual reporting effort by nearly 60%.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="text-paper-accent text-base select-none mt-[-2px]">&gt;</span>
                <span>Converted raw datasets into actionable business insights.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Projects */}
        <section className="space-y-4">
          <h3 className="marker-heading text-2xl text-paper-text mb-4 underline decoration-wavy decoration-paper-accent">
            Academic Projects
          </h3>
          {projects.map((project, idx) => (
            <div
              key={idx}
              className="p-5 bg-white border-2 border-paper-border rounded"
              style={{ borderRadius: idx % 2 === 0 ? "255px 15px 225px 15px / 15px 225px 15px 255px" : "15px 225px 15px 255px / 255px 15px 225px 15px" }}
            >
              <div className="flex justify-between items-start flex-wrap gap-2 mb-3">
                <div>
                  <h4 className="marker-heading text-xl text-paper-text">{project.name}</h4>
                  <p className="text-xs text-paper-text/50 font-bold">// {project.subtitle}</p>
                </div>
                <span className="text-xs font-bold border border-paper-border bg-paper-muted px-2 py-0.5 rounded">
                  PROJECT {String(idx + 1).padStart(2, "0")}
                </span>
              </div>
              <ul className="space-y-1.5 text-sm font-bold text-paper-text/85">
                {project.bullets.map((bullet, i) => (
                  <li key={i} className="flex gap-2 items-start">
                    <span className="text-paper-blue text-base select-none mt-[-2px]">&gt;</span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>

      {/* Download Action Section */}
      <section className="handdrawn-card p-6 text-center bg-white rotate-[-1deg] relative tack-effect">
        <p className="text-sm font-bold text-paper-text/60 mb-3">
          ✏️ Click below to download the official CV sheet (PDF format)
        </p>
        <a
          href="/Aarupadaiyar_KJ_General_CV ATS-84.pdf"
          download="Aarupadaiyar_KJ_General_CV ATS-84.pdf"
          className="handdrawn-btn bg-paper-accent text-white py-3 px-8 text-lg font-bold inline-block"
          style={{ borderRadius: "120px 20px 100px 20px / 20px 100px 20px 120px" }}
        >
          DOWNLOAD RESUME (PDF)
        </a>
      </section>

      {/* Footer back nav */}
      <div className="mt-8 flex justify-center gap-4 font-bold text-sm">
        <Link href="/guide" className="text-paper-blue hover:text-paper-accent transition-colors underline">
          read_guide_binder
        </Link>
        <span className="text-paper-text/30">|</span>
        <Link href="/dashboard" className="text-paper-blue hover:text-paper-accent transition-colors underline">
          back_to_dashboard
        </Link>
      </div>
    </main>
  );
}
