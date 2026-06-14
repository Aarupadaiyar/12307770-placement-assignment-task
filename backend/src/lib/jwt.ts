// backend/src/lib/jwt.ts
//
// WHY THIS FILE EXISTS:
// All JWT signing and verification happens through these two functions.
// If you're asked "what's in the token" or "where does the token get
// checked", this file and auth.middleware.ts (which calls verifyToken)
// are the two answers.
//
// PAYLOAD SHAPE: deliberately minimal — userId and email only. No group
// memberships, no roles. This was a conscious choice (see DECISIONS.md D7):
// memberships can change (a user can be removed from a group, or a new
// membership can start) and we never want a stale JWT to carry outdated
// permission info. Every route that needs membership/role info queries
// GroupMembership fresh from the DB. The token's only job is "prove this
// request is from user X".

import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";

if (!JWT_SECRET) {
  // Fail loudly at startup rather than silently signing tokens with
  // `undefined` as the secret (which would be a security hole).
  throw new Error("JWT_SECRET is not set. Copy backend/.env.example to .env and set it.");
}

export interface JwtPayload {
  userId: string;
  email: string;
}

/**
 * Sign a new JWT for the given user. Called once, at login/register time.
 */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: JWT_EXPIRES_IN as any });
}

/**
 * Verify and decode a JWT. Throws if invalid/expired — callers (the auth
 * middleware) catch this and respond with 401.
 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET as string) as JwtPayload;
}
