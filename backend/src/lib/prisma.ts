// backend/src/lib/prisma.ts
//
// WHY THIS FILE EXISTS:
// Every file that needs database access imports `prisma` from here, rather
// than doing `new PrismaClient()` itself. Two reasons:
//
// 1. In development, ts-node-dev restarts the process on file changes, which
//    can create many PrismaClient instances and exhaust Postgres connections
//    if each module instantiates its own. This pattern (a single shared
//    instance, cached on `global` in dev) is Prisma's documented fix.
//
// 2. It gives us ONE place to add logging/middleware to all queries later
//    (e.g. for the audit log in Module 8) without touching every route file.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
