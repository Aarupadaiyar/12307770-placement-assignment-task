# SCOPE.md

This document has two parts:
1. **Anomaly log** — every data problem found in `Expenses_Export.csv`, how
   the importer detects it, and the policy applied.
2. **Database schema** — entity overview and relationships (also see inline
   comments in `backend/prisma/schema.prisma`, which is the source of truth).

---

## Part 1: Anomaly Log

Each row below maps to an `AnomalyType` enum value (see `shared/index.ts`).
"Policy" describes what the importer proposes; because the import flow is
single-phase row-by-row review (see DECISIONS.md, D6), the user must still
accept/edit/reject every proposal — nothing here is auto-applied silently.

| # | AnomalyType | CSV row(s) | Detection rule | Proposed policy |
|---|---|---|---|---|
| 1 | `DUPLICATE_SUSPECTED` | "Dinner at Marina Bites" (Dev, 3200, 08-02) vs "dinner - marina bites" (Dev, 3200, 08-02) | Same date + payer + amount, similar description (case/punctuation-insensitive match) | Flag both rows as a suspected duplicate pair. User picks: import one, import both (if legitimately two separate dinners), or merge. |
| 2 | `DUPLICATE_SUSPECTED` (conflicting amounts) | "Dinner at Thalassa" (Aisha, 2400, 11-03) vs "Thalassa dinner" (Rohan, 2450, 11-03) | Same date, similar description, DIFFERENT payer and amount | Flag as conflicting duplicate. No auto-pick — user must choose which (if either) to keep, since amounts differ and we cannot guess which is correct. |
| 3 | `AMOUNT_FORMAT_FIX` | Electricity Feb, amount = `"1,200"` | Amount field contains a comma | Strip thousands separator → 1200.00. Proposed as a formatting fix; still requires user accept click. |
| 4 | `AMOUNT_PRECISION_FIX` | Cylinder refill, amount = `899.995` | Amount has more than 2 decimal places | Round to 2 decimals using standard rounding (899.995 → 900.00). Shown to user with both original and rounded value. |
| 5 | `MISSING_PAYER` | House cleaning supplies, paid_by = empty | `paid_by` field is empty | Cannot default — held for manual resolution. User must either assign a payer or exclude the row. |
| 6 | `SETTLEMENT_MISCLASSIFIED` | "Rohan paid Aisha back", 5000, split_type empty, split_with = "Aisha" | `split_type` empty AND `split_with` is a single name AND description matches a payment-like pattern ("paid X back") | Propose reclassifying as a `Settlement` (fromUser=Rohan, toUser=Aisha, amount=5000) instead of an `Expense`. User confirms before commit. |
| 7 | `PERCENTAGE_SUM_MISMATCH` | "Pizza Friday" (30+30+30+20=110%); "Weekend brunch" (30+30+30+20=110%) | `split_type=percentage` and sum of percentages in `split_details` ≠ 100 | Propose normalizing: each percentage ÷ sum × 100 (e.g. 30/110 ≈ 27.27%). Original and normalized values both shown. |
| 8 | `FOREIGN_CURRENCY` | Goa villa booking (540 USD), Beach shack lunch (84 USD), Parasailing (150 USD), Parasailing refund (-30 USD) | `currency = USD` | Fetch historical USD→INR rate for the expense date; store `amountInr`, `fxRateToInr`, `fxRateDate`. User sees both original (USD) and converted (INR) amounts before accepting. |
| 9 | `NEGATIVE_AMOUNT` | Parasailing refund, amount = -30 USD | `amount < 0` | Treat as a legitimate refund (not an error). Imported as its own Expense with negative ExpenseSplit amounts, reducing each participant's balance. Not auto-linked to the original Parasailing expense (too fragile to match programmatically) — both exist as separate, traceable rows. |
| 10 | `MISSING_CURRENCY` | Groceries DMart 15-03, currency = empty | `currency` field empty | Default to group's base currency (INR) — explicit in the row's own note ("forgot to set currency"). User confirms. |
| 11 | `AMBIGUOUS_DATE` | `Mar-14` (Airport cab); `04-05-2026` (Deep cleaning, note: "is this April 5 or May 4?") | Date doesn't match the dominant `DD-MM-YYYY` format seen elsewhere in the file, OR is explicitly flagged ambiguous in notes | `Mar-14` → parsed as 14-03-2026 (matches surrounding date sequence, only one valid interpretation). `04-05-2026` → both interpretations (4 May vs 5 Apr... actually 04-05 → either 4-May or 5-Apr) computed and shown; user must pick. Default suggestion = DD-MM-YYYY (5-Apr-2026) for consistency with the rest of the file, but NOT auto-applied given the row explicitly calls out the ambiguity. |
| 12 | `NAME_ALIAS_UNRESOLVED` | "priya" (lowercase), "Priya S", "rohan " (trailing space) | Name in `paid_by`/`split_with` doesn't exact-match an existing canonical User or UserAlias | Propose a mapping (e.g. "priya" → Priya, fuzzy-matched). User confirms or remaps to a different user. Once confirmed, stored permanently in `UserAlias` so it's never asked again. |
| 13 | `NON_MEMBER_IN_SPLIT` | Parasailing, split_with includes "Dev's friend Kabir" | A name in `split_with` cannot be resolved to any group member (even via alias) and doesn't look like a data-entry variant of an existing member | Kabir is excluded from the split; remaining participants' shares are recomputed over the smaller group. Flagged explicitly: "Kabir is not a tracked user — his share of this expense is not recorded anywhere." |
| 14 | `MEMBER_INACTIVE_ON_DATE` | Groceries BigBasket 02-04-2026, split_with includes Meera (who left end of March) | A name in `split_with` resolves to a real user, but that user's `GroupMembership` shows them inactive (left before the expense date) | Meera is excluded from this split; her share is redistributed among the remaining (active) participants. Flagged: "Meera was not an active member on 02-04-2026 (left 28-03-2026) — excluded from this split per group membership rules." |
| 15 | `SPLIT_METADATA_MISMATCH` | "Furniture for common room" — split_type=equal but split_details has "Aisha 1; Rohan 1; Priya 1; Sam 1" | `split_type=equal` but `split_details` is non-empty | Flagged for visibility. Since the shares listed (1;1;1;1) are themselves equal, the equal split is computed normally and `split_details` is ignored — but the mismatch is surfaced so the user knows `split_details` was present and disregarded. |
| 16 | `ZERO_AMOUNT` | "Dinner order Swiggy", amount = 0, note "counted twice earlier - fixing later" | `amount == 0` | Imported as a zero-value Expense (preserves audit trail, per Meera's "show me everything"). No balance impact. Flagged so user understands why a ₹0 expense exists. |
| 17 | `PAYER_NOT_YET_MEMBER` | "Sam deposit share" 08-04-2026, paid_by=Sam, split_with=Aisha (Sam not yet a GroupMembership row at this point) | `paid_by` resolves to a user with no active `GroupMembership` covering the expense date | Flagged: "Sam is not yet recorded as a group member on this date." Since this expense is itself evidence Sam is joining, the proposed resolution is to confirm/create Sam's `GroupMembership` with `joinedAt` ≤ this date as part of resolving this row. |

**Total: 17 distinct anomalies detected** across the 40 data rows (the
assignment states "at least 12" — this list exceeds that, several rows
trigger more than one anomaly type, e.g. the Airport cab row has both an
ambiguous date AND a name-casing issue ("rohan ")).

---

## Part 2: Database Schema

See `backend/prisma/schema.prisma` for the full, commented source of truth.
Summary of entities and relationships:

```
User ──┬── GroupMembership ──── Group
       │     (joinedAt, leftAt nullable — full history)
       │
       ├── UserAlias (raw CSV name strings → canonical User)
       │
       ├── Expense (paidBy)
       │     └── ExpenseSplit (one row per participant; amount owed)
       │
       ├── Settlement (fromUser / toUser — separate from Expense)
       │
       └── AuditLog (append-only action history)

Group ──┬── Expense
        ├── Settlement
        └── ImportJob
              ├── ImportRow (individual CSV records staged)
              │     ├── ImportAnomaly (zero or more detected data flags)
              │     └── ImportDecision (user-configured overrides/decisions)
              └── ImportReport (aggregated summary stats generated)
```

Key relationships explained:
- **GroupMembership** is the only place "is this user active in this group right now / on date D" is answered — via `joinedAt <= D AND (leftAt IS NULL OR leftAt >= D)`.
- **ExpenseSplit** is the unit of traceability: every balance figure shown to a user is a sum of `ExpenseSplit.amount` rows (plus netted `Settlement` rows), and the app can always list those underlying rows.
- **ImportRow** never feeds `Expense`/`ExpenseSplit`/`Settlement` directly — only via the "Commit Import" transaction step, after every staging row has been resolved or excluded.

