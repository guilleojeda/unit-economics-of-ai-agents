import { z } from "zod";
import {
  ArtifactTypeSchema,
  BillableUnitSchema,
  ComponentTypeSchema,
  CostBasisSchema,
  CostSourceSchema,
  DocumentStatusSchema,
  JobStatusSchema,
  PriceBookStatusSchema,
  ReviewDecisionValueSchema,
  RunStatusSchema,
  StageEventStatusSchema,
  StageNameSchema,
  WorkflowVariantSchema
} from "./enums.js";

export const IsoDateTimeSchema = z.string().datetime({ offset: true });
export const NonEmptyStringSchema = z.string().min(1);
export const UsdAmountSchema = z.number().finite().nonnegative();
export const BusinessUsdAmountSchema = UsdAmountSchema.max(1_000_000).refine(
  (value) => Number.isInteger(value * 10_000),
  "USD amount must use at most 4 decimal places"
);
export const PositiveBusinessUsdAmountSchema = BusinessUsdAmountSchema.refine(
  (value) => value > 0,
  "USD amount must be greater than zero"
);
export const NonNegativeIntegerSchema = z.number().int().nonnegative();

export const LanguagePairSchema = z.object({
  sourceLanguage: z.literal("es"),
  targetLanguage: z.literal("en")
});

export const ValueModelSchema = z.object({
  valuePerAcceptedPdfUsd: BusinessUsdAmountSchema,
  manualTranslationBaselineUsd: BusinessUsdAmountSchema.optional(),
  manualReviewBaselineUsd: BusinessUsdAmountSchema.optional(),
  humanReviewHourlyRateUsd: PositiveBusinessUsdAmountSchema
});
export type ValueModel = z.infer<typeof ValueModelSchema>;

export const WorkflowOptionsSchema = z.object({
  enableImageTranslation: z.boolean(),
  enablePolicyChecks: z.boolean(),
  enableMemory: z.boolean(),
  preserveLayout: z.literal("APPROXIMATE")
});
export type WorkflowOptions = z.infer<typeof WorkflowOptionsSchema>;

export const TraceContextSchema = z.object({
  traceId: NonEmptyStringSchema.optional(),
  spanId: NonEmptyStringSchema.optional(),
  parentSpanId: NonEmptyStringSchema.optional()
});
export type TraceContext = z.infer<typeof TraceContextSchema>;

export const DocumentSchema = z.object({
  workspaceId: NonEmptyStringSchema,
  documentId: NonEmptyStringSchema,
  title: NonEmptyStringSchema,
  sourceLanguage: z.literal("es"),
  targetLanguage: z.literal("en"),
  status: DocumentStatusSchema,
  sourcePdfArtifactId: NonEmptyStringSchema,
  sourcePdfS3Bucket: NonEmptyStringSchema,
  sourcePdfS3Key: NonEmptyStringSchema,
  sourcePdfS3VersionId: NonEmptyStringSchema.optional(),
  fileName: NonEmptyStringSchema,
  fileSizeBytes: NonNegativeIntegerSchema,
  sha256: NonEmptyStringSchema,
  pageCount: NonNegativeIntegerSchema.optional(),
  textBlockCount: NonNegativeIntegerSchema.optional(),
  imageCount: NonNegativeIntegerSchema.optional(),
  estimatedScannedPageCount: NonNegativeIntegerSchema.optional(),
  detectedSourceLanguage: NonEmptyStringSchema.optional(),
  layoutComplexityScore: UsdAmountSchema.optional(),
  inspectionWarnings: z.array(z.string()),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema
});
export type Document = z.infer<typeof DocumentSchema>;

export const TranslationJobSchema = z.object({
  workspaceId: NonEmptyStringSchema,
  jobId: NonEmptyStringSchema,
  documentId: NonEmptyStringSchema,
  comparisonGroupId: NonEmptyStringSchema.optional(),
  workflowVariant: WorkflowVariantSchema,
  status: JobStatusSchema,
  sourceLanguage: z.literal("es"),
  targetLanguage: z.literal("en"),
  valueModel: ValueModelSchema,
  options: WorkflowOptionsSchema,
  priceBookVersion: NonEmptyStringSchema,
  totalAttemptCount: NonNegativeIntegerSchema,
  acceptedRunId: NonEmptyStringSchema.optional(),
  latestRunId: NonEmptyStringSchema.optional(),
  llmOnlyCostUsd: UsdAmountSchema,
  fullWorkflowCostUsd: UsdAmountSchema,
  costPerVerifiedOutcomeUsd: UsdAmountSchema.optional(),
  unitValueUsd: UsdAmountSchema,
  unitMarginUsd: z.number().finite().optional(),
  costBasis: CostBasisSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema
});
export type TranslationJob = z.infer<typeof TranslationJobSchema>;

export const RunSchema = z.object({
  workspaceId: NonEmptyStringSchema,
  runId: NonEmptyStringSchema,
  jobId: NonEmptyStringSchema,
  documentId: NonEmptyStringSchema,
  attemptNumber: z.number().int().positive(),
  workflowVariant: WorkflowVariantSchema,
  status: RunStatusSchema,
  sourceLanguage: z.literal("es"),
  targetLanguage: z.literal("en"),
  sourcePdfArtifactId: NonEmptyStringSchema,
  translatedPdfArtifactId: NonEmptyStringSchema.optional(),
  evaluationResultId: NonEmptyStringSchema.optional(),
  llmOnlyCostUsd: UsdAmountSchema,
  fullWorkflowCostUsd: UsdAmountSchema,
  humanReviewCostUsd: UsdAmountSchema,
  retryCostUsd: UsdAmountSchema,
  remediationCostUsd: UsdAmountSchema,
  traceId: NonEmptyStringSchema.optional(),
  agentRuntimeSessionId: NonEmptyStringSchema.optional(),
  failureReason: NonEmptyStringSchema.optional(),
  warnings: z.array(z.string()),
  startedAt: IsoDateTimeSchema.optional(),
  completedAt: IsoDateTimeSchema.optional(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema
});
export type Run = z.infer<typeof RunSchema>;

export const StageEventSchema = z.object({
  workspaceId: NonEmptyStringSchema,
  runId: NonEmptyStringSchema,
  jobId: NonEmptyStringSchema,
  documentId: NonEmptyStringSchema,
  stageEventId: NonEmptyStringSchema,
  sequence: z.number().int().positive(),
  stageName: StageNameSchema,
  status: StageEventStatusSchema,
  toolName: NonEmptyStringSchema.optional(),
  modelId: NonEmptyStringSchema.optional(),
  inputArtifactIds: z.array(NonEmptyStringSchema),
  outputArtifactIds: z.array(NonEmptyStringSchema),
  retryCount: NonNegativeIntegerSchema,
  durationMs: NonNegativeIntegerSchema.optional(),
  startedAt: IsoDateTimeSchema.optional(),
  completedAt: IsoDateTimeSchema.optional(),
  traceId: NonEmptyStringSchema.optional(),
  spanId: NonEmptyStringSchema.optional(),
  parentSpanId: NonEmptyStringSchema.optional(),
  warnings: z.array(z.string()),
  errorMessage: NonEmptyStringSchema.optional()
});
export type StageEvent = z.infer<typeof StageEventSchema>;

export const ArtifactSchema = z.object({
  workspaceId: NonEmptyStringSchema,
  artifactId: NonEmptyStringSchema,
  documentId: NonEmptyStringSchema,
  jobId: NonEmptyStringSchema.optional(),
  runId: NonEmptyStringSchema.optional(),
  stageEventId: NonEmptyStringSchema.optional(),
  artifactType: ArtifactTypeSchema,
  s3Bucket: NonEmptyStringSchema,
  s3Key: NonEmptyStringSchema,
  s3VersionId: NonEmptyStringSchema.optional(),
  contentType: NonEmptyStringSchema,
  sizeBytes: NonNegativeIntegerSchema.optional(),
  sha256: NonEmptyStringSchema.optional(),
  pageNumber: z.number().int().positive().optional(),
  language: NonEmptyStringSchema.optional(),
  createdAt: IsoDateTimeSchema
});
export type Artifact = z.infer<typeof ArtifactSchema>;

export const LedgerItemSchema = z.object({
  workspaceId: NonEmptyStringSchema,
  ledgerItemId: NonEmptyStringSchema,
  runId: NonEmptyStringSchema,
  jobId: NonEmptyStringSchema,
  documentId: NonEmptyStringSchema,
  workflowVariant: WorkflowVariantSchema,
  stageName: StageNameSchema,
  stageSequence: z.number().int().positive(),
  componentType: ComponentTypeSchema,
  componentName: NonEmptyStringSchema,
  billableUnit: BillableUnitSchema,
  unitCount: z.number().finite().nonnegative(),
  unitPriceUsd: UsdAmountSchema,
  estimatedCostUsd: UsdAmountSchema,
  actualCostUsd: UsdAmountSchema.optional(),
  costSource: CostSourceSchema,
  modelId: NonEmptyStringSchema.optional(),
  toolName: NonEmptyStringSchema.optional(),
  inputTokens: NonNegativeIntegerSchema.optional(),
  outputTokens: NonNegativeIntegerSchema.optional(),
  cacheReadTokens: NonNegativeIntegerSchema.optional(),
  cacheWriteTokens: NonNegativeIntegerSchema.optional(),
  runtimeVcpuHours: UsdAmountSchema.optional(),
  runtimeGbHours: UsdAmountSchema.optional(),
  gatewayOperations: NonNegativeIntegerSchema.optional(),
  policyAuthorizationRequests: NonNegativeIntegerSchema.optional(),
  memoryEvents: NonNegativeIntegerSchema.optional(),
  humanReviewSeconds: NonNegativeIntegerSchema.optional(),
  retryCount: NonNegativeIntegerSchema.optional(),
  traceId: NonEmptyStringSchema.optional(),
  spanId: NonEmptyStringSchema.optional(),
  priceBookVersion: NonEmptyStringSchema,
  createdAt: IsoDateTimeSchema
});
export type LedgerItem = z.infer<typeof LedgerItemSchema>;

export const EvaluationResultSchema = z.object({
  workspaceId: NonEmptyStringSchema,
  evaluationResultId: NonEmptyStringSchema,
  runId: NonEmptyStringSchema,
  jobId: NonEmptyStringSchema,
  documentId: NonEmptyStringSchema,
  score: z.number().finite().min(0).max(1),
  passed: z.boolean(),
  semanticCoverageScore: z.number().finite().min(0).max(1),
  terminologyScore: z.number().finite().min(0).max(1),
  layoutScore: z.number().finite().min(0).max(1),
  imageTextHandlingScore: z.number().finite().min(0).max(1).optional(),
  untranslatedSpanishCount: NonNegativeIntegerSchema,
  missingChunkCount: NonNegativeIntegerSchema,
  layoutWarnings: z.array(z.string()),
  terminologyWarnings: z.array(z.string()),
  imageWarnings: z.array(z.string()),
  notes: z.string(),
  evaluatorModelId: NonEmptyStringSchema.optional(),
  inputTokens: NonNegativeIntegerSchema.optional(),
  outputTokens: NonNegativeIntegerSchema.optional(),
  createdAt: IsoDateTimeSchema
});
export type EvaluationResult = z.infer<typeof EvaluationResultSchema>;

export const ReviewDecisionSchema = z.object({
  workspaceId: NonEmptyStringSchema,
  reviewDecisionId: NonEmptyStringSchema,
  jobId: NonEmptyStringSchema,
  runId: NonEmptyStringSchema,
  documentId: NonEmptyStringSchema,
  decision: ReviewDecisionValueSchema,
  reviewerSeconds: NonNegativeIntegerSchema,
  humanReviewHourlyRateUsd: UsdAmountSchema,
  estimatedReviewCostUsd: UsdAmountSchema,
  reason: NonEmptyStringSchema.optional(),
  createdAt: IsoDateTimeSchema
});
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

export const ModelPriceSchema = z.object({
  provider: z.literal("bedrock"),
  modelId: NonEmptyStringSchema,
  inputTokenPricePer1K: UsdAmountSchema,
  outputTokenPricePer1K: UsdAmountSchema,
  cacheReadTokenPricePer1K: UsdAmountSchema.optional(),
  cacheWriteTokenPricePer1K: UsdAmountSchema.optional()
});
export type ModelPrice = z.infer<typeof ModelPriceSchema>;

export const AgentCorePricesSchema = z.object({
  runtimeVcpuHourUsd: UsdAmountSchema.optional(),
  runtimeGbHourUsd: UsdAmountSchema.optional(),
  gatewayOperationUsd: UsdAmountSchema.optional(),
  policyAuthorizationRequestUsd: UsdAmountSchema.optional(),
  memoryEventUsd: UsdAmountSchema.optional()
});
export type AgentCorePrices = z.infer<typeof AgentCorePricesSchema>;

export const ExternalServicePriceSchema = z.object({
  serviceName: NonEmptyStringSchema,
  billableUnit: z.enum(["DOCUMENT", "PAGE", "IMAGE", "SECOND"]),
  unitPriceUsd: UsdAmountSchema
});
export type ExternalServicePrice = z.infer<typeof ExternalServicePriceSchema>;

export const PriceBookSchema = z.object({
  priceBookVersion: NonEmptyStringSchema,
  status: PriceBookStatusSchema,
  currency: z.literal("USD"),
  modelPrices: z.array(ModelPriceSchema),
  agentCorePrices: AgentCorePricesSchema,
  externalServicePrices: z.array(ExternalServicePriceSchema),
  humanReviewHourlyRateDefaultUsd: PositiveBusinessUsdAmountSchema,
  sourceNotes: z.array(z.string()),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema
});
export type PriceBook = z.infer<typeof PriceBookSchema>;

export const AppSettingSchema = z.object({
  settingKey: z.literal("ACTIVE_PRICE_BOOK_VERSION"),
  settingValue: NonEmptyStringSchema,
  updatedAt: IsoDateTimeSchema
});
export type AppSetting = z.infer<typeof AppSettingSchema>;
