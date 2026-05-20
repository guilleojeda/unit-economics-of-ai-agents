# 09 — PRD v0.8: AgentCore PDF Translation Unit Economics App

## 1. Product summary

This product is an AWS-native application that translates controlled Spanish PDFs into English and measures the full cost of producing one accepted translated document. It is not a generic PDF translation app. It is a cost-instrumented agentic workflow designed to answer one product-viability question:

```text
Is the value of solving this document-translation task greater than the full cost of solving it?
```

The app runs in `us-east-1`, uses Amazon Bedrock AgentCore Runtime for the agent execution layer, AgentCore Gateway for deterministic tools, AgentCore Observability plus CloudWatch for telemetry, Amazon Bedrock model inference for translation/evaluation, S3 for artifacts, DynamoDB for run/economics data, and a TypeScript-first implementation with Strands for the AgentCore agent.

## 2. Product goals

Primary goals:

```text
1. Translate a controlled Spanish PDF into an English PDF.
2. Track the workflow from document ingestion to reviewer outcome.
3. Record stage-level artifacts, telemetry, warnings, and costs.
4. Show LLM-only cost separately from full workflow cost.
5. Calculate cost per verified outcome.
6. Calculate unit margin using configurable business value assumptions.
7. Compare V1, V2, and V3 architecture variants for the same document.
8. Show how architecture choices change cost, quality, and margin.
```

The product should make it obvious that “translation completed” is not the same as “business outcome accepted.” The accepted outcome is the business unit.

## 3. Non-goals

```text
1. Arbitrary scanned-PDF support.
2. Production-grade desktop-publishing layout fidelity.
3. Full image inpainting or professional image editing.
4. Real-time AWS bill reconciliation.
5. Enterprise multi-tenant authentication.
6. Complex role-based access control.
7. Support for arbitrary source/target languages.
8. Support for legal, medical, regulated, or sensitive customer documents.
9. AgentCore Memory as a document vector store.
10. Replay, recording, or presentation mode.
```

Historical run comparison is a product feature. Replay for recording is not.

## 4. Target users

Primary users:

```text
Engineers
Architects
Platform leads
Technical product leaders
```

They are evaluating whether an AI agent workflow should exist as a product. They understand model pricing and tool-calling agents, but need a method for measuring whether the entire workflow is economically viable.

Secondary users:

```text
Demo presenter
Internal reviewer
Developer building the implementation
```

## 5. Core concept definitions

```text
Document:
  uploaded source Spanish PDF and inspection metadata

TranslationJob:
  business task: produce an accepted English PDF from one source Spanish PDF

Run:
  one technical execution attempt for a TranslationJob

StageEvent:
  one workflow-stage execution record inside a Run

Artifact:
  durable file or JSON output

LedgerItem:
  normalized cost row

EvaluationResult:
  automated verification output for one run

ReviewDecision:
  human decision: accepted, rejected, or escalated

Verified outcome:
  translated PDF that has passed evaluation sufficiently and has been accepted by reviewer
```

Cost per verified outcome:

```text
total cost of all attempts / number of accepted outcomes
```

Unit margin:

```text
value per accepted PDF - cost per verified outcome
```

## 6. Workflow variants

### V1_TEXT_ONLY

Purpose: baseline translation path.

Stages:

```text
inspect_pdf
extract_text_layout
chunk_and_align
translate_text_chunks
recompose_pdf
evaluate_translation
reviewer_decision
finalize_economics
```

Expected behavior:

```text
Main document text is translated.
Table text is translated where extractable.
Text embedded in images is not translated.
Evaluation may warn about untranslated image text.
Reviewer may still accept if image text is non-material.
```

### V2_TEXT_AND_IMAGE_ANNOTATION

Purpose: expanded capability path.

Stages:

```text
inspect_pdf
extract_text_layout
extract_images
chunk_and_align
translate_text_chunks
translate_image_text
recompose_pdf
evaluate_translation
reviewer_decision
finalize_economics
```

Expected behavior:

```text
Main text is translated.
Relevant text inside images is translated.
Image text is represented as annotations, callouts, captions, or overlays.
Full image inpainting is not required.
Ledger shows higher tool/model cost than V1.
```

### V3_OPTIMIZED

Purpose: architecture optimization path.

Stages:

```text
inspect_pdf
route_document
extract_text_layout
selective_extract_images
chunk_and_align
batch_translate_text_chunks
selective_translate_image_text
recompose_pdf
evaluate_translation
reviewer_decision
finalize_economics
```

Expected behavior:

```text
Main text quality should be comparable to V2.
Only material image text should be translated.
Decorative or low-materiality image processing should be skipped.
Ledger should show avoided work compared with V2.
Comparison view should show whether optimization improves margin.
```

V3 is not “use a cheaper model.” V3 is “change the architecture so the workflow does less unnecessary work.”

## 7. MVP input document

Primary controlled document:

```text
Title: Procedimiento de Reembolsos y Elegibilidad
Language: Spanish
Target: English
Length: 4 pages
Format: digitally generated PDF
Content: refund eligibility / support-resolution policy
```

Required content:

```text
Page 1: overview paragraphs.
Page 2: rules and exceptions.
Page 3: SLA / decision table.
Page 4: embedded process diagram with Spanish labels.
```

Required glossary:

```text
reembolso → refund
elegibilidad → eligibility
contracargo → chargeback
revisión manual → manual review
caso escalado → escalated case
```

Page 4 diagram labels:

```text
Recibir solicitud
Validar compra
Evaluar elegibilidad
Aprobar reembolso
Escalar revisión
Cerrar caso
```

Also include one decorative image without material text so V3 has a legitimate reason to skip non-material image work.

## 8. User journeys

### Journey 1 — Upload and inspect document

A user uploads a Spanish PDF. The app stores it in S3, creates a `Document`, creates a `SOURCE_PDF` artifact, runs inspection, and updates document status.

Success state:

```text
Document status = READY
Inspection metadata is visible
Source PDF artifact is downloadable/viewable
```

Failure state:

```text
Document status = UNSUPPORTED or FAILED_INSPECTION
The UI explains why
No TranslationJob can be started for unsupported documents
```

### Journey 2 — Create translation job

A user opens a ready document, selects a workflow variant, configures business value assumptions, and creates a `TranslationJob`.

Success state:

```text
TranslationJob status = CREATED
Workflow variant is locked for the job
Price book version is recorded
Value model is recorded
```

### Journey 3 — Execute run

A user starts a run for a job. The Control API creates the `Run` and invokes AgentCore Runtime. The Strands agent executes the fixed stage plan and calls tools through AgentCore Gateway.

Success state:

```text
Run status = AWAITING_REVIEW
StageEvents exist for all executed stages
Artifacts exist for durable outputs
LedgerItems exist for model/tool/runtime/retry costs where available
EvaluationResult exists
Translated PDF artifact exists
```

### Journey 4 — Review output

A user opens the run, compares the source and translated PDFs, reviews evaluation results, and accepts, rejects, or escalates the run.

Accepted run success state:

```text
Run status = ACCEPTED
TranslationJob status = ACCEPTED
ReviewDecision exists
HUMAN_REVIEW ledger item exists
Cost per verified outcome is calculated
Unit margin is calculated
```

Rejected run success state:

```text
Run status = REJECTED
TranslationJob status = REJECTED
Full workflow cost remains visible
Cost per verified outcome is null
Unit margin is null
```

### Journey 5 — Compare V1, V2, and V3

A user creates V1, V2, and V3 jobs for the same document under one `comparisonGroupId`, executes each, reviews each, and opens comparison view.

Success state:

```text
Comparison table shows all three variants.
Each variant shows outcome, evaluation score, LLM-only cost, full workflow cost, review cost, retry/remediation cost, cost per verified outcome, unit value, and unit margin.
The user can see whether added capability or optimization changed economics.
```

## 9. Functional requirements

```text
FR-001 Document upload:
  allow PDF upload through presigned S3 URL; reject non-PDF; create SOURCE_PDF artifact.

FR-002 Document inspection:
  detect page count, text block count, image count, scanned-page estimate, source language, layout complexity, warnings; block unsupported documents.

FR-003 Translation job creation:
  workflow variant, value model, and price book version are required; job starts CREATED.

FR-004 Run creation:
  create technical attempt for job; attempt number increments; run starts QUEUED; job becomes RUNNING; Control API invokes AgentCore Runtime.

FR-005 Agent stage execution:
  execute fixed stage plan based on variant; create StageEvents; technical failures mark run FAILED; evaluation failure remains reviewable.

FR-006 Gateway tool execution:
  call deterministic tools through AgentCore Gateway; tools receive artifact references; tools return artifacts, metrics, warnings, ledger drafts.

FR-007 Text translation:
  translate extracted chunks with Bedrock Converse; preserve chunk IDs; enforce glossary; capture token usage; create MODEL_INFERENCE rows.

FR-008 Image-text translation:
  V1 skips image text; V2 translates likely text-bearing images; V3 translates material image text only; use callouts/captions/overlays.

FR-009 PDF recomposition:
  create readable translated PDF with approximate layout; generate previews or reliable PDF preview; record layout warnings.

FR-010 Evaluation:
  check missing chunks, untranslated Spanish, glossary consistency, PDF validity, layout warnings, semantic coverage; persist EvaluationResult and EVALUATION_JSON.

FR-011 Reviewer decision:
  only AWAITING_REVIEW runs can be reviewed; reviewer time required; create ReviewDecision and HUMAN_REVIEW ledger row; update job economics.

FR-012 Cost ledger:
  normalize model, runtime, gateway, policy, memory, external, review, retry, remediation costs; show LLM-only and full workflow cost separately.

FR-013 Cost basis labeling:
  label telemetry-derived estimate, AWS-bill reconciled, or mixed; do not imply bill reconciliation unless implemented.

FR-014 Job economics:
  calculate accepted job cost per verified outcome and unit margin; rejected jobs show cost but no verified outcome.

FR-015 Comparison:
  compare jobs by comparison group; show cost, outcome, quality, margin, and component breakdown.

FR-016 Observability linkage:
  include trace/span IDs where available; logs include runId, jobId, documentId, stageName.

FR-017 Price book management:
  expose active price book; model, AgentCore, external service, and human review rates are configurable.
```

## 10. Data requirements

Persist these entities:

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

Minimum durable artifacts:

```text
SOURCE_PDF
INSPECTION_JSON
TEXT_LAYOUT_JSON
IMAGE_MANIFEST_JSON
IMAGE_ASSET
SOURCE_CHUNKS_JSON
TRANSLATED_CHUNKS_JSON
IMAGE_TRANSLATION_JSON
TRANSLATED_PDF
PDF_PREVIEW_PNG
EVALUATION_JSON
LEDGER_EXPORT_JSON
```

The LedgerItems table is the product source of truth for economics. Logs and traces are for debugging and reconciliation, not the only cost record.

## 11. API requirements

Documents:

```text
POST /api/documents/presign
POST /api/documents
GET  /api/documents
GET  /api/documents/{documentId}
POST /api/documents/{documentId}/inspect
GET  /api/documents/{documentId}/jobs
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
POST /api/runs/{runId}/review
```

Comparison/settings:

```text
GET /api/compare
GET /api/price-books/current
PUT /api/price-books/current
```

All API errors use:

```json
{
  "error": {
    "code": "DOCUMENT_UNSUPPORTED",
    "message": "This PDF appears to contain scanned pages. OCR workflow is not enabled for the MVP.",
    "details": {
      "estimatedScannedPageCount": 4
    }
  }
}
```

## 12. UX requirements

The UI must expose:

```text
Document → TranslationJob → Run → Evaluation → ReviewDecision → Economics
```

Required pages:

```text
Document Library
Upload Document
Document Detail
Create Translation Job
Translation Job Detail
Run Detail
PDF Result View
Evaluation View
Cost Ledger View
Comparison View
Economics Settings
```

Required components:

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
PdfSideBySideViewer
EvaluationScoreGrid
ReviewDecisionForm
LedgerSummaryCards
LedgerTable
ComparisonTable
CostComponentBarChart
UnitMarginBarChart
PriceBookEditor
```

The UI must distinguish:

```text
LLM-only cost vs full workflow cost
Run-level cost vs job-level economics
Completed run vs accepted outcome
Estimated cost vs bill-reconciled cost
Rejected work still consumed cost
V2 capability cost vs V3 optimization savings
```

## 13. Technical requirements

```text
Deployment: us-east-1
Infrastructure: AWS CDK TypeScript
Frontend: Next.js / React / TypeScript
Control API: TypeScript Lambda behind API Gateway
Agent: TypeScript Strands agent on AgentCore Runtime
Tools: Lambda targets exposed through AgentCore Gateway
Storage: S3
Database: DynamoDB
Model calls: Amazon Bedrock Converse API
Observability: AgentCore Observability + CloudWatch
```

Use TypeScript for frontend, API, schemas, costing, repositories, agent runtime, and infrastructure. Use Python only for PDF extraction/recomposition if TypeScript PDF tooling is materially worse.

## 14. State transitions

Document:

```text
UPLOADED → INSPECTING → READY
UPLOADED → INSPECTING → UNSUPPORTED
UPLOADED → INSPECTING → FAILED_INSPECTION
READY → INSPECTING, only for reinspection
UNSUPPORTED → job creation is disallowed
FAILED_INSPECTION → job creation is disallowed
```

TranslationJob:

```text
CREATED → RUNNING
RUNNING → AWAITING_REVIEW
RUNNING → FAILED
AWAITING_REVIEW → ACCEPTED
AWAITING_REVIEW → REJECTED
AWAITING_REVIEW → ESCALATED
ACCEPTED → RUNNING is disallowed
```

Run:

```text
CREATED → QUEUED → RUNNING → EVALUATING → AWAITING_REVIEW
AWAITING_REVIEW → ACCEPTED
AWAITING_REVIEW → REJECTED
AWAITING_REVIEW → ESCALATED
QUEUED/RUNNING/EVALUATING → FAILED
FAILED → non-terminal state is disallowed
ACCEPTED/REJECTED/ESCALATED → any other state is disallowed
```

Invalid transitions return HTTP `409`.

## 15. Success metrics

Product correctness:

```text
Percentage of runs with complete StageEvents
Percentage of runs with complete LedgerItems
Percentage of runs with translated PDF artifact
Percentage of runs with EvaluationResult
Percentage of accepted jobs with cost per verified outcome
Percentage of ledger rows with priceBookVersion
```

Workflow quality:

```text
Evaluation score by workflow variant
Missing chunk count
Untranslated Spanish count
Terminology score
Layout warning count
Reviewer acceptance rate
Escalation rate
Rejection rate
```

Economic:

```text
LLM-only cost per run
Full workflow cost per run
Non-model cost percentage
Human review cost percentage
Retry/remediation cost
Cost per verified outcome
Unit margin
Margin delta between V1, V2, and V3
```

Operational:

```text
Run duration
Stage duration
Tool invocation count
Gateway errors
Model call failures
Retry count
Technical failure rate
```

## 16. MVP acceptance criteria

```text
1. A controlled Spanish PDF can be uploaded.
2. The PDF can be inspected and marked READY.
3. V1, V2, and V3 TranslationJobs can be created for the same document.
4. Each job can execute at least one real Run through AgentCore Runtime.
5. The agent calls deterministic tools through AgentCore Gateway.
6. Each run creates StageEvents.
7. Each durable output creates Artifacts.
8. Each cost component creates LedgerItems.
9. The app produces a translated English PDF.
10. The app produces an EvaluationResult.
11. A reviewer can accept, reject, or escalate the run.
12. Reviewer time creates human-review cost.
13. Accepted jobs show cost per verified outcome.
14. Accepted jobs show unit margin.
15. Rejected jobs show consumed cost but no verified outcome.
16. The ledger shows LLM-only cost and full workflow cost separately.
17. The comparison view shows V1, V2, and V3 economics side by side.
18. The app labels estimated versus reconciled costs honestly.
19. The app deploys to us-east-1 through CI/CD.
20. The product can be used normally while being recorded externally.
```

## 17. Risks and mitigations

```text
Risk: TypeScript Strands support blocks implementation.
Mitigation: Keep stage runner mostly plain TypeScript; use Strands as wrapper; keep Python fallback only if deployment blocks.

Risk: PDF recomposition consumes too much time.
Mitigation: Use controlled digitally generated PDFs, approximate layout preservation, generated previews, and no scanned-PDF MVP.

Risk: Cost accounting becomes misleading.
Mitigation: Use LedgerItems as source of truth, PriceBook for estimates, explicit cost-basis labels, no bill claims without reconciliation.

Risk: V3 does not demonstrate margin improvement.
Mitigation: Design controlled document with material and non-material image content; make V2 process all likely image text and V3 skip non-material work.

Risk: Product becomes a generic translator.
Mitigation: Keep TranslationJob, ReviewDecision, LedgerItem, and unit economics as first-class objects.
```

## 18. Future enhancements

```text
OCR path for scanned PDFs
Additional languages
Production authentication
AWS bill reconciliation
AgentCore Memory for glossary/reviewer preferences
AgentCore Evaluations as managed evaluation layer, if useful
Textract or Bedrock Data Automation for harder document extraction
Queue-based async orchestration for higher volume
Multi-workspace support
Exportable cost reports
```

## 19. Open decisions

```text
1. Exact Bedrock model IDs for translation and evaluation.
2. Exact PDF extraction/recomposition library.
3. Whether PdfPipelineTools should be Python container Lambda or TypeScript Lambda.
4. Whether AgentCore Policy is implemented before or after first end-to-end V1.
5. Whether runtime cost is initially omitted, estimated, or reconciled.
6. Exact placeholder price-book values for first deployment.
7. Whether frontend is hosted on S3 + CloudFront or Amplify.
8. Whether dev API is protected with basic auth, private access, or Cognito.
```
