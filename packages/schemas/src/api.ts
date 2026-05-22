import { z } from "zod";
import {
  ArtifactSchema,
  BusinessUsdAmountSchema,
  DocumentSchema,
  PriceBookSchema,
  ValueModelSchema,
  NonEmptyStringSchema,
  NonNegativeIntegerSchema
} from "./domain.js";
import {
  ReviewDecisionValueSchema,
  WorkflowVariantSchema
} from "./enums.js";

export const ApiErrorCode = [
  "AUTH_REQUIRED",
  "AUTH_FORBIDDEN",
  "VALIDATION_ERROR",
  "CONFLICT",
  "PAYLOAD_TOO_LARGE",
  "METHOD_NOT_ALLOWED",
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

export const ArtifactIdParamSchema = z.object({
  artifactId: NonEmptyStringSchema
}).strict();
export type ArtifactIdParam = z.infer<typeof ArtifactIdParamSchema>;

export const CompareQuerySchema = z.object({
  comparisonGroupId: NonEmptyStringSchema
}).strict();
export type CompareQuery = z.infer<typeof CompareQuerySchema>;

export const DocumentPresignRequestSchema = z.object({
  fileName: NonEmptyStringSchema,
  contentType: z.literal("application/pdf"),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
  sha256: NonEmptyStringSchema.optional()
}).strict();
export type DocumentPresignRequest = z.infer<typeof DocumentPresignRequestSchema>;

export const DocumentPresignResponseSchema = z.object({
  documentId: NonEmptyStringSchema,
  s3Key: NonEmptyStringSchema,
  uploadUrl: NonEmptyStringSchema,
  expiresInSeconds: z.number().int().positive(),
  requiredHeaders: z.record(z.string(), z.string()),
  maxSizeBytes: z.number().int().positive()
}).strict();
export type DocumentPresignResponse = z.infer<typeof DocumentPresignResponseSchema>;

export const CreateDocumentRequestSchema = z.object({
  documentId: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  fileName: NonEmptyStringSchema,
  s3Key: NonEmptyStringSchema,
  contentType: z.literal("application/pdf"),
  sizeBytes: NonNegativeIntegerSchema.optional(),
  sha256: NonEmptyStringSchema.optional()
}).strict();
export type CreateDocumentRequest = z.infer<typeof CreateDocumentRequestSchema>;

export const CreateDocumentResponseSchema = z.object({
  document: DocumentSchema,
  sourceArtifact: ArtifactSchema
}).strict();
export type CreateDocumentResponse = z.infer<typeof CreateDocumentResponseSchema>;

export const ArtifactDownloadUrlResponseSchema = z.object({
  artifactId: NonEmptyStringSchema,
  s3Key: NonEmptyStringSchema,
  downloadUrl: NonEmptyStringSchema,
  expiresInSeconds: z.number().int().positive()
}).strict();
export type ArtifactDownloadUrlResponse = z.infer<typeof ArtifactDownloadUrlResponseSchema>;

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

export const StartRunRequestSchema = z.object({
  validationRunId: NonEmptyStringSchema.optional()
}).strict();
export type StartRunRequest = z.infer<typeof StartRunRequestSchema>;

export const ReviewRunRequestSchema = z.object({
  decision: ReviewDecisionValueSchema,
  reviewerSeconds: z.number().int().positive(),
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

export const BusinessUsdInputSchema = BusinessUsdAmountSchema;
