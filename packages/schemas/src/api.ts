import { z } from "zod";
import {
  PriceBookSchema,
  ValueModelSchema,
  NonEmptyStringSchema
} from "./domain.js";
import {
  ReviewDecisionValueSchema,
  WorkflowVariantSchema
} from "./enums.js";

export const ApiErrorCode = [
  "VALIDATION_ERROR",
  "DOCUMENT_UNSUPPORTED",
  "DOCUMENT_NOT_FOUND",
  "JOB_NOT_FOUND",
  "RUN_NOT_FOUND",
  "ARTIFACT_NOT_FOUND",
  "PRICE_BOOK_NOT_FOUND",
  "RUN_NOT_REVIEWABLE",
  "JOB_ALREADY_RUNNING",
  "INVALID_STATE_TRANSITION",
  "NOT_IMPLEMENTED",
  "AGENT_INVOCATION_FAILED",
  "INTERNAL_ERROR"
] as const;
export const ApiErrorCodeSchema = z.enum(ApiErrorCode);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: NonEmptyStringSchema,
    details: z.record(z.string(), z.unknown()).optional()
  })
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const IdParamSchema = z.object({
  id: NonEmptyStringSchema
}).strict();
export type IdParam = z.infer<typeof IdParamSchema>;

export const DocumentIdParamSchema = z.object({
  documentId: NonEmptyStringSchema
}).strict();
export type DocumentIdParam = z.infer<typeof DocumentIdParamSchema>;

export const JobIdParamSchema = z.object({
  jobId: NonEmptyStringSchema
}).strict();
export type JobIdParam = z.infer<typeof JobIdParamSchema>;

export const RunIdParamSchema = z.object({
  runId: NonEmptyStringSchema
}).strict();
export type RunIdParam = z.infer<typeof RunIdParamSchema>;

export const CompareQuerySchema = z.object({
  comparisonGroupId: NonEmptyStringSchema
}).strict();
export type CompareQuery = z.infer<typeof CompareQuerySchema>;

export const CreateJobOptionsSchema = z.object({
  enablePolicyChecks: z.boolean(),
  enableMemory: z.boolean(),
  preserveLayout: z.literal("APPROXIMATE")
}).strict();
export type CreateJobOptions = z.infer<typeof CreateJobOptionsSchema>;

export const CreateTranslationJobRequestSchema = z.object({
  workflowVariant: WorkflowVariantSchema,
  valueModel: ValueModelSchema.strict(),
  options: CreateJobOptionsSchema,
  comparisonGroupId: NonEmptyStringSchema.optional(),
  createComparisonGroup: z.boolean().optional()
}).strict();
export type CreateTranslationJobRequest = z.infer<typeof CreateTranslationJobRequestSchema>;

export const StartRunRequestSchema = z.object({}).strict();
export type StartRunRequest = z.infer<typeof StartRunRequestSchema>;

export const ReviewRunRequestSchema = z.object({
  decision: ReviewDecisionValueSchema,
  reviewerSeconds: z.number().int().nonnegative(),
  reason: z.string().min(1).optional()
}).strict();
export type ReviewRunRequest = z.infer<typeof ReviewRunRequestSchema>;

export const PutCurrentPriceBookRequestSchema = z.union([
  z.object({
    priceBook: PriceBookSchema.strict()
  }).strict(),
  z.object({
    priceBookVersion: NonEmptyStringSchema
  }).strict()
]);
export type PutCurrentPriceBookRequest = z.infer<typeof PutCurrentPriceBookRequestSchema>;
