// backend/src/validation/import.validation.ts
import { z } from "zod";
import { AnomalyResolution } from "shared";

export const resolveAnomalySchema = z.object({
  resolution: z.nativeEnum(AnomalyResolution),
  decisionDetails: z.record(z.any()).optional(),
});

export const commitImportSchema = z.object({
  // No body requirements; confirms commit for the jobId URL param
});
