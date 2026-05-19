import { z } from "zod";
import {
  ArtifactSchema,
  IsoDateTimeSchema,
  LedgerItemSchema,
  NonEmptyStringSchema,
  TraceContextSchema,
  WorkflowOptionsSchema
} from "./domain.js";
import { StageNameSchema, ToolStatusSchema, WorkflowVariantSchema } from "./enums.js";

export const ArtifactDraftSchema = ArtifactSchema.omit({
  artifactId: true,
  createdAt: true
}).extend({
  artifactId: NonEmptyStringSchema.optional(),
  createdAt: IsoDateTimeSchema.optional()
});
export type ArtifactDraft = z.infer<typeof ArtifactDraftSchema>;

export const LedgerItemDraftSchema = LedgerItemSchema.omit({
  ledgerItemId: true,
  createdAt: true
}).extend({
  ledgerItemId: NonEmptyStringSchema.optional(),
  createdAt: IsoDateTimeSchema.optional()
});
export type LedgerItemDraft = z.infer<typeof LedgerItemDraftSchema>;

export const ToolRequestBaseSchema = z.object({
  workspaceId: NonEmptyStringSchema,
  documentId: NonEmptyStringSchema,
  jobId: NonEmptyStringSchema,
  runId: NonEmptyStringSchema,
  workflowVariant: WorkflowVariantSchema,
  sourceLanguage: z.literal("es"),
  targetLanguage: z.literal("en"),
  priceBookVersion: NonEmptyStringSchema,
  traceContext: TraceContextSchema.pick({
    traceId: true,
    parentSpanId: true
  }).optional(),
  options: WorkflowOptionsSchema
});
export type ToolRequestBase = z.infer<typeof ToolRequestBaseSchema>;

export const ToolMetricValueSchema = z.union([
  z.number().finite(),
  z.string(),
  z.boolean()
]);
export type ToolMetricValue = z.infer<typeof ToolMetricValueSchema>;

export const ToolResponseBaseSchema = z.object({
  status: ToolStatusSchema,
  stageName: StageNameSchema,
  startedAt: IsoDateTimeSchema,
  completedAt: IsoDateTimeSchema,
  durationMs: z.number().int().nonnegative(),
  artifacts: z.array(ArtifactDraftSchema),
  metrics: z.record(z.string(), ToolMetricValueSchema),
  ledgerItems: z.array(LedgerItemDraftSchema),
  warnings: z.array(z.string()),
  error: z
    .object({
      code: NonEmptyStringSchema,
      message: NonEmptyStringSchema
    })
    .optional(),
  traceContext: TraceContextSchema.optional()
});
export type ToolResponseBase = z.infer<typeof ToolResponseBaseSchema>;
