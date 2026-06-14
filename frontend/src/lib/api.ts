// frontend/src/lib/api.ts
//
// WHY THIS FILE EXISTS:
// Every request from the frontend to the backend goes through `apiFetch`.
// This is the ONE place that:
//   1. Sets the backend base URL
//   2. Sets `credentials: "include"` — REQUIRED for the httpOnly auth
//      cookie to be sent on cross-origin requests (frontend on :3000,
//      backend on :4000 during local dev)
//   3. Parses JSON responses and throws a normalized ApiError on non-2xx,
//      so calling code doesn't repeat try/catch + res.ok checks everywhere
//
// If asked "how does the frontend authenticate its requests", the answer
// is: it doesn't, explicitly — the browser attaches the cookie
// automatically because of `credentials: "include"` here + `cors({
// credentials: true })` on the backend (index.ts).

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_BASE_URL) {
  console.warn("NEXT_PUBLIC_API_URL is not defined! API requests will fail.");
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(body?.error ?? "Request failed", res.status, body?.details);
  }

  return body as T;
}

// =============================================================================
// GROUP API — Module 3
// =============================================================================
// Typed wrappers around apiFetch for all group + membership endpoints.
// Each function maps 1:1 to a backend route. Keeping them here means the
// rest of the frontend never hard-codes a URL string — if a route changes,
// fix it here and every page gets the update automatically.
// =============================================================================

export interface GroupSummary {
  id: string;
  name: string;
  createdAt: string;
  memberCount: number;
  myRole: "ADMIN" | "MEMBER";
}

export interface GroupMember {
  membershipId: string;
  userId: string;
  displayName: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  joinedAt: string;
  leftAt: string | null;
}

export interface GroupDetail {
  id: string;
  name: string;
  createdAt: string;
  myRole: "ADMIN" | "MEMBER";
  currentMembers: GroupMember[];
  pastMembers: GroupMember[];
}

/** POST /api/groups — create a new group */
export async function createGroup(name: string): Promise<{ group: { id: string; name: string } }> {
  return apiFetch("/api/groups", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

/** GET /api/groups — list groups the current user belongs to */
export async function listGroups(): Promise<{ groups: GroupSummary[] }> {
  return apiFetch("/api/groups");
}

/** GET /api/groups/:groupId — get full group detail */
export async function getGroup(groupId: string): Promise<{ group: GroupDetail }> {
  return apiFetch(`/api/groups/${groupId}`);
}

/** PATCH /api/groups/:groupId — rename a group (admin only) */
export async function renameGroup(
  groupId: string,
  name: string
): Promise<{ group: { id: string; name: string } }> {
  return apiFetch(`/api/groups/${groupId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

/** POST /api/groups/:groupId/members — add a member by email (admin only) */
export async function addGroupMember(
  groupId: string,
  email: string,
  joinedAt?: string,
  leftAt?: string
): Promise<{ member: GroupMember }> {
  return apiFetch(`/api/groups/${groupId}/members`, {
    method: "POST",
    body: JSON.stringify({
      email,
      ...(joinedAt ? { joinedAt } : {}),
      ...(leftAt ? { leftAt } : {}),
    }),
  });
}

/** PATCH /api/groups/:groupId/members/:userId/end — end a membership (admin only) */
export async function endGroupMembership(
  groupId: string,
  userId: string,
  leftAt: string
): Promise<{ membership: { id: string; leftAt: string } }> {
  return apiFetch(`/api/groups/${groupId}/members/${userId}/end`, {
    method: "PATCH",
    body: JSON.stringify({ leftAt }),
  });
}

/** PATCH /api/groups/:groupId/members/:userId — edit a membership (admin only) */
export async function editGroupMember(
  groupId: string,
  userId: string,
  joinedAt: string,
  leftAt?: string
): Promise<{ membership: { id: string; joinedAt: string; leftAt: string | null } }> {
  return apiFetch(`/api/groups/${groupId}/members/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ joinedAt, leftAt: leftAt || null }),
  });
}

// =============================================================================
// IMPORT API — CSV Import Engine
// =============================================================================

export type AnomalyType =
  | "MISSING_FIELD"
  | "INVALID_DATE"
  | "FUTURE_DATE"
  | "ZERO_OR_NEGATIVE_AMOUNT"
  | "INVALID_AMOUNT_FORMAT"
  | "AMOUNT_TOO_HIGH"
  | "UNKNOWN_CURRENCY"
  | "UNKNOWN_PAYER"
  | "PAYER_NOT_IN_GROUP"
  | "UNKNOWN_SPLIT_PARTICIPANT"
  | "PARTICIPANT_NOT_IN_GROUP"
  | "PARTICIPANT_NOT_ACTIVE_ON_DATE"
  | "INVALID_SPLIT_TYPE"
  | "SPLIT_SHARES_DONT_SUM"
  | "PAYER_NOT_IN_SPLIT"
  | "POTENTIAL_DUPLICATE"
  | "UNRECOGNIZED_NAME";

export type AnomalySeverity = "ERROR" | "WARNING" | "INFO";
export type ImportJobStatus = "PROCESSING" | "AWAITING_MAPPING" | "IN_REVIEW" | "READY" | "COMMITTED" | "FAILED";
export type ImportRowStatus = "PENDING" | "CLEAN" | "RESOLVED" | "EXCLUDED" | "COMMITTED";
export type AnomalyResolution =
  | "ACCEPT_AS_IS"
  | "ACCEPT_SUGGESTED"
  | "OVERRIDE_WITH_CORRECTION"
  | "EXCLUDE_ROW"
  | "MARK_AS_DUPLICATE_OF"
  | "IGNORE_WARNING";

export interface ImportAnomaly {
  id: string;
  anomalyType: AnomalyType;
  severity: AnomalySeverity;
  rowNumber: number;
  description: string;
  suggestedAction: string | null;
}

export interface ImportDecision {
  id: string;
  resolution: AnomalyResolution;
  decisionDetails: Record<string, unknown>;
  resolvedAt: string;
}

export interface ImportRow {
  id: string;
  rowNumber: number;
  rawData: Record<string, string>;
  status: ImportRowStatus;
  anomalies: ImportAnomaly[];
  decisions: ImportDecision[];
}

export interface ImportReport {
  totalRows: number;
  cleanRows: number;
  anomaliesCount: number;
  resolvedCount: number;
  excludedCount: number;
  duplicatesCount: number;
}

export interface ImportJob {
  id: string;
  groupId: string;
  fileName: string;
  status: ImportJobStatus;
  totalRows: number;
  createdAt: string;
  committedAt: string | null;
  participantNames: string[] | null;
  mappingComplete: boolean;
  rows: ImportRow[];
  report: ImportReport | null;
}

/** POST /api/groups/:groupId/imports — upload and stage a CSV */
export async function uploadImportCsv(
  groupId: string,
  fileName: string,
  csvContent: string
): Promise<{ job: ImportJob; requiresMapping: boolean }> {
  return apiFetch(`/api/groups/${groupId}/imports`, {
    method: "POST",
    body: JSON.stringify({ fileName, csvContent }),
  });
}

/** GET /api/groups/:groupId/imports/:jobId — get import job detail */
export async function getImportJob(
  groupId: string,
  jobId: string
): Promise<{ job: ImportJob }> {
  return apiFetch(`/api/groups/${groupId}/imports/${jobId}`);
}

/** POST /api/groups/:groupId/imports/:jobId/rows/:rowId/resolve — submit a decision */
export async function resolveImportRow(
  groupId: string,
  jobId: string,
  rowId: string,
  resolution: AnomalyResolution,
  decisionDetails?: Record<string, unknown>
): Promise<{ rowId: string; status: string }> {
  return apiFetch(`/api/groups/${groupId}/imports/${jobId}/rows/${rowId}/resolve`, {
    method: "POST",
    body: JSON.stringify({ resolution, decisionDetails: decisionDetails ?? {} }),
  });
}

/** POST /api/groups/:groupId/imports/:jobId/commit — commit approved rows */
export async function commitImport(
  groupId: string,
  jobId: string
): Promise<{ success: boolean; report: ImportReport }> {
  return apiFetch(`/api/groups/${groupId}/imports/${jobId}/commit`, {
    method: "POST",
  });
}

// =============================================================================
// MEMBER MAPPING API
// =============================================================================

export type CsvMappingStatus = "PENDING" | "MAPPED" | "AUTO_MAPPED" | "IGNORED";
export type MappingAction = "MAP" | "CREATE_PLACEHOLDER" | "IGNORE";

export interface MappingSuggestion {
  groupMemberId: string;
  displayName: string;
  confidence: number;
}

export interface ParticipantMapping {
  csvName: string;
  status: CsvMappingStatus;
  suggestion: MappingSuggestion | null;
}

export interface CsvGroupMember {
  id: string;
  groupId: string;
  userId: string | null;
  displayName: string;
  hasAccount: boolean;
  isPlaceholder: boolean;
  user: { email: string } | null;
  joinedAt: string | null;
  leftAt: string | null;
}

export interface MappingDecision {
  csvName: string;
  action: MappingAction;
  groupMemberId?: string;   // for MAP
  displayName?: string;     // for CREATE_PLACEHOLDER
}

export interface MappingStatusResponse {
  jobId: string;
  jobStatus: string;
  participants: ParticipantMapping[];
  totalCount: number;
  pendingCount: number;
}

/** GET /api/groups/:groupId/imports/:jobId/mapping */
export async function getMappingStatus(
  groupId: string,
  jobId: string
): Promise<MappingStatusResponse> {
  return apiFetch(`/api/groups/${groupId}/imports/${jobId}/mapping`);
}

/** GET /api/groups/:groupId/imports/:jobId/mapping/members */
export async function getMappingMembers(
  groupId: string,
  jobId: string
): Promise<{ members: CsvGroupMember[] }> {
  return apiFetch(`/api/groups/${groupId}/imports/${jobId}/mapping/members`);
}

/** POST /api/groups/:groupId/imports/:jobId/mapping/submit */
export async function submitMappingDecisions(
  groupId: string,
  jobId: string,
  decisions: MappingDecision[]
): Promise<{ success: boolean; pendingCount: number }> {
  return apiFetch(`/api/groups/${groupId}/imports/${jobId}/mapping/submit`, {
    method: "POST",
    body: JSON.stringify({ decisions }),
  });
}
