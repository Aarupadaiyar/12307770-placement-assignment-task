// backend/src/services/auth.service.ts
//
// WHY THIS FILE EXISTS:
// Separates "how do we register/authenticate a user" (business logic) from
// "how do we handle the HTTP request/response" (auth.routes.ts). This means:
//   - The bcrypt hashing logic is in exactly one place
//   - If asked "what happens if two people register with the same email
//     at the same time", the answer is in this file (the unique constraint
//     on User.email + the P2002 error handling), not buried in route code
//   - This logic is unit-testable without spinning up Express

import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { Prisma } from "@prisma/client";

const SALT_ROUNDS = 10;

export class EmailAlreadyExistsError extends Error {
  constructor() {
    super("An account with this email already exists");
    this.name = "EmailAlreadyExistsError";
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}

/**
 * Create a new user with a hashed password.
 *
 * Throws EmailAlreadyExistsError if the email is taken — relies on the
 * `@unique` constraint on User.email in the schema as the source of truth
 * (so a race condition between two simultaneous registrations with the same
 * email is still caught at the DB level, not just by an earlier "does this
 * email exist" check which could have a TOCTOU gap).
 */
export async function registerUser(params: {
  email: string;
  password: string;
  displayName: string;
}) {
  const passwordHash = await bcrypt.hash(params.password, SALT_ROUNDS);

  try {
    const user = await prisma.user.create({
      data: {
        email: params.email.toLowerCase().trim(),
        passwordHash,
        displayName: params.displayName.trim(),
      },
    });
    return user;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new EmailAlreadyExistsError();
    }
    throw err;
  }
}

/**
 * Verify email + password. Returns the user if valid.
 *
 * Throws InvalidCredentialsError for BOTH "no such email" and "wrong
 * password" — deliberately the same error/message for both, so the API
 * doesn't leak which emails are registered (a common enumeration attack
 * vector).
 */
export async function verifyCredentials(params: { email: string; password: string }) {
  const user = await prisma.user.findUnique({
    where: { email: params.email.toLowerCase().trim() },
  });

  if (!user) {
    throw new InvalidCredentialsError();
  }

  const passwordMatches = await bcrypt.compare(params.password, user.passwordHash);
  if (!passwordMatches) {
    throw new InvalidCredentialsError();
  }

  return user;
}

/**
 * Fetch a user by ID, for the "/me" endpoint. Returns null if not found
 * (e.g. user was deleted but their JWT is still valid until expiry).
 */
export async function getUserById(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}
