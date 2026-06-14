// backend/src/validation/auth.validation.ts
//
// WHY THIS FILE EXISTS:
// Input validation lives here, separate from route handlers, so:
//   1. Validation rules are visible in one place (interview question:
//      "what are your password requirements?" → this file)
//   2. Route handlers stay short — they validate, then delegate to the
//      service layer, then respond.
//
// Zod schemas double as TypeScript types (via z.infer), so the validated
// shape and the TS type can never disagree.

import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Must be a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().min(1, "Display name is required").max(100),
});

export const loginSchema = z.object({
  email: z.string().email("Must be a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
