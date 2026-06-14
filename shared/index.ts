// shared/index.ts
//
// WHY THIS FILE EXISTS:
// Both the backend (Prisma models, API responses) and the frontend
// (forms, import review UI) need to agree on a fixed set of enums and
// shapes. If these are duplicated in two places, they will drift —
// e.g. the frontend's "split type" dropdown could fall out of sync
// with what the backend's import engine actually supports.
//
// This file is the single source of truth. The Prisma schema enums
// (Module 1) are written to MATCH these exactly. If you add a new
// split type, you change it here AND in schema.prisma AND run a
// migration — three places, deliberately, so nothing is "automatic
// magic". This is a tradeoff: less DRY, more explicit. For an app
// this size, explicit > DRY.

/**
 * Every split type that appears in the CSV (and that the importer
 * must support). Mapped directly from the assignment's CSV column
 * `split_type`.
 *
 * - EQUAL:      amount divided evenly among all participants
 * - PERCENTAGE: split_details gives each participant a % of the total
 * - SHARE:      split_details gives each participant a number of
 *               "shares" (e.g. Rohan=2 shares, Aisha=1 share); amount
 *               is divided proportionally to shares
 * - UNEQUAL:    split_details gives each participant an exact amount
 */
export enum SplitType {
  EQUAL = "EQUAL",
  PERCENTAGE = "PERCENTAGE",
  SHARE = "SHARE",
  UNEQUAL = "UNEQUAL",
}

/**
 * Currencies supported. The CSV only contains INR and USD (and one
 * row with a missing currency, defaulted to INR). We keep this as an
 * enum (not a free string) so the FX conversion logic has a closed
 * set of cases to handle.
 */
export enum Currency {
  INR = "INR",
  USD = "USD",
}

/**
 * Roles a user can have within a Group. Kept minimal — this is not a
 * permissions-heavy app. ADMIN can manage membership and approve
 * imports; MEMBER can create expenses and settlements.
 */
export enum GroupRole {
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
}

/**
 * The set of anomaly types the import engine can detect.
 */
export enum AnomalyType {
  DUPLICATE_EXPENSE = "DUPLICATE_EXPENSE",
  NEAR_DUPLICATE_EXPENSE = "NEAR_DUPLICATE_EXPENSE",
  NEGATIVE_AMOUNT = "NEGATIVE_AMOUNT",
  MISSING_PAYER = "MISSING_PAYER",
  INVALID_AMOUNT = "INVALID_AMOUNT",
  INVALID_DATE = "INVALID_DATE",
  UNKNOWN_MEMBER = "UNKNOWN_MEMBER",
  EXPENSE_BEFORE_MEMBER_JOINED = "EXPENSE_BEFORE_MEMBER_JOINED",
  EXPENSE_AFTER_MEMBER_LEFT = "EXPENSE_AFTER_MEMBER_LEFT",
  SETTLEMENT_LOGGED_AS_EXPENSE = "SETTLEMENT_LOGGED_AS_EXPENSE",
  CURRENCY_MISMATCH = "CURRENCY_MISMATCH",
  USD_CONVERSION_REQUIRED = "USD_CONVERSION_REQUIRED",
  SPLIT_MISMATCH = "SPLIT_MISMATCH",
  TOTAL_SPLIT_NOT_EQUAL_TO_AMOUNT = "TOTAL_SPLIT_NOT_EQUAL_TO_AMOUNT",
  UNKNOWN_SPLIT_TYPE = "UNKNOWN_SPLIT_TYPE",
  MISSING_CATEGORY = "MISSING_CATEGORY",
  INVALID_PARTICIPANT_LIST = "INVALID_PARTICIPANT_LIST",
}

/**
 * Anomaly severity categories.
 */
export enum AnomalySeverity {
  INFO = "INFO",
  WARNING = "WARNING",
  ERROR = "ERROR",
}

/**
 * The overall status of an import job.
 */
export enum ImportJobStatus {
  PROCESSING = "PROCESSING",
  AWAITING_MAPPING = "AWAITING_MAPPING",
  IN_REVIEW = "IN_REVIEW",
  READY = "READY",
  COMMITTED = "COMMITTED",
  FAILED = "FAILED",
}

/**
 * The resolution a user picks for a flagged anomaly row.
 */
export enum AnomalyResolution {
  ACCEPT_SUGGESTED = "ACCEPT_SUGGESTED",
  EDIT_AND_ACCEPT = "EDIT_AND_ACCEPT",
  EXCLUDE_ROW = "EXCLUDE_ROW",
  MARK_AS_DUPLICATE_OF = "MARK_AS_DUPLICATE_OF",
}

/**
 * Status of a single CSV name → GroupMember mapping decision.
 * Stored in CsvIdentity.resolution.
 */
export enum CsvMappingStatus {
  PENDING = "PENDING",       // admin has not yet made a decision
  MAPPED = "MAPPED",         // admin manually mapped to a GroupMember
  AUTO_MAPPED = "AUTO_MAPPED", // auto-resolved with high confidence
  IGNORED = "IGNORED",       // admin chose to ignore this CSV name
}

/**
 * Actions an admin can submit for each participant on the mapping screen.
 */
export enum MappingAction {
  MAP = "MAP",                          // map to an existing GroupMember
  CREATE_PLACEHOLDER = "CREATE_PLACEHOLDER", // create a new placeholder GroupMember
  IGNORE = "IGNORE",                    // ignore this CSV name
}
