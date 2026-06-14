// backend/src/index.ts
//
// WHY THIS FILE EXISTS:
// This is the single entrypoint for the backend server. It wires up global
// middleware (CORS, JSON body parsing, cookie parsing) and mounts route
// modules. Each feature module (auth, groups, expenses, import, ...) gets
// its own file under src/routes/ and is mounted here with app.use(). This
// keeps the entrypoint short and makes "where does X live" easy to answer:
// it's either in this file (global concerns) or in src/routes/<feature>.ts
// (feature-specific).
//
// The /health route exists purely so we can verify the server + DB are up
// during deployment, independent of any feature being finished.

// dotenv.config() runs first, before any other import, because lib/jwt.ts
// reads process.env.JWT_SECRET at module-load time (failing fast if it's
// missing). TypeScript compiles `import` to `require()` in source order, so
// placing this import + call first guarantees env vars are loaded before
// jwt.ts's module-level check runs.
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { prisma } from "./lib/prisma";
import authRouter from "./routes/auth.routes";
import groupRouter from "./routes/group.routes";
import importRouter from "./routes/import.routes";
import memberMappingRouter from "./routes/memberMapping.routes";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
    credentials: true, // required so the browser sends the JWT httpOnly cookie
  })
);
app.use(express.json());
app.use(cookieParser());

// Basic liveness + DB connectivity check. Not authenticated — intentionally
// public, used for deployment health checks.
app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", db: "unreachable" });
  }
});

// ---------------------------------------------------------------------------
// Route modules
// ---------------------------------------------------------------------------
app.use("/api/auth", authRouter);
app.use("/api/groups", groupRouter); // Module 3: Groups + Dynamic Membership
app.use("/api/groups/:groupId/imports", importRouter);          // Module 5: CSV Import Engine
app.use("/api/groups/:groupId/imports/:jobId/mapping", memberMappingRouter); // Member Mapping Workflow


// Module 4 (Expenses) will add: app.use("/api/expenses", expensesRouter);
// ...and so on.
// ---------------------------------------------------------------------------

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});

export default app;
