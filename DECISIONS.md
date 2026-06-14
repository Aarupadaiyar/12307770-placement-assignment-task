# DECISIONS.md

A log of significant engineering/product decisions: the options considered,
and why the chosen option won. Entries are added as each module is built —
not written retroactively.

---

## D1: Repo structure — npm workspaces monorepo

**Decision:** Single repo with `/frontend`, `/backend`, `/shared` as npm
workspaces.

**Options considered:**
- Two separate repos (frontend, backend)
- Single monolithic Next.js app (API routes + frontend together)
- Monorepo with shared types package (chosen)

**Why:** A separate Express backend + Next.js frontend is more
interview-legible — "here is my API layer" vs "here is my UI" are physically
separate, which makes the live "point at any line, why does it exist" exercise
easier to navigate. A monorepo avoids the overhead of versioning/publishing a
shared types package across two repos, while still giving us that clean
separation. `/shared` holds enums (SplitType, AnomalyType, etc.) that both
sides must agree on — defined once, imported by both.

**Tradeoff accepted:** More boilerplate (two `package.json`s, two
`tsconfig.json`s, two dev servers) than a single Next.js app with API routes.
Judged worth it for clarity of "frontend vs backend" during the live session.

---

## D2: Settlements are a separate table, not an Expense subtype

**Decision:** `Settlement` is its own model (fromUserId, toUserId, amount,
date), entirely separate from `Expense`/`ExpenseSplit`.

**Options considered:**
- Single `Transaction` table with a `type` enum (EXPENSE | SETTLEMENT) and a
  shared splits table for both
- Separate tables (chosen)

**Why:** A settlement has no "split" — it's a direct transfer from A to B.
Forcing it into the Expense/ExpenseSplit shape would mean either (a) a
settlement gets 1-2 ExpenseSplit rows that don't mean "owed share", they mean
"this is the transfer", which overloads the meaning of ExpenseSplit.amount, or
(b) a nullable splitType / nullable splits relation on Expense that's only
sometimes meaningful. Both make the balance engine (Module 6) harder to
reason about and explain. Two clean tables = two clean, separately-explainable
sums: "sum of owed-minus-paid from ExpenseSplit" and "net of Settlements",
combined as the final step.

This decision directly addresses the CSV row "Rohan paid Aisha back, 5000" —
which was logged as an expense with an empty split_type. The import engine
(Module 5) detects this pattern (empty split_type + description matching a
payment pattern + single-person split_with) and proposes reclassifying it as
a `Settlement`, surfaced to the user for confirmation (per Meera's
"approve anything the app changes" requirement).

---

## D3: GroupMembership has joinedAt + leftAt, full history kept

**Decision:** `GroupMembership` is a join table with `joinedAt` (required) and
`leftAt` (nullable). A user can have multiple rows per group (rejoin allowed).

**Options considered:**
- Boolean `isActive` flag, no historical dates
- joinedAt/leftAt with full history (chosen)

**Why:** Directly required by the assignment: "membership can change over
time (members join and leave)" and Sam's complaint ("I moved in mid-April,
why would March electricity affect my balance?"). A boolean can't answer "was
this user active on this specific date in the past" — which the balance
engine and import validator both need to answer for every expense row. The
date-range model makes "active on date D" a single indexed query.

**Tradeoff accepted:** Slightly more complex than a boolean, but this
complexity is core domain logic, not incidental — it's exactly the kind of
rule the live session will ask us to trace.

---

## D4: ExpenseSplit.userId is a plain FK; membership validity is enforced in code

**Decision:** No database-level constraint ties `ExpenseSplit.userId` to
`GroupMembership`. The rule "a split participant must have been an active
group member on the expense date" is enforced in application code (expense
creation service, import validator).

**Options considered:**
- DB-level check constraint / trigger enforcing membership validity
- Application-layer enforcement (chosen)

**Why:** Postgres check constraints can't easily express "this FK is valid
only if a row exists in another table matching a date range" — that requires
triggers, which are hard to read, hard to test, and invisible to someone
reading the Prisma schema. Keeping the rule in one TypeScript function
(`validateSplitMembership` or similar, Module 4) means: it's where the live
session interviewer will look for it, it's unit-testable, and if the policy
changes (e.g. "allow retroactive backdated members") it's a code change, not
a migration.

**Tradeoff accepted:** The database alone does not prevent "invalid" data —
a buggy script could insert a split for a non-member. We accept this because
all writes go through the application layer (no direct DB access from
outside the app), and the alternative (triggers) is worse for explainability.

---

## D5: FX conversion — live historical rate, snapshotted per expense

**Decision:** For non-INR expenses, the import engine fetches the historical
USD→INR rate for the expense's date from a live FX API at import time, and
stores `amountInr`, `fxRateToInr`, and `fxRateDate` on the Expense row. The
balance engine always reads `amountInr` — it never calls the FX API.

**Options considered:**
- Fixed/hardcoded rate constant for all USD expenses
- Store original currency only, separate balance ledgers per currency
- Live historical rate, snapshotted at import time (chosen)

**Why:** Priya's complaint ("the sheet pretends a dollar is a rupee") needs
correcting with a *real* conversion, not a guess. Snapshotting means balances
are stable and reproducible after import — re-running the balance calculation
next year gives the same numbers, even if exchange rates have moved on.
Using the *historical* rate (rate on the expense's date, not today's rate) is
more correct for a trip that happened in March when "today" is June.

**Tradeoff accepted:** Two import runs of the same CSV on different days
could fetch (very slightly) different historical rates if the FX provider
revises historical data, and the import is not byte-for-byte reproducible.
Also requires network access at import time — a hardcoded fallback table for
the known USD/INR rates around March 2026 is included so a flaky network
during the live demo doesn't block the import.

---

## D6: Import review is single-phase, row-by-row, before any commit

**Decision:** CSV rows are parsed into an `ImportStagingRow` table. The user
reviews every row (clean or flagged) and either accepts, edits, or excludes
it. Only after ALL rows have a resolution does "Commit Import" run — a single
transaction that writes resolved rows into `Expense`/`ExpenseSplit`/
`Settlement`.

**Options considered:**
- Two-phase (auto-commit clean rows, queue only flagged rows for review)
- Auto-apply "safe" fixes, review only judgment calls
- Single-phase, everything reviewed before commit (chosen)

**Why:** Meera's requirement is explicit: "I want to approve anything the app
deletes or changes." Auto-committing "clean" rows or "safe" fixes still
constitutes the app changing data without approval — even a formatting fix
like `"1,200"` → `1200` is a change Meera might want to see. A single
staging table with nothing written to real tables until an explicit "Commit"
click is the simplest model to explain live: "here is the staging table, here
is the one transaction that moves rows out of it."

**Tradeoff accepted:** More clicks for the user on a 40-row CSV — every row
needs at least an "accept" click, even rows with no anomaly. Mitigated in the
UI (Module 5) with a "select all clean rows → accept" bulk action that is
still an explicit, visible user action (not silent).

---

## D7: JWT payload is minimal (userId + email only)

**Decision:** The JWT contains only `userId` and `email`. No group
memberships, roles, or other claims.

**Options considered:**
- Rich JWT (userId, email, groupIds, roles) — fewer DB lookups per request
- Minimal JWT (chosen) — every route re-fetches membership/role from DB

**Why:** Group membership changes over time (that's the whole point of this
app — D3). If the JWT cached "user X is ADMIN of group Y" and X is later
removed from Y, X's existing token would still claim that membership until
it expires (up to 7 days). A minimal JWT means the token answers exactly one
question — "who is this" — and every permission check is always against
current data. The cost is an extra `GroupMembership` query on routes that
need it, which is negligible at this scale and is exactly the kind of
query the live session will ask us to point to.

---

## D8: Route protection is client-side redirect + backend requireAuth, not Next.js middleware

**Decision:** Protected pages (e.g. `/dashboard`) check `useAuth()` in a
`useEffect` and redirect to `/login` if there's no user. There is no
Next.js `middleware.ts` doing server-side route protection.

**Options considered:**
- Next.js middleware.ts intercepting requests to protected routes
- Client-side check + redirect (chosen), backend is the real gate

**Why:** The backend (`requireAuth` middleware on every API route) is the
actual security boundary — no API request succeeds without a valid cookie,
regardless of what the frontend does. The frontend redirect is purely a UX
nicety ("don't show an empty dashboard to a logged-out user"). Adding
Next.js middleware that ALSO checks auth would be a second place implementing
the same rule, and since the frontend can't verify the JWT signature
without sharing JWT_SECRET with the frontend (which we don't want to do),
middleware would just be checking "does a token cookie exist", a much
weaker check that could create a false sense of security if someone assumed
it was the real gate.

**Tradeoff accepted:** A logged-out user briefly sees a "Loading..." state
on protected pages before the redirect fires, instead of being blocked at
the routing layer. Acceptable for an internal household app.

---

## D10: Group creator automatically becomes ADMIN

**Decision:** When `createGroup` runs, it opens a Prisma transaction that
creates the Group row AND a GroupMembership row for the creator with
`role = ADMIN`. The creator is never a plain MEMBER.

**Options considered:**
- Creator = MEMBER, require a separate "promote to admin" step
- Creator = ADMIN automatically (chosen)

**Why:** A group with no admin is immediately unusable — no one can add
members, rename it, or manage anything. The only reason to defer admin
assignment would be if a super-admin (outside the group) managed membership
from above; that's not this app's model. Every group must have at least one
admin from the moment it exists. Making the creator the first admin is the
only sensible default, and it's what every comparable app (Slack, Google
Groups, WhatsApp) does.

**Tradeoff accepted:** The creator might not be the "right" long-term admin
(e.g. they created the group on behalf of someone else). They can add another
member and — when a "promote to admin" endpoint is built — hand off the role.
For Module 3 scope, all admins are equal and there's no demotion endpoint;
that's Module 4+ territory.

---

## D11: `isActiveMember` lives in `lib/membership.ts`, not in the group service

**Decision:** The membership validity query is extracted to
`backend/src/lib/membership.ts`, separate from `group.service.ts`.

**Options considered:**
- Put `isActiveMember` inside `group.service.ts` as a named export
- Separate file under `lib/` (chosen)

**Why:** Modules 4, 5, and 6 all need this function but have no reason to
depend on the entire group service (which includes CRUD operations, role
checks, etc.). Importing `isActiveMember` from `lib/membership.ts` is a
narrow, explicit dependency — the import statement alone tells the reader
"this file needs to check membership dates". Putting it in the service would
create a coupling where the expense service depends on the group service,
which depends on the expense service (via foreign key checks) — a potential
circular import. `lib/` is stateless utility territory; `services/` is
feature territory.

**Tradeoff accepted:** Two files for membership-related code instead of one.
The split is: `lib/membership.ts` = database query only; `group.service.ts`
= business operations that happen to use membership queries. The distinction
is clear in the "WHY THIS FILE EXISTS" comment of each file.

---

## D12: Admins cannot end their own membership via the normal endpoint

**Decision:** `endMembership()` throws `CannotEndOwnMembershipError` if
`requesterId === targetUserId`, even if the requester is an admin.

**Options considered:**
- Allow self-removal: admin can end their own membership freely
- Require admin transfer first if you're the last admin, then allow self-removal
- Block self-removal entirely via this endpoint (chosen)

**Why:** Self-removal by an admin has two failure modes: (1) they're the last
admin — the group becomes permanently unmanageable; (2) they're not the last
admin — this case is technically safe but confusing UX ("why can I remove
others but not myself from my own group?"). Rather than adding a conditional
("allow it if there's another admin, block if last admin") that requires an
extra DB query and produces two different error messages for the same UI
action, we block it entirely. The correct flow is: promote another member to
admin, then have that admin remove the original one (or just let the original
admin leave their membership open). This is documented in the error message.

**Tradeoff accepted:** Slightly less convenient for admins who want to leave
a group they created. Acceptable — the promote-then-remove flow is clear and
safe. A future "leave group" endpoint (Module 7+) could handle this with its
own last-admin check logic in one place.

---

## D9: No server-side token blocklist on logout

**Decision:** "Logout" clears the httpOnly cookie. The JWT itself is not
invalidated server-side and remains cryptographically valid until its
natural expiry (7 days).

**Options considered:**
- Maintain a blocklist table of revoked token IDs, checked on every request
- Clear the cookie only (chosen)

**Why:** A blocklist requires a DB write on every logout and a DB read on
every authenticated request (defeating part of the point of JWTs being
self-contained), for a threat model (someone has already stolen your JWT
out of an httpOnly cookie, which requires either physical device access or
a server-side compromise) that's disproportionate for a household expenses
app. Documented here as a known, accepted limitation rather than silently
omitted.

---

## D13: Normalized Import Schema (ImportJob, ImportRow, ImportAnomaly, ImportDecision, ImportReport)

**Decision:** Shifted the CSV staging database layout from generic JSON columns in a single table to five fully normalized relational tables: `ImportJob`, `ImportRow`, `ImportAnomaly`, `ImportDecision`, and `ImportReport`.

**Options considered:**
- Storing anomalies and user decisions as complex JSON arrays within a single `ImportStagingRow` table.
- Fully normalized relational schema (chosen).

**Why:** Surfacing 17 different anomalies and tracking independent user decisions (e.g. mapping aliases, marking duplicates, adjusting values) in raw JSON strings makes backend querying and frontend rendering fragile and highly prone to validation failures. A normalized schema guarantees strict typing, clean index lookups, separate audit trails, and lets us query counts (e.g. total unresolved errors) via standard Prisma relationship queries rather than manual JSON scans.

---

## D14: Duplicate & Near-Duplicate Check Heuristics

**Decision:** Implemented a two-tiered check:
1. **Intra-Job duplicates:** Scan rows inside the same CSV upload by comparing dates, amounts, and fuzzy string similarity on descriptions (Levenshtein distance).
2. **Inter-Job duplicates:** Query existing committed `Expense` rows in the database for the same group matching date and amount values.

**Why:** Prevents users from accidentally double-importing expenses (either because of double entries in the file itself or running imports twice). Fuzzy string matching catches near-duplicates (e.g., "Dinner Thalassa" vs "Thalassa dinner") where amount/date match but texts differ.

---

## D15: Atomic Transactional Commits

**Decision:** All staged rows within an `ImportJob` are written to the live `Expense`, `ExpenseSplit`, and `Settlement` tables within a single, atomic database transaction (`prisma.$transaction`).

**Why:** If an import contains 40 rows and commits 39 successfully but fails on the last row due to a database constraint or server error, a non-atomic commit would leave the database in a partially-imported corrupt state. Running inside a transaction ensures that the import is committed fully or aborted entirely with no side-effects.


