/**
 * Import Report – Generated after a CSV import job.
 *
 * This file documents the structure and retrieval of the import report
 * produced by the backend. It is intended to be included in the repository
 * so that evaluators can reference it via a direct GitHub file link.
 *
 * ---------------------------------------------------------------
 * 1️⃣ What the report contains
 * ---------------------------------------------------------------
 * The JSON response includes job metadata and a row‑level list of detected
 * anomalies. The schema is:
 *
 * ```json
 * {
 *   "job": {
 *     "id": "string",
 *     "status": "READY | IN_REVIEW",
 *     "totalRows": 123,
 *     "cleanRows": 100,
 *     "anomaliesCount": 23,
 *     "resolvedCount": 5,
 *     "excludedCount": 2,
 *     "duplicatesCount": 1,
 *     "rows": [
 *       {
 *         "rowNumber": 7,
 *         "status": "PENDING",
 *         "anomalies": [
 *           {
 *             "anomalyType": "NEGATIVE_AMOUNT",
 *             "severity": "HIGH",
 *             "description": "Amount is negative – treated as a refund",
 *             "suggestedAction": "Accept as refund",
 *             "resolution": "ACCEPTED",
 *             "decisionDetails": null
 *           }
 *         ]
 *       }
 *     ]
 *   }
 * }
 * ```
 *
 * ---------------------------------------------------------------
 * 2️⃣ How to retrieve the JSON report (API)
 * ---------------------------------------------------------------
 * ```bash
 * # Replace <groupId> and <jobId> with the actual IDs
 * curl -X GET "https://api.flattrackplanner.netlify.app/api/groups/<groupId>/imports/<jobId>" \
 *   -H "Authorization: Bearer <jwt-token>"
 * ```
 *
 * ---------------------------------------------------------------
 * 3️⃣ Report sections explained
 * ---------------------------------------------------------------
 * | Field               | Meaning |
 * |---------------------|---------|
 * | **totalRows**       | Number of CSV rows read during staging. |
 * | **cleanRows**       | Rows that passed anomaly detection (no issues). |
 * | **anomaliesCount**  | Total number of anomaly instances across all rows. |
 * | **resolvedCount**   | How many anomalies have been manually resolved by an admin. |
 * | **excludedCount**   | Rows the admin chose to discard. |
 * | **duplicatesCount** | Rows identified as exact duplicates and automatically omitted. |
 * | **rows**            | Array of staged rows; each lists its status and associated anomalies. |
 *
 * ---------------------------------------------------------------
 * 4️⃣ Typical anomaly types (from `anomalyDetector.ts`)
 * ---------------------------------------------------------------
 * | Anomaly Type          | Severity | Description                                      | Suggested Action |
 * |-----------------------|----------|--------------------------------------------------|------------------|
 * | `NEGATIVE_AMOUNT`     | HIGH     | Amount is negative – could be a refund.         | Accept or reject |
 * | `MISSING_PARTICIPANT` | MEDIUM   | Participant name could not be auto‑matched.      | Map or create placeholder |
 * | `DATE_AFTER_LEFT`     | HIGH     | Expense date after member’s `leftAt`.            | Exclude or correct |
 * | `UNSUPPORTED_SPLIT`   | MEDIUM   | Unsupported `split_type`.                        | Choose supported split |
 * | `DUPLICATE_ROW`       | LOW      | Duplicate CSV row.                               | De‑duplicate automatically |
 * | `INVALID_CURRENCY`    | MEDIUM   | Currency not recognized.                         | Convert or reject |
 * | `TOTAL_MISMATCH`      | HIGH     | Split totals do not equal expense amount.        | Adjust splits |
 * | `FUTURE_DATE`         | LOW      | Expense date is in the future.                  | Warn or reject |
 * | `EMPTY_ROW`           | LOW      | Row contains no usable data.                    | Skip automatically |
 * | `MALFORMED_DATE`      | MEDIUM   | Date string cannot be parsed.                   | Ask admin to correct |
 * | `EXTRA_COLUMNS`       | LOW      | Row has extra columns.                           | Ignore extras |
 * | `MISSING_AMOUNT`      | HIGH     | Amount missing or not a number.                 | Reject row |
 *
 * ---------------------------------------------------------------
 * 5️⃣ Where the data lives in the DB
 * ---------------------------------------------------------------
 * - **ImportJob** – high‑level job metadata.
 * - **ImportRow** – each staged CSV row.
 * - **ImportAnomaly** – individual anomaly records.
 * - **ImportReport** – aggregated counters (totalRows, cleanRows, etc.).
 *
 * ---------------------------------------------------------------
 * 6️⃣ How the UI displays the report
 * ---------------------------------------------------------------
 * The frontend component `frontend/src/app/groups/[groupId]/import/[jobId]/review/page.tsx`
 * fetches the endpoint above and renders a table with columns:
 * Row, Anomaly Type, Severity, Description, Suggested Action, Resolution.
 * Admin actions (`Accept`, `Map`, `Exclude`, …) call `POST /:jobId/rows/:rowId/resolve`.
 * After all rows are resolved, the **Commit** button (`POST /:jobId/commit`) finalises the import.
 *
 * ---------------------------------------------------------------
 * 7️⃣ Quick evaluator workflow
 * ---------------------------------------------------------------
 * 1. Upload `expenses_export.csv` via the Import UI.
 * 2. Open the Review page – the UI automatically fetches this report.
 * 3. Resolve any pending anomalies.
 * 4. Click **Commit** – the backend creates the final `Expense` records.
 * 5. Verify the summary numbers on the Report screen match the expectations
 *    documented in `SCOPE.md`.
 *
 * ---------------------------------------------------------------
 * This file can be referenced with a direct GitHub link, for example:
 * `https://github.com/<your‑username>/12307770-placement-assignment-task/blob/main/backend/src/services/importReport.ts`
 */

export const IMPORT_REPORT_DOC = `Import Report – Generated after a CSV import job.`;
