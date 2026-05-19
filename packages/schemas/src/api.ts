import { z } from "zod";
import { NonEmptyStringSchema } from "./domain.js";

export const ApiErrorSchema = z.object({
  error: z.object({
    code: NonEmptyStringSchema,
    message: NonEmptyStringSchema,
    details: z.record(z.string(), z.unknown()).optional()
  })
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
