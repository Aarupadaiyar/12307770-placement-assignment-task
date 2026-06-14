// backend/src/middleware/auth.middleware.ts
//
// WHY THIS FILE EXISTS:
// Every protected route (everything from Module 3 onward) calls
// `requireAuth` as middleware. It is the ONE place that:
//   1. Reads the JWT from the httpOnly cookie
//   2. Verifies it
//   3. Attaches `req.userId` / `req.userEmail` for the route handler to use
//
// If asked "how does the app know who's making this request" in the live
// session, the answer is: this file, and the cookie set in
// auth.routes.ts on login/register.
//
// WHY A COOKIE, NOT A BEARER HEADER:
// httpOnly cookies can't be read by JavaScript (protects against XSS token
// theft), and the browser sends them automatically with every request to
// the API origin (with `credentials: true` configured on both the cookie
// and the frontend's fetch calls, and CORS configured to allow credentials
// — see index.ts). This means the frontend never has to manually attach
// an Authorization header.

import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";

// Extend Express's Request type so `req.userId` is type-checked everywhere
// it's used, instead of `(req as any).userId`.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

const TOKEN_COOKIE_NAME = "token";

/**
 * Middleware: requires a valid JWT cookie. On success, sets req.userId and
 * req.userEmail and calls next(). On failure, responds 401 and does NOT
 * call next() — the route handler never runs.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[TOKEN_COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const payload = verifyToken(token);
    req.userId = payload.userId;
    req.userEmail = payload.email;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

export const AUTH_COOKIE_NAME = TOKEN_COOKIE_NAME;
