# AI Usage & Failure Log

This document outlines the AI tools used during the development of the Shared Expenses App, the prompting strategies employed, and specific instances where the AI generated incorrect code or assumptions.

## AI Tools Used
- **Primary Tool:** Antigravity IDE (Agentic AI Coding Assistant)
- **Role:** Pair programming, automated full-stack code generation, database schema design, and algorithmic implementation (e.g. debt simplification).

## Prompt Strategies
1. **Iterative Planning (Planning Mode):** Provided the AI with full access to project requirements and forced it to produce a gap analysis and `implementation_plan.md` before writing code.
2. **Context Passing:** Passed relevant CSV anomaly lists and business requirements directly into the AI's context so it could infer database models (`Prisma`) natively.
3. **Strict Constraints:** Enforced rules like "Use relational DBs only" and "Do not edit the CSV directly".

---

## Concrete AI Failure Cases

### 1. Production API URL Bug
**What went wrong:** 
The AI-generated frontend code correctly utilized an `apiFetch` wrapper but statically fell back to `http://localhost:4000` if the environment variable was missing. In the production build, because Next.js bakes `NEXT_PUBLIC_` variables at build time, the frontend compiled down to using `localhost:4000` exclusively on the deployed Netlify app.

**How it was caught:** 
Discovered post-deployment by inspecting the browser's Network tab. Authentication and data fetching requests were failing because they were attempting to hit `localhost:4000/api/...` instead of the Render backend URL.

**What was changed:** 
The AI was instructed to completely remove the hardcoded fallback inside `frontend/src/lib/api.ts`. We then explicitly created `.env.production` and updated the Netlify build environment variables to strictly inject `https://flattrackplanner.onrender.com` as the `NEXT_PUBLIC_API_URL`.

### 2. Prisma / TypeScript Build Errors
**What went wrong:** 
During the implementation of the Expenses API and anomaly detection logic, the AI generated code that referenced Prisma enums (`SplitType.EXACT` and `SplitType.SHARES`) and attempted to perform direct arithmetic on `DecimalJsLike` types without invoking the `Prisma.Decimal` constructor correctly.

**How it was caught:** 
Caught when attempting to run `npm run build` locally to verify the backend compilation. The TypeScript compiler threw `TS2339` errors for non-existent properties on `SplitType` and `TS2345` for incompatible Decimal types.

**What was changed:** 
I reviewed the actual `schema.prisma` and corrected the enums to match the exact generated client (`SplitType.UNEQUAL` and `SplitType.SHARE`). Additionally, I explicitly casted the values using `new Prisma.Decimal()` in `expense.service.ts` to satisfy the strict Prisma Decimal runtime requirements.

### 3. Shared Package Runtime Failure
**What went wrong:** 
The AI originally configured the backend to import TypeScript source files directly from the sibling `shared` workspace package. While this worked in local development (using `ts-node` or equivalent), it completely crashed the backend in the production Node.js environment because Node cannot natively execute raw TypeScript (specifically `enum` syntax) in strip-only mode.

**How it was caught:** 
The Render deployment built successfully but immediately crashed on startup, emitting `SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]` in the production logs.

**What was changed:** 
The monorepo structure was refactored. I added a `tsconfig.json` to the `shared` workspace, compiled it to a `dist/` folder containing standard JavaScript and type definitions, and updated the `backend` package to depend on the compiled artifacts. Finally, the backend's build script was updated to ensure the shared package compiles *before* the backend builds (`npm run build --workspace=shared && tsc`).
