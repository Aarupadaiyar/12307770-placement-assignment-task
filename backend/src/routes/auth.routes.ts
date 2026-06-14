// backend/src/routes/auth.routes.ts
//
// WHY THIS FILE EXISTS:
// Defines the four auth endpoints. Each handler follows the same shape:
// validate input (Zod) -> call service layer -> respond. The service layer
// (auth.service.ts) does the actual work; this file's job is purely HTTP
// translation (status codes, cookie handling).
//
// ENDPOINTS:
//   POST /api/auth/register  - create account, log in immediately
//   POST /api/auth/login     - verify credentials, set session cookie
//   POST /api/auth/logout    - clear session cookie
//   GET  /api/auth/me        - return the current user (requires auth)

import { Router } from "express";
import { registerSchema, loginSchema } from "../validation/auth.validation";
import {
  registerUser,
  verifyCredentials,
  getUserById,
  EmailAlreadyExistsError,
  InvalidCredentialsError,
} from "../services/auth.service";
import { signToken } from "../lib/jwt";
import { requireAuth, AUTH_COOKIE_NAME } from "../middleware/auth.middleware";

const router = Router();

// Cookie options shared between login and register.
//
// httpOnly: true   -> JS on the frontend cannot read this cookie (XSS protection)
// sameSite: "lax"  -> sent on same-site requests and top-level navigations,
//                      blocks most CSRF vectors while still working for a
//                      frontend/backend on different ports during local dev
//                      (lax allows the cookie on normal navigation; for
//                      cross-site XHR/fetch with credentials, the browser
//                      still sends it as long as it's not "strict" — see
//                      note in DECISIONS.md about same-site deployment)
// secure: true in production -> cookie only sent over HTTPS
// maxAge matches JWT_EXPIRES_IN (7 days, in ms)
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

/**
 * Helper to shape a User row for API responses — NEVER include
 * passwordHash. This is the single function that decides "what does the
 * frontend get to see about a user", used by register, login, and /me so
 * the shape can't drift between endpoints.
 */
function toPublicUser(user: { id: string; email: string; displayName: string; createdAt: Date }) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt,
  };
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  try {
    const user = await registerUser(parsed.data);
    const token = signToken({ userId: user.id, email: user.email });

    res.cookie(AUTH_COOKIE_NAME, token, COOKIE_OPTIONS);
    return res.status(201).json({ user: toPublicUser(user) });
  } catch (err) {
    if (err instanceof EmailAlreadyExistsError) {
      return res.status(409).json({ error: err.message });
    }
    console.error("Register error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  try {
    const user = await verifyCredentials(parsed.data);
    const token = signToken({ userId: user.id, email: user.email });

    res.cookie(AUTH_COOKIE_NAME, token, COOKIE_OPTIONS);
    return res.json({ user: toPublicUser(user) });
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      return res.status(401).json({ error: err.message });
    }
    console.error("Login error:", err);
    return res.status(500).json({ error: "Something went wrong" });
  }
});

// POST /api/auth/logout
//
// Clears the cookie. Note: this is "logout" in the sense of "the browser
// stops sending a valid token" — the JWT itself remains technically valid
// until its expiry if somehow replayed (e.g. stolen before logout). For an
// app this size we don't maintain a server-side token blocklist; documented
// as a known limitation in DECISIONS.md.
router.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, COOKIE_OPTIONS);
  return res.json({ ok: true });
});

// GET /api/auth/me
//
// Returns the currently authenticated user. Used by the frontend on page
// load to determine "is there a logged-in user, and who are they" — the
// frontend never decodes the JWT itself, it always asks this endpoint.
router.get("/me", requireAuth, async (req, res) => {
  const user = await getUserById(req.userId!);

  if (!user) {
    // Token was valid but the user no longer exists (e.g. deleted).
    res.clearCookie(AUTH_COOKIE_NAME, COOKIE_OPTIONS);
    return res.status(401).json({ error: "User not found" });
  }

  return res.json({ user: toPublicUser(user) });
});

export default router;
