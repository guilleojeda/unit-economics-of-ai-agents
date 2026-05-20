# 11 — Codex-ready implementation brief v1.0

This is the implementation brief to give Codex. It assumes the PRD and ADR direction already established in this bundle.

The product is an AWS-native, AgentCore-based PDF translation workflow that measures the full unit economics of producing one accepted Spanish-to-English translated PDF. The core point is not “translate a PDF”; the core point is to define a business unit, execute an agentic workflow, measure full cost end to end, verify the outcome, and compare value against cost.

Deployment is locked to `us-east-1`.

Agent execution should use Amazon Bedrock AgentCore Runtime.

Tool execution should use AgentCore Gateway with Lambda-backed targets.

Model inference should use Amazon Bedrock Converse through a shared wrapper.

## 1. Non-negotiable product rules

Codex must preserve these rules throughout implementation:

```text
1. TranslationJob is the business unit.
2. Run is a technical attempt.
3. StageEvent is the persisted workflow timeline.
4. Artifact is the durable output record.
5. LedgerItem is the source of truth for economics.
6. ReviewDecision converts a completed run into an accepted/rejected/escalated outcome.
7. LLM-only cost and full workflow cost must be shown separately.
8. Human review is always costed.
9. Rejected work still has cost but no verified outcome.
10. PriceBook controls cost assumptions; prices are not hard-coded.
11. PDF bytes are stored in S3; requests pass artifact IDs and S3 keys.
12. The product has no replay mode, synthetic-run mode, live-capture mode, or presentation mode.
13. Development fixtures are allowed only as scaffolding and tests, not as product behavior.
14. MVP supports controlled digitally generated Spanish PDFs, not arbitrary scanned PDFs.
15. V1 must work before V2/V3 are implemented.
```

## 2. Target stack

```text
Frontend:
  Next.js / React / TypeScript

Control API:
  TypeScript Lambda behind API Gateway HTTP API

Agent runtime:
  TypeScript Strands agent deployed to Amazon Bedrock AgentCore Runtime

Tool plane:
  Amazon Bedrock AgentCore Gateway

Gateway targets:
  Lambda-backed tools

PDF tools:
  Python Lambda container if native PDF libraries are needed
  TypeScript only if PDF coordinate extraction and recomposition are reliable

Model calls:
  Amazon Bedrock Converse API through a shared wrapper

Storage:
  S3 artifact bucket

Database:
  DynamoDB tables

Infrastructure:
  AWS CDK TypeScript

Observability:
  AgentCore Observability + CloudWatch

Region:
  us-east-1
```

## 3. Repository structure

```text
/apps
  /web
    Next.js frontend

  /control-api
    TypeScript Lambda API handlers
    route dispatch
    request validation
    API error contract
    presigned URL logic
    AgentCore Runtime invocation

  /agent-runtime
    TypeScript Strands app
    AgentCore Runtime entrypoint
    stage plan builder
    stage runner
    Gateway tool client
    retry policy
    execution context loader

  /tools
    /pdf-pipeline-lambda
      inspect_pdf
      extract_text_layout
      extract_images
      recompose_pdf

    /translation-lambda
      chunk_and_align
      translate_text_chunks
      translate_image_text

    /evaluation-lambda
      evaluate_translation

/packages
  /schemas
    Zod schemas and exported TypeScript types

  /data
    repository interfaces
    in-memory repositories for tests/dev scaffolding
    DynamoDB repositories
    S3 artifact repository
    ID generation
    key builders
    state transition guards

  /costing
    price-book lookup
    ledger item builders
    run rollups
    job economics rollups

  /bedrock
    Converse wrapper
    prompt templates
    strict JSON parsing
    response usage normalization
    model-call ledger helpers

  /gateway
    AgentCore Gateway client wrapper
    tool-name normalization
    request/response validation

  /ui
    optional shared UI components if useful

/infra
  CDK TypeScript app
  storage stack
  database stack
  lambda stack
  api stack
  agentcore stack
  observability stack
  tool schema files

/demo-data
  controlled Spanish source document content
  generated test PDFs
  expected glossary terms

/scripts
  seed-price-book.ts
  generate-demo-pdf.ts
  ci-deploy-dev.sh or equivalent, invoked by CI only

/docs
  PRD.md
  ADRs.md
  IMPLEMENTATION_BRIEF.md
```

Use `pnpm` workspaces unless there is a reason to choose another package manager.

## 4. Core entities

Implement these schemas first in `/packages/schemas`:

```text
Document
TranslationJob
Run
StageEvent
Artifact
LedgerItem
EvaluationResult
ReviewDecision
PriceBook
AppSetting
```

Important enums:

```ts
export const WorkflowVariant = [
  "V1_TEXT_ONLY",
  "V2_TEXT_AND_IMAGE_ANNOTATION",
  "V3_OPTIMIZED",
] as const;

export const DocumentStatus = [
  "UPLOADED",
  "INSPECTING",
  "READY",
  "UNSUPPORTED",
  "FAILED_INSPECTION",
] as const;

export const JobStatus = [
  "CREATED",
  "RUNNING",
  "AWAITING_REVIEW",
  "ACCEPTED",
  "REJECTED",
  "ESCALATED",
  "FAILED",
] as const;

export const RunStatus = [
  "CREATED",
  "QUEUED",
  "RUNNING",
  "EVALUATING",
  "AWAITING_REVIEW",
  "ACCEPTED",
  "REJECTED",
  "ESCALATED",
  "FAILED",
] as const;

export const ComponentType = [
  "MODEL_INFERENCE",
  "AGENTCORE_RUNTIME",
  "AGENTCORE_GATEWAY",
  "AGENTCORE_POLICY",
  "AGENTCORE_MEMORY",
  "EXTERNAL_SERVICE",
  "HUMAN_REVIEW",
  "RETRY",
  "REMEDIATION",
] as const;

export const CostSource = [
  "BEDROCK_RESPONSE_USAGE",
  "AGENTCORE_RUNTIME_METRIC",
  "AGENTCORE_GATEWAY_METRIC",
  "AGENTCORE_POLICY_METRIC",
  "AGENTCORE_MEMORY_METRIC",
  "EXTERNAL_SERVICE_METRIC",
  "HUMAN_REVIEW_TIMER",
  "PRICE_BOOK_ESTIMATE",
  "AWS_BILL_RECONCILED",
] as const;
```

## 5. DynamoDB tables

Use separate tables for MVP clarity:

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

Minimum key design:

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

## 6. S3 artifact key convention

Use one private bucket per environment:

```text
agentcore-pdf-translator-{stage}-{accountId}-us-east-1
```

Use these prefixes:

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

## 7. Workflow stage plans

Implement as plain TypeScript in `/apps/agent-runtime/src/stage-plan.ts`.

```ts
export const V1_STAGE_PLAN = [
  "inspect_pdf",
  "extract_text_layout",
  "chunk_and_align",
  "translate_text_chunks",
  "recompose_pdf",
  "evaluate_translation",
  "finalize_economics",
] as const;

export const V2_STAGE_PLAN = [
  "inspect_pdf",
  "extract_text_layout",
  "extract_images",
  "chunk_and_align",
  "translate_text_chunks",
  "translate_image_text",
  "recompose_pdf",
  "evaluate_translation",
  "finalize_economics",
] as const;

export const V3_STAGE_PLAN = [
  "inspect_pdf",
  "route_document",
  "extract_text_layout",
  "selective_extract_images",
  "chunk_and_align",
  "batch_translate_text_chunks",
  "selective_translate_image_text",
  "recompose_pdf",
  "evaluate_translation",
  "finalize_economics",
] as const;
```

Tool mappings:

```text
inspect_pdf                   → PdfPipelineTools___inspect_pdf
extract_text_layout           → PdfPipelineTools___extract_text_layout
extract_images                → PdfPipelineTools___extract_images
selective_extract_images      → PdfPipelineTools___extract_images
recompose_pdf                 → PdfPipelineTools___recompose_pdf
chunk_and_align               → TranslationTools___chunk_and_align
translate_text_chunks         → TranslationTools___translate_text_chunks
batch_translate_text_chunks   → TranslationTools___translate_text_chunks
translate_image_text          → TranslationTools___translate_image_text
selective_translate_image_text→ TranslationTools___translate_image_text
evaluate_translation          → EvaluationTools___evaluate_translation
```

`route_document` and `finalize_economics` are internal stages, not Gateway tools.

## 8. Gateway tool contracts

Every Gateway tool must accept a common envelope and return a common envelope.

```ts
export type ToolRequestBase = {
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

export type ToolResponseBase = {
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

Gateway Lambda dispatch must strip the `TargetName___tool_name` prefix before routing the call.

## 9. API endpoints

```text
POST /api/documents/presign
POST /api/documents
GET  /api/documents
GET  /api/documents/{documentId}
POST /api/documents/{documentId}/inspect
GET  /api/documents/{documentId}/jobs
POST /api/documents/{documentId}/jobs
GET  /api/jobs
GET  /api/jobs/{jobId}
GET  /api/jobs/{jobId}/runs
GET  /api/jobs/{jobId}/ledger
GET  /api/jobs/{jobId}/economics
POST /api/jobs/{jobId}/runs
GET  /api/runs/{runId}
GET  /api/runs/{runId}/timeline
GET  /api/runs/{runId}/artifacts
GET  /api/runs/{runId}/evaluation
GET  /api/runs/{runId}/ledger
POST /api/runs/{runId}/review
GET  /api/compare
GET  /api/price-books/current
PUT  /api/price-books/current
```

Error shape:

```ts
export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};
```

Important state rule: `POST /api/runs/{runId}/review` must reject any run that is not `AWAITING_REVIEW`.

## 10. Costing rules

Implement in `/packages/costing`.

```text
llmOnlyCostUsd = sum(ledger.estimatedCostUsd where componentType === "MODEL_INFERENCE")
fullWorkflowCostUsd = sum(ledger.estimatedCostUsd for all rows)
humanReviewCostUsd = reviewerSeconds / 3600 * humanReviewHourlyRateUsd
jobCostUsd = sum(full workflow costs for every run under job)
costPerVerifiedOutcomeUsd = jobCostUsd if job.status === "ACCEPTED"; null otherwise
unitMarginUsd = valuePerAcceptedPdfUsd - costPerVerifiedOutcomeUsd
```

Accepted jobs show cost per verified outcome and unit margin. Rejected jobs show full workflow cost but `costPerVerifiedOutcomeUsd = null` and `unitMarginUsd = null`. Multi-attempt accepted jobs include failed/rejected/remediated attempt costs.

## 11. Bedrock Converse wrapper

Create `/packages/bedrock/src/converse-json.ts`.

Requirements:

```text
1. All model calls go through this wrapper.
2. Wrapper requires modelId, system prompt, user payload, temperature, max tokens, and requestMetadata.
3. requestMetadata must include workspaceId, documentId, jobId, runId, stageName, workflowVariant.
4. Wrapper parses model output as strict JSON.
5. Wrapper validates JSON against a Zod schema.
6. Wrapper returns parsed output, raw text, usage, latency, and modelId.
7. Token usage from response is used for MODEL_INFERENCE ledger rows.
```

## 12. Frontend routes

```text
/                                  redirect to /documents
/documents                          Document Library
/documents/new                      Upload Document
/documents/:documentId              Document Detail
/documents/:documentId/jobs/new     Create Translation Job
/jobs/:jobId                        Translation Job Detail
/jobs/:jobId/runs/:runId            Run Detail
/jobs/:jobId/runs/:runId/result     PDF Result View
/jobs/:jobId/runs/:runId/evaluation Evaluation View
/jobs/:jobId/runs/:runId/ledger     Cost Ledger View
/compare/:comparisonGroupId         V1/V2/V3 Comparison View
/settings/economics                 PriceBook and value settings
```

Reusable components:

```text
StatusBadge
CostBasisBadge
WorkflowVariantBadge
MoneyValue
DocumentSummaryCard
InspectionPanel
WorkflowVariantSelector
ValueModelForm
JobEconomicsCards
StageTimeline
StageEventRow
ArtifactLinks
PdfSideBySideViewer
EvaluationScoreGrid
WarningList
ReviewDecisionForm
LedgerSummaryCards
LedgerTable
LedgerGroupBreakdown
ComparisonTable
CostComponentBarChart
UnitMarginBarChart
PriceBookEditor
```

## 13. Infrastructure to create

Use CDK TypeScript.

Stacks:

```text
SecurityStack
StorageStack
DatabaseStack
LambdaStack
AgentCoreStack
ApiStack
ObservabilityStack
```

Core resources:

```text
S3 artifact bucket
DynamoDB tables
Control API Lambda
PdfPipelineTools Lambda
TranslationTools Lambda
EvaluationTools Lambda
API Gateway HTTP API
AgentCore Runtime
AgentCore Runtime Endpoint
AgentCore Gateway
GatewayTarget: PdfPipelineTools
GatewayTarget: TranslationTools
GatewayTarget: EvaluationTools
CloudWatch log groups/dashboard
ECR repository for AgentCore Runtime container
ECR repository for PDF tools container if needed
```

## 14. Environment variables

Control API:

```text
AWS_REGION=us-east-1
STAGE=dev
WORKSPACE_ID=ws_default
ARTIFACT_BUCKET=...
DOCUMENTS_TABLE=...
TRANSLATION_JOBS_TABLE=...
RUNS_TABLE=...
STAGE_EVENTS_TABLE=...
ARTIFACTS_TABLE=...
LEDGER_ITEMS_TABLE=...
EVALUATION_RESULTS_TABLE=...
REVIEW_DECISIONS_TABLE=...
PRICE_BOOKS_TABLE=...
APP_SETTINGS_TABLE=...
AGENT_RUNTIME_ARN=...
AGENT_RUNTIME_ENDPOINT=...
ACTIVE_PRICE_BOOK_VERSION=...
MAX_SUPPORTED_FILE_SIZE_BYTES=...
MAX_SUPPORTED_PAGES=...
```

Agent runtime:

```text
AWS_REGION=us-east-1
STAGE=dev
WORKSPACE_ID=ws_default
ARTIFACT_BUCKET=...
all table names
AGENTCORE_GATEWAY_ID=...
AGENTCORE_GATEWAY_URL=...
DEFAULT_TEXT_MODEL_ID=...
DEFAULT_IMAGE_TEXT_MODEL_ID=...
DEFAULT_EVALUATOR_MODEL_ID=...
ACTIVE_PRICE_BOOK_VERSION=...
```

Tool Lambdas:

```text
AWS_REGION=us-east-1
STAGE=dev
ARTIFACT_BUCKET=...
PRICE_BOOKS_TABLE=...
APP_SETTINGS_TABLE=...
DEFAULT_TEXT_MODEL_ID=...
DEFAULT_IMAGE_TEXT_MODEL_ID=...
DEFAULT_EVALUATOR_MODEL_ID=...
```

Frontend:

```text
NEXT_PUBLIC_API_BASE_URL=...
NEXT_PUBLIC_STAGE=dev
NEXT_PUBLIC_AWS_REGION=us-east-1
```

## 15. Implementation order

```text
PR-001 — Monorepo foundation
PR-002 — Shared schemas
PR-003 — Costing package
PR-004 — In-memory repositories and state transitions
PR-005 — Frontend with API-shaped fixtures
PR-006 — Control API skeleton
PR-007 — CDK storage/database/API basics
PR-008 — DynamoDB and S3 repositories
PR-009 — CI-backed dev deployment pipeline
PR-010 — Persistent Control API
PR-010A — Deployed frontend and dev access
PR-011 — Agent runtime stage runner without real Gateway
PR-012 — AgentCore Runtime and Gateway infrastructure
PR-013 — Real V1 PDF workflow
PR-014 — V2 image annotation
PR-015 — V3 optimization
PR-016 — Observability and hardening
```

The first Codex session should implement only PR-001 through PR-004.

Do not start AWS integration before:

```text
schemas
costing
repository interfaces
in-memory repositories
state transition guards
S3 key builder
basic tests
```

The next task is `PR-009 - CI-backed dev deployment pipeline`. Use `docs/codex/PR-009-CI-DEPLOYMENT-PIPELINE.md` as the task contract.

Before Persistent Control API behavior is wired into a deployed path, create the CI-backed dev deployment pipeline. Deployment must run through GitHub Actions or the repository's normal CI/CD system using CDK/IaC. Do not use local `cdk deploy`, branch preview deployment, or manual AWS console changes as a delivery path. PR-009 must be merged, deployed from `main`, captured in a deploy artifact for the merged SHA, directly verified by Codex against the deployed API/app, and recorded with evidence before PR-010 or any later product behavior starts.

Use the dedicated story contracts for PR-009 through PR-016:

```text
PR-009 — docs/codex/PR-009-CI-DEPLOYMENT-PIPELINE.md
PR-010 — docs/codex/PR-010-PERSISTENT-CONTROL-API.md
PR-010A — docs/codex/PR-010A-DEPLOYED-FRONTEND-ACCESS.md
PR-011 — docs/codex/PR-011-AGENT-RUNTIME-STAGE-RUNNER.md
PR-012 — docs/codex/PR-012-AGENTCORE-RUNTIME-GATEWAY-INFRA.md
PR-013 — docs/codex/PR-013-REAL-V1-PDF-WORKFLOW.md
PR-014 — docs/codex/PR-014-V2-IMAGE-ANNOTATION.md
PR-015 — docs/codex/PR-015-V3-OPTIMIZATION.md
PR-016 — docs/codex/PR-016-OBSERVABILITY-HARDENING.md
```

For PR-010 and later, do not rely on the high-level backlog alone. The story contracts define the required post-merge deployed verification, telemetry status, deploy artifact evidence, non-goals, and review traps.

After PR-010A deploys the frontend, user-facing workflow verification must use the rendered deployed app. API calls may support evidence collection, but they are not sufficient by themselves for product flows exposed in the app.

## 16. What to defer

```text
AgentCore Memory
AgentCore Policy
runtime cost reconciliation
AWS Cost Explorer integration
Cognito or enterprise auth
VPC networking
scanned-PDF OCR
image inpainting
multi-language support
production billing reconciliation
complex analytics
presentation mode
replay mode
synthetic run mode
```

Policy can be added after V1 works. Memory should only be added if glossary or reviewer-preference memory becomes real product behavior.

## 17. Controlled test document

Create controlled Spanish PDF fixture:

```text
Title: Procedimiento de Reembolsos y Elegibilidad
Pages: 4
Language: Spanish
Target language: English
Format: digitally generated PDF
```

Required content:

```text
Page 1: refund eligibility overview paragraphs
Page 2: rules and exceptions
Page 3: SLA / decision table
Page 4: embedded process diagram with Spanish labels
```

Required glossary:

```text
reembolso → refund
elegibilidad → eligibility
contracargo → chargeback
revisión manual → manual review
caso escalado → escalated case
```

Required diagram labels:

```text
Recibir solicitud
Validar compra
Evaluar elegibilidad
Aprobar reembolso
Escalar revisión
Cerrar caso
```

Also include one decorative image without material text so V3 has legitimate work to skip.

## 18. Testing requirements

Unit tests:

```text
schemas
state transitions
cost formulas
price book lookup
S3 key generation
ledger rollups
job economics
tool response validation
translation alignment validation
evaluation deterministic checks
```

Integration tests:

```text
document upload flow
document/job/run creation
run timeline retrieval
ledger retrieval
review decision flow
comparison endpoint
S3 JSON artifact write/read
DynamoDB repository queries
```

End-to-end tests:

```text
Upload controlled Spanish PDF
Inspect document
Create V1 job
Start V1 run
Wait for AWAITING_REVIEW
Open translated PDF
Open evaluation
Accept run
Verify cost per verified outcome and unit margin
Repeat for V2
Repeat for V3
Open comparison group
Verify cost and margin comparison
```

## 19. Definition of done for talk-complete

```text
1. The controlled Spanish PDF can be uploaded and inspected.
2. V1, V2, and V3 TranslationJobs can be created for the same document.
3. Each job can execute a real Run through AgentCore Runtime.
4. The agent calls tools through AgentCore Gateway.
5. Each run creates StageEvents.
6. Each durable output creates Artifacts.
7. Each cost component creates LedgerItems.
8. Each run produces a translated PDF.
9. Each run produces an EvaluationResult.
10. A reviewer can accept, reject, or escalate.
11. Reviewer time creates human-review cost.
12. Accepted jobs show cost per verified outcome.
13. Accepted jobs show unit margin.
14. Rejected jobs show consumed cost but no verified outcome.
15. The ledger shows LLM-only cost separately from full workflow cost.
16. The comparison view shows V1/V2/V3 economics side by side.
17. The app labels estimated versus reconciled costs honestly.
18. The app deploys to us-east-1 through CI/CD.
19. The product can be recorded externally while operating normally.
```

For every slice that changes deployed behavior after the CI deployment path exists, completion requires the merged SHA to deploy through CI, Codex to use the deployed app or API directly, and deployed verification evidence to be recorded.

## 20. Initial Codex prompt

Use this as the first instruction to Codex:

```text
Build the first vertical slice of an AWS AgentCore PDF translation unit-economics app.

Do not build AWS integration yet. Start with the local monorepo foundation, shared schemas, costing package, repository interfaces, in-memory repositories, state transition guards, and tests.

The product model is:

Document → TranslationJob → Run → StageEvent / Artifact / LedgerItem → EvaluationResult → ReviewDecision → Job economics.

TranslationJob is the business unit. Run is a technical attempt. LedgerItems are the source of truth for economics. ReviewDecision converts a completed run into an accepted/rejected/escalated business outcome. LLM-only cost and full workflow cost must be calculated separately. Human review must create cost. Rejected work must still show cost but no verified outcome.

Use TypeScript and pnpm workspaces. Create the repo structure described in IMPLEMENTATION_BRIEF.md. Implement:

1. /packages/schemas with Zod schemas for Document, TranslationJob, Run, StageEvent, Artifact, LedgerItem, EvaluationResult, ReviewDecision, PriceBook, AppSetting, API errors, and tool contracts.
2. /packages/costing with price-book lookup, model/tool/review ledger helpers, rollupRunCost, and rollupJobEconomics.
3. /packages/data with repository interfaces, in-memory repository implementations, state transition guards, ID generation, and S3 key builder.
4. Unit tests for schemas, state transitions, S3 key generation, cost rollups, accepted/rejected job economics, and multi-attempt jobs.

Do not implement AgentCore Runtime, Gateway, Bedrock calls, PDF extraction, or frontend yet. Do not add replay mode, synthetic-run mode, live-capture mode, or presentation mode. Development fixtures are allowed only for tests and local scaffolding, not as product features.

The first deliverable is a passing TypeScript workspace where pnpm install, pnpm typecheck, pnpm test, and pnpm lint all succeed.
```

## 21. Codex guardrails

```text
1. Do not invent AWS prices.
2. Do not hard-code model IDs.
3. Do not hard-code price-book values into UI or business logic.
4. Do not store PDF bytes in DynamoDB.
5. Do not pass raw PDFs through AgentCore requests.
6. Do not treat automated evaluation as acceptance.
7. Do not treat review as free.
8. Do not make failed/rejected attempts disappear from economics.
9. Do not implement arbitrary scanned-PDF support in MVP.
10. Do not introduce product modes for recording.
11. Do not use logs as the sole source of cost truth.
12. Do not let tools mutate Run or Job state directly; the agent/control API persists state.
```

## 22. Open implementation choices

Not blockers for first slice:

```text
1. Exact Bedrock translation model ID. Resolve in PR-013 as configurable deployment input, not hard-coded code.
2. Exact Bedrock evaluator model ID. Resolve in PR-013 as configurable deployment input, not hard-coded code.
3. PDF library: PyMuPDF/reportlab/pypdfium2 versus TypeScript alternative. Resolve in PR-013 before real PDF tools are implemented.
4. Whether PdfPipelineTools is Python container Lambda or TypeScript Lambda. Resolve in PR-013 before real PDF tools are implemented.
5. Whether frontend hosting is S3 + CloudFront or Amplify. Resolve in PR-010A.
6. Whether dev API protection is basic auth, private access, or Cognito. Resolve API protection in PR-010 and browser/app access in PR-010A.
7. Whether runtime cost is initially omitted, estimated, or reconciled. Resolve the initial V1 basis in PR-013 and harden labeling in PR-016.
8. Exact dev placeholder PriceBook values. Resolve in PR-010 as data/configuration, not hard-coded pricing logic.
```

For the first slice, use configuration placeholders and tests. Do not block on these decisions.
