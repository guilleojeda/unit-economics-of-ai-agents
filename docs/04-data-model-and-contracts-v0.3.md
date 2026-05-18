# 04 — Data model and contracts v0.3

## Core object model

```text
Document:
  uploaded source PDF and inspection metadata

TranslationJob:
  one business task: produce an accepted English PDF from one Spanish source PDF

Run:
  one technical execution attempt for a TranslationJob

StageEvent:
  one workflow-stage execution record inside a Run

Artifact:
  any durable file or JSON output created by the workflow

LedgerItem:
  one normalized cost row

EvaluationResult:
  automated verification result for a Run output

ReviewDecision:
  human decision that converts a completed Run into accepted, rejected, or escalated

PriceBook:
  unit prices used to convert telemetry into estimated cost

ValueModel:
  configured business value assumptions for a TranslationJob
```

This keeps economics clean:

```text
Run cost = cost of one technical attempt
TranslationJob cost = sum(cost of all attempts, reviews, remediations)
Cost per verified outcome = sum(cost of TranslationJobs in scope) / count(accepted TranslationJobs)
```

For V1/V2/V3 comparison, each workflow variant creates its own `TranslationJob` against the same `Document`, linked by a shared `comparisonGroupId`.

## DynamoDB table strategy

Use separate DynamoDB tables for MVP clarity:

```text
Documents
TranslationJobs
Runs
StageEvents
Artifacts
LedgerItems
EvaluationResults
ReviewDecisions
PriceBooks
AppSettings
```

Single-table design is not needed for the MVP.

## ID conventions

Use sortable IDs, preferably ULID or UUIDv7.

```text
workspaceId:        ws_default
documentId:         doc_01J...
jobId:              job_01J...
runId:              run_01J...
stageEventId:       stg_01J...
artifactId:         art_01J...
ledgerItemId:       led_01J...
evaluationResultId: eval_01J...
reviewDecisionId:   rev_01J...
priceBookVersion:   pb_2026_05_18
comparisonGroupId:  cmp_01J...
```

## DynamoDB keys

```text
Documents
  PK: documentId
  GSI1: workspaceId / createdAt#documentId

TranslationJobs
  PK: jobId
  GSI1: documentId / createdAt#jobId
  GSI2: comparisonGroupId / workflowVariant#createdAt#jobId
  GSI3: status / updatedAt#jobId

Runs
  PK: runId
  GSI1: jobId / attemptNumber#createdAt#runId
  GSI2: documentId / createdAt#runId
  GSI3: status / updatedAt#runId

StageEvents
  PK: runId
  SK: sequencePadded#stageName#stageEventId

Artifacts
  PK: artifactId
  GSI1: runId / artifactType#createdAt#artifactId
  GSI2: documentId / artifactType#createdAt#artifactId
  GSI3: jobId / createdAt#artifactId

LedgerItems
  PK: runId
  SK: stageSequencePadded#createdAt#ledgerItemId
  GSI1: jobId / createdAt#ledgerItemId
  GSI2: documentId / createdAt#ledgerItemId
  GSI3: componentType / createdAt#ledgerItemId

EvaluationResults
  PK: runId
  SK: createdAt#evaluationResultId

ReviewDecisions
  PK: jobId
  SK: createdAt#reviewDecisionId

PriceBooks
  PK: priceBookVersion

AppSettings
  PK: settingKey
```

## Document schema

```ts
type Document = {
  workspaceId: string;
  documentId: string;
  title: string;
  sourceLanguage: "es";
  targetLanguage: "en";
  status: "UPLOADED" | "INSPECTING" | "READY" | "UNSUPPORTED" | "FAILED_INSPECTION";
  sourcePdfArtifactId: string;
  sourcePdfS3Bucket: string;
  sourcePdfS3Key: string;
  fileName: string;
  fileSizeBytes: number;
  sha256: string;
  pageCount?: number;
  textBlockCount?: number;
  imageCount?: number;
  estimatedScannedPageCount?: number;
  detectedSourceLanguage?: string;
  layoutComplexityScore?: number;
  inspectionWarnings: string[];
  createdAt: string;
  updatedAt: string;
};
```

`Document` inspection metadata is a cache. Canonical inspection output lives as an `Artifact`.

## TranslationJob schema

```ts
type TranslationJob = {
  workspaceId: string;
  jobId: string;
  documentId: string;
  comparisonGroupId?: string;
  workflowVariant: "V1_TEXT_ONLY" | "V2_TEXT_AND_IMAGE_ANNOTATION" | "V3_OPTIMIZED";
  status: "CREATED" | "RUNNING" | "AWAITING_REVIEW" | "ACCEPTED" | "REJECTED" | "ESCALATED" | "FAILED";
  sourceLanguage: "es";
  targetLanguage: "en";
  valueModel: {
    valuePerAcceptedPdfUsd: number;
    manualTranslationBaselineUsd?: number;
    manualReviewBaselineUsd?: number;
    humanReviewHourlyRateUsd: number;
  };
  options: {
    enableImageTranslation: boolean;
    enablePolicyChecks: boolean;
    enableMemory: boolean;
    preserveLayout: "APPROXIMATE";
  };
  priceBookVersion: string;
  totalAttemptCount: number;
  acceptedRunId?: string;
  latestRunId?: string;
  llmOnlyCostUsd: number;
  fullWorkflowCostUsd: number;
  costPerVerifiedOutcomeUsd?: number;
  unitValueUsd: number;
  unitMarginUsd?: number;
  costBasis: "TELEMETRY_DERIVED_PRICE_BOOK_ESTIMATE" | "AWS_BILL_RECONCILED" | "MIXED";
  createdAt: string;
  updatedAt: string;
};
```

The `TranslationJob` is the object the economics screen treats as the business unit.

## Run schema

```ts
type Run = {
  workspaceId: string;
  runId: string;
  jobId: string;
  documentId: string;
  attemptNumber: number;
  workflowVariant: "V1_TEXT_ONLY" | "V2_TEXT_AND_IMAGE_ANNOTATION" | "V3_OPTIMIZED";
  status: "CREATED" | "QUEUED" | "RUNNING" | "EVALUATING" | "AWAITING_REVIEW" | "ACCEPTED" | "REJECTED" | "ESCALATED" | "FAILED";
  sourceLanguage: "es";
  targetLanguage: "en";
  sourcePdfArtifactId: string;
  translatedPdfArtifactId?: string;
  evaluationResultId?: string;
  llmOnlyCostUsd: number;
  fullWorkflowCostUsd: number;
  humanReviewCostUsd: number;
  retryCostUsd: number;
  remediationCostUsd: number;
  traceId?: string;
  agentRuntimeSessionId?: string;
  failureReason?: string;
  warnings: string[];
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};
```

A `Run` can be failed or rejected while its parent `TranslationJob` remains open for another attempt.

## StageEvent schema

```ts
type StageEvent = {
  workspaceId: string;
  runId: string;
  jobId: string;
  documentId: string;
  stageEventId: string;
  sequence: number;
  stageName:
    | "inspect_pdf"
    | "route_document"
    | "extract_text_layout"
    | "extract_images"
    | "selective_extract_images"
    | "chunk_and_align"
    | "translate_text_chunks"
    | "batch_translate_text_chunks"
    | "translate_image_text"
    | "selective_translate_image_text"
    | "recompose_pdf"
    | "evaluate_translation"
    | "reviewer_decision"
    | "finalize_economics";
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "SKIPPED";
  toolName?: string;
  modelId?: string;
  inputArtifactIds: string[];
  outputArtifactIds: string[];
  retryCount: number;
  durationMs?: number;
  startedAt?: string;
  completedAt?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  warnings: string[];
  errorMessage?: string;
};
```

`finalize_economics` should be internal app logic, not a Gateway tool.

## Artifact schema

```ts
type Artifact = {
  workspaceId: string;
  artifactId: string;
  documentId: string;
  jobId?: string;
  runId?: string;
  stageEventId?: string;
  artifactType:
    | "SOURCE_PDF"
    | "INSPECTION_JSON"
    | "TEXT_LAYOUT_JSON"
    | "IMAGE_MANIFEST_JSON"
    | "IMAGE_ASSET"
    | "SOURCE_CHUNKS_JSON"
    | "TRANSLATED_CHUNKS_JSON"
    | "IMAGE_TRANSLATION_JSON"
    | "TRANSLATED_PDF"
    | "PDF_PREVIEW_PNG"
    | "EVALUATION_JSON"
    | "LEDGER_EXPORT_JSON";
  s3Bucket: string;
  s3Key: string;
  contentType: string;
  sizeBytes?: number;
  sha256?: string;
  pageNumber?: number;
  language?: string;
  createdAt: string;
};
```

## LedgerItem schema

```ts
type LedgerItem = {
  workspaceId: string;
  ledgerItemId: string;
  runId: string;
  jobId: string;
  documentId: string;
  workflowVariant: string;
  stageName: string;
  stageSequence: number;
  componentType:
    | "MODEL_INFERENCE"
    | "AGENTCORE_RUNTIME"
    | "AGENTCORE_GATEWAY"
    | "AGENTCORE_POLICY"
    | "AGENTCORE_MEMORY"
    | "EXTERNAL_SERVICE"
    | "HUMAN_REVIEW"
    | "RETRY"
    | "REMEDIATION";
  componentName: string;
  billableUnit:
    | "INPUT_TOKEN"
    | "OUTPUT_TOKEN"
    | "TOOL_OPERATION"
    | "AUTHORIZATION_REQUEST"
    | "VCPU_HOUR"
    | "GB_HOUR"
    | "MEMORY_EVENT"
    | "SECOND"
    | "DOCUMENT"
    | "PAGE"
    | "IMAGE";
  unitCount: number;
  unitPriceUsd: number;
  estimatedCostUsd: number;
  actualCostUsd?: number;
  costSource:
    | "BEDROCK_RESPONSE_USAGE"
    | "AGENTCORE_RUNTIME_METRIC"
    | "AGENTCORE_GATEWAY_METRIC"
    | "AGENTCORE_POLICY_METRIC"
    | "AGENTCORE_MEMORY_METRIC"
    | "EXTERNAL_SERVICE_METRIC"
    | "HUMAN_REVIEW_TIMER"
    | "PRICE_BOOK_ESTIMATE"
    | "AWS_BILL_RECONCILED";
  modelId?: string;
  toolName?: string;
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  runtimeVcpuHours?: number;
  runtimeGbHours?: number;
  gatewayOperations?: number;
  policyAuthorizationRequests?: number;
  memoryEvents?: number;
  humanReviewSeconds?: number;
  retryCount?: number;
  traceId?: string;
  spanId?: string;
  priceBookVersion: string;
  createdAt: string;
};
```

`llmOnlyCostUsd` is the sum of `componentType = MODEL_INFERENCE`. `fullWorkflowCostUsd` is the sum of all ledger rows.

## EvaluationResult schema

```ts
type EvaluationResult = {
  workspaceId: string;
  evaluationResultId: string;
  runId: string;
  jobId: string;
  documentId: string;
  score: number;
  passed: boolean;
  semanticCoverageScore: number;
  terminologyScore: number;
  layoutScore: number;
  imageTextHandlingScore?: number;
  untranslatedSpanishCount: number;
  missingChunkCount: number;
  layoutWarnings: string[];
  terminologyWarnings: string[];
  imageWarnings: string[];
  notes: string;
  evaluatorModelId?: string;
  inputTokens?: number;
  outputTokens?: number;
  createdAt: string;
};
```

## ReviewDecision schema

```ts
type ReviewDecision = {
  workspaceId: string;
  reviewDecisionId: string;
  jobId: string;
  runId: string;
  documentId: string;
  decision: "ACCEPTED" | "REJECTED" | "ESCALATED";
  reviewerSeconds: number;
  humanReviewHourlyRateUsd: number;
  estimatedReviewCostUsd: number;
  reason?: string;
  createdAt: string;
};
```

Reviewer decisions must create ledger rows.

## PriceBook schema

```ts
type PriceBook = {
  priceBookVersion: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  currency: "USD";
  modelPrices: Array<{
    provider: "bedrock";
    modelId: string;
    inputTokenPricePer1K: number;
    outputTokenPricePer1K: number;
    cacheReadTokenPricePer1K?: number;
    cacheWriteTokenPricePer1K?: number;
  }>;
  agentCorePrices: {
    runtimeVcpuHourUsd?: number;
    runtimeGbHourUsd?: number;
    gatewayOperationUsd?: number;
    policyAuthorizationRequestUsd?: number;
    memoryEventUsd?: number;
  };
  externalServicePrices: Array<{
    serviceName: string;
    billableUnit: "DOCUMENT" | "PAGE" | "IMAGE" | "SECOND";
    unitPriceUsd: number;
  }>;
  humanReviewHourlyRateDefaultUsd: number;
  sourceNotes: string[];
  createdAt: string;
  updatedAt: string;
};
```

App setting:

```ts
type AppSetting = {
  settingKey: "ACTIVE_PRICE_BOOK_VERSION";
  settingValue: string;
  updatedAt: string;
};
```

## S3 artifact naming

```text
agentcore-pdf-translator-{stage}-{accountId}-us-east-1
```

Recommended keys:

```text
workspaces/{workspaceId}/documents/{documentId}/source/source.pdf
workspaces/{workspaceId}/documents/{documentId}/inspection/inspection-{artifactId}.json
workspaces/{workspaceId}/jobs/{jobId}/runs/{runId}/stages/001-inspect_pdf/inspection.json
workspaces/{workspaceId}/jobs/{jobId}/runs/{runId}/stages/002-extract_text_layout/text-layout.json
workspaces/{workspaceId}/jobs/{jobId}/runs/{runId}/stages/003-extract_images/image-manifest.json
workspaces/{workspaceId}/jobs/{jobId}/runs/{runId}/stages/003-extract_images/images/page-{pageNumber}/image-{imageIndex}.{ext}
workspaces/{workspaceId}/jobs/{jobId}/runs/{runId}/stages/004-chunk_and_align/source-chunks.json
workspaces/{workspaceId}/jobs/{jobId}/runs/{runId}/stages/005-translate_text_chunks/translated-chunks.json
workspaces/{workspaceId}/jobs/{jobId}/runs/{runId}/stages/006-translate_image_text/image-translations.json
workspaces/{workspaceId}/jobs/{jobId}/runs/{runId}/stages/007-recompose_pdf/translated.pdf
workspaces/{workspaceId}/jobs/{jobId}/runs/{runId}/stages/007-recompose_pdf/previews/page-{pageNumber}.png
workspaces/{workspaceId}/jobs/{jobId}/runs/{runId}/stages/008-evaluate_translation/evaluation.json
workspaces/{workspaceId}/jobs/{jobId}/runs/{runId}/ledger/ledger-export.json
```

Store `s3Bucket` and `s3Key`, not raw `s3://...` strings.

## API surface with TranslationJob

Documents:

```text
POST /api/documents/presign
POST /api/documents
GET  /api/documents
GET  /api/documents/{documentId}
POST /api/documents/{documentId}/inspect
```

Jobs:

```text
POST /api/documents/{documentId}/jobs
GET  /api/jobs
GET  /api/jobs/{jobId}
GET  /api/jobs/{jobId}/runs
GET  /api/jobs/{jobId}/ledger
GET  /api/jobs/{jobId}/economics
POST /api/jobs/{jobId}/runs
```

Runs:

```text
GET /api/runs/{runId}
GET /api/runs/{runId}/timeline
GET /api/runs/{runId}/artifacts
GET /api/runs/{runId}/evaluation
GET /api/runs/{runId}/ledger
```

Review:

```text
POST /api/runs/{runId}/review
```

Comparison:

```text
GET /api/compare?comparisonGroupId={comparisonGroupId}
GET /api/compare?documentId={documentId}
```

## AgentCore and tool boundary

Strands agent runs in AgentCore Runtime.

Gateway targets:

```text
PdfPipelineTools
  inspect_pdf
  extract_text_layout
  extract_images
  recompose_pdf

TranslationTools
  chunk_and_align
  translate_text_chunks
  translate_image_text

EvaluationTools
  evaluate_translation
```

Do not expose these as Gateway tools:

```text
finalize_economics
write_stage_event
write_ledger_item
update_run_status
```

Those are internal persistence operations.

## Common tool request and response

```ts
type ToolRequestBase = {
  workspaceId: string;
  documentId: string;
  jobId: string;
  runId: string;
  workflowVariant: "V1_TEXT_ONLY" | "V2_TEXT_AND_IMAGE_ANNOTATION" | "V3_OPTIMIZED";
  sourceLanguage: "es";
  targetLanguage: "en";
  priceBookVersion: string;
  traceContext?: { traceId?: string; parentSpanId?: string };
  options: {
    enableImageTranslation: boolean;
    enablePolicyChecks: boolean;
    enableMemory: boolean;
    preserveLayout: "APPROXIMATE";
  };
};

type ToolResponseBase = {
  status: "SUCCEEDED" | "FAILED";
  stageName: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  artifacts: ArtifactDraft[];
  metrics: Record<string, number | string | boolean>;
  ledgerItems: LedgerItemDraft[];
  warnings: string[];
  error?: { code: string; message: string };
  traceContext?: { traceId?: string; spanId?: string; parentSpanId?: string };
};
```

## Tool-specific contracts

```text
inspect_pdf:
  Input: source PDF artifact reference.
  Output: INSPECTION_JSON; pageCount, textBlockCount, imageCount, estimatedScannedPageCount, detectedSourceLanguage, layoutComplexityScore, supported.

extract_text_layout:
  Output: TEXT_LAYOUT_JSON using PDF points, not normalized coordinates.

extract_images:
  Output: IMAGE_MANIFEST_JSON and IMAGE_ASSET artifacts. Materiality: DECORATIVE, LOW, MEDIUM, HIGH.

chunk_and_align:
  Output: SOURCE_CHUNKS_JSON. Use static glossary.

translate_text_chunks:
  Output: TRANSLATED_CHUNKS_JSON. Must call Bedrock Converse through shared wrapper and attach request metadata.

translate_image_text:
  Output: IMAGE_TRANSLATION_JSON. Placement: OVERLAY, CALLOUT, CAPTION. Default to CALLOUT or CAPTION.

recompose_pdf:
  Output: TRANSLATED_PDF and PDF_PREVIEW_PNG. Goal is readable approximate preservation, not desktop-publishing fidelity.

evaluate_translation:
  Output: EVALUATION_JSON. Fail on missing chunks, low semantic coverage, low terminology score, or missing/invalid PDF. Warn but do not auto-fail if V1 leaves image text untranslated.
```

Static glossary:

```text
reembolso -> refund
elegibilidad -> eligibility
contracargo -> chargeback
revisión manual -> manual review
caso escalado -> escalated case
```

## Stage persistence rule

For every stage:

```text
1. Create StageEvent with RUNNING status.
2. Invoke tool or internal function.
3. Persist output artifacts.
4. Persist ledger item drafts as LedgerItems.
5. Update StageEvent to SUCCEEDED or FAILED.
6. Update Run aggregate costs.
```

For MVP, use `retryCount` on the same StageEvent plus explicit `RETRY` ledger rows.

## Cost calculation service

Required functions:

```ts
calculateModelInferenceCost(args): LedgerItemDraft[]
calculateGatewayOperationCost(args): LedgerItemDraft
calculatePolicyAuthorizationCost(args): LedgerItemDraft
calculateRuntimeCost(args): LedgerItemDraft[]
calculateHumanReviewCost(args): LedgerItemDraft
rollupRunCost(runId): RunCostRollup
rollupJobEconomics(jobId): JobEconomics
```

Formulas:

```text
llmOnlyCostUsd = sum(ledger.estimatedCostUsd where componentType = MODEL_INFERENCE)
fullWorkflowCostUsd = sum(all ledger.estimatedCostUsd)
jobCostUsd = sum(ledger.estimatedCostUsd for all runs under job)
costPerVerifiedOutcomeUsd = jobCostUsd / 1 if job.status = ACCEPTED; null otherwise
unitMarginUsd = valuePerAcceptedPdfUsd - costPerVerifiedOutcomeUsd
```

## Key implementation decisions

```text
1. Add TranslationJob as a first-class entity.
2. Keep Run as a technical attempt, not the business unit.
3. Store every durable output as an Artifact.
4. Store every cost as a LedgerItem.
5. Never calculate product economics from logs alone.
6. Use logs/traces for reconciliation and debugging, not as the only source of truth.
7. Use PriceBook for cost calculations.
8. Keep PDF bytes out of AgentCore requests; pass artifact IDs and S3 keys.
9. Keep translation/evaluation as structured stages, not free-form agent conversation.
10. Keep final cost aggregation internal; do not make it a Gateway tool.
```
