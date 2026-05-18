# 06 — Frontend and API contract v0.5

## UI information architecture

Primary routes:

```text
/                                   redirect to /documents
/documents                           Document Library
/documents/new                       Upload Document
/documents/:documentId               Document Detail
/documents/:documentId/jobs/new      Create Translation Job
/jobs/:jobId                         Translation Job Detail
/jobs/:jobId/runs/:runId             Run Detail
/jobs/:jobId/runs/:runId/result      PDF Result View
/jobs/:jobId/runs/:runId/evaluation  Evaluation View
/jobs/:jobId/runs/:runId/ledger      Cost Ledger View
/compare/:comparisonGroupId          Run / Job Comparison View
/settings/economics                  Price Book and Value Settings
```

Top-level mental model:

```text
Document → Translation Job → Run → Outcome → Economics
```

## Shared frontend layout

```text
Top nav:
  Documents
  Compare
  Economics Settings

Page header:
  title
  subtitle
  primary action
  secondary actions

Main content:
  page-specific panels

Right rail where relevant:
  current business unit
  workflow variant
  status
  cost basis
  latest outcome
```

For MVP, no complex auth or multi-tenant UX is necessary. Store `workspaceId = ws_default`.

## Status and label conventions

```text
Document:
  UPLOADED
  INSPECTING
  READY
  UNSUPPORTED
  FAILED_INSPECTION

Job:
  CREATED
  RUNNING
  AWAITING_REVIEW
  ACCEPTED
  REJECTED
  ESCALATED
  FAILED

Run:
  CREATED
  QUEUED
  RUNNING
  EVALUATING
  AWAITING_REVIEW
  ACCEPTED
  REJECTED
  ESCALATED
  FAILED

Stage:
  PENDING
  RUNNING
  SUCCEEDED
  FAILED
  SKIPPED

Cost basis labels:
  Telemetry-derived price-book estimate
  AWS-bill reconciled
  Mixed estimate/reconciled
```

The UI must not imply that price-book estimates are actual AWS bill values.

## Page contracts

### Document Library

Route:

```text
GET /documents
GET /api/documents
```

Purpose: show all source documents and latest economic status.

Table columns:

```text
Document
Source → Target
Pages
Images
Status
Latest job outcome
Latest full workflow cost
Latest unit margin
Updated
Actions
```

Actions:

```text
Open
Start job
Compare jobs
```

### Upload Document

Route:

```text
GET /documents/new
POST /api/documents/presign
POST /api/documents
POST /api/documents/{documentId}/inspect
```

Flow:

```text
1. User selects PDF.
2. Frontend requests presigned upload URL.
3. Frontend uploads directly to S3.
4. Frontend creates Document record.
5. Frontend starts inspection.
6. Frontend navigates to Document Detail.
```

Validation:

```text
Reject non-PDF uploads.
Warn if file is too large.
Warn if scanned pages are detected.
Warn if detected source language does not look Spanish.
Do not start jobs for UNSUPPORTED documents unless an explicit override is later added.
```

### Document Detail

Route:

```text
GET /documents/:documentId
GET /api/documents/{documentId}
GET /api/documents/{documentId}/jobs
```

Sections:

```text
Document summary
Inspection results
Source PDF preview/download
Historical translation jobs
Start new job action
```

Historical jobs table:

```text
Workflow variant
Status
Attempts
Accepted run
LLM-only cost
Full workflow cost
Unit value
Unit margin
Created
```

### Create Translation Job

Route:

```text
GET /documents/:documentId/jobs/new
POST /api/documents/{documentId}/jobs
```

Fields:

```text
Workflow variant
Value per accepted PDF
Manual translation baseline
Manual review baseline
Human review hourly rate
Enable policy checks
Enable memory
Layout preservation
Create comparison group checkbox
```

Default values:

```text
valuePerAcceptedPdfUsd: 75.00
manualTranslationBaselineUsd: 60.00
manualReviewBaselineUsd: 15.00
humanReviewHourlyRateUsd: 90.00
enablePolicyChecks: true
enableMemory: false
preserveLayout: APPROXIMATE
```

Workflow variant copy:

```text
V1_TEXT_ONLY:
  Translates extracted PDF text. Does not translate text embedded inside images.

V2_TEXT_AND_IMAGE_ANNOTATION:
  Translates extracted PDF text and adds annotations/callouts for text found in images.

V3_OPTIMIZED:
  Uses routing and selective image handling to avoid unnecessary work while preserving accepted output quality.
```

### Translation Job Detail

Route:

```text
GET /jobs/:jobId
GET /api/jobs/{jobId}
GET /api/jobs/{jobId}/runs
GET /api/jobs/{jobId}/economics
POST /api/jobs/{jobId}/runs
```

Sections:

```text
Job summary
Economics summary
Latest outcome
Run attempts
Artifacts from accepted run
Actions
```

Cards:

```text
Job status
Workflow variant
Total attempts
Accepted run
LLM-only cost
Full workflow cost
Cost per verified outcome
Unit value
Unit margin
```

Run attempts table:

```text
Attempt
Run status
Started
Completed
Evaluation score
Reviewer decision
Full workflow cost
Failure reason
Open
```

### Run Detail

Route:

```text
GET /jobs/:jobId/runs/:runId
GET /api/runs/{runId}
GET /api/runs/{runId}/timeline
```

Tabs:

```text
Timeline
Result
Evaluation
Ledger
```

Timeline row fields:

```text
sequence
stage name
status
duration
tool/model
input artifact count
output artifact count
retry count
warnings
trace/span IDs
```

Expandable detail:

```text
Input artifacts
Output artifacts
Metrics
Ledger rows from that stage
Warnings
Error message
```

### PDF Result View

Route:

```text
GET /jobs/:jobId/runs/:runId/result
GET /api/runs/{runId}/artifacts
```

Layout:

```text
Left pane: source Spanish PDF preview
Right pane: translated English PDF preview
Top controls: page number, zoom, download source, download translated
Bottom/right panel: output warnings
```

Behavior:

```text
Show translated PDF only when translatedPdfArtifactId exists.
Show image annotations/callouts for V2/V3 if present.
Show warning if V1 leaves embedded image text untranslated.
Show artifact links generated through presigned URLs.
```

### Evaluation View

Route:

```text
GET /jobs/:jobId/runs/:runId/evaluation
GET /api/runs/{runId}/evaluation
POST /api/runs/{runId}/review
```

Sections:

```text
Evaluation summary
Deterministic checks
Model-based scores
Warnings
Reviewer decision form
```

Summary cards:

```text
Overall score
Passed automated checks
Semantic coverage
Terminology score
Layout score
Image-text score
Missing chunks
Untranslated Spanish count
```

Reviewer form:

```text
Decision:
  Accept
  Reject
  Escalate

Reviewer time:
  seconds or mm:ss

Reason:
  optional text
```

Behavior:

```text
Run must be AWAITING_REVIEW before reviewer action.
Reviewer action creates ReviewDecision.
Reviewer action creates HUMAN_REVIEW LedgerItem.
Reviewer action recalculates run and job economics.
Accepted job receives costPerVerifiedOutcomeUsd and unitMarginUsd.
Rejected job keeps costPerVerifiedOutcomeUsd null.
Escalated job keeps outcome escalated/unresolved depending on final product rule.
```

### Cost Ledger View

Route:

```text
GET /jobs/:jobId/runs/:runId/ledger
GET /api/runs/{runId}/ledger
```

Top summary:

```text
LLM-only cost
Full workflow cost
Difference = Full workflow cost − LLM-only cost
Human review cost
Retry/remediation cost
Cost basis
Price book version
```

Ledger columns:

```text
Stage
Component type
Component name
Billable unit
Unit count
Unit price
Estimated cost
Actual cost
Cost source
Retry count
Trace ID
Span ID
```

Filters:

```text
Component type
Stage
Cost source
Model/tool
Only non-model costs
Only retry/remediation costs
```

Group-by options:

```text
By component type
By stage
By model/tool
By cost source
```

Do not hide tiny cost rows if they explain the architecture.

### Job-Level Ledger and Economics

Route:

```text
GET /jobs/:jobId/ledger
GET /jobs/:jobId/economics
```

Purpose: show cost of the business task across all technical attempts. This is distinct from the run ledger.

Accepted job example semantics:

```text
acceptedOutcomeCount: 1
costPerVerifiedOutcomeUsd: full cost across all attempts
unitMarginUsd: unitValueUsd - costPerVerifiedOutcomeUsd
```

Rejected job semantics:

```text
acceptedOutcomeCount: 0
costPerVerifiedOutcomeUsd: null
unitMarginUsd: null
fullWorkflowCostUsd still visible
```

### Comparison View

Route:

```text
GET /compare/:comparisonGroupId
GET /api/compare?comparisonGroupId=...
```

Default rows:

```text
V1_TEXT_ONLY
V2_TEXT_AND_IMAGE_ANNOTATION
V3_OPTIMIZED
```

Summary cards:

```text
Lowest full workflow cost
Highest unit margin
Best accepted quality
Most expensive stage
Cost saved by optimized architecture
```

Table columns:

```text
Workflow variant
Job status
Accepted run
Evaluation score
Reviewer decision
LLM-only cost
Full workflow cost
Human review cost
Retry/remediation cost
Cost per verified outcome
Unit value
Unit margin
Warnings
```

Charts:

```text
Bar chart: full workflow cost by variant
Bar chart: unit margin by variant
Stacked bar: cost component mix by variant
```

Charts should be simple. Accurate attribution matters more than visual sophistication.

### Economics Settings

Route:

```text
GET /settings/economics
GET /api/price-books/current
PUT /api/price-books/current
```

Sections:

```text
Active price book
Model prices
AgentCore prices
External service prices
Default human review rate
Value model defaults
```

Fields:

```text
priceBookVersion
status
currency
model input token price per 1K
model output token price per 1K
runtime vCPU-hour price
runtime GB-hour price
gateway operation price
policy authorization request price
memory event price
external page/image/document prices
default human review hourly rate
source notes
```

Seed placeholder price values only if clearly marked placeholders.

## API error contract

Use one consistent error shape:

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

Common error codes:

```text
VALIDATION_ERROR
DOCUMENT_NOT_FOUND
DOCUMENT_UNSUPPORTED
JOB_NOT_FOUND
RUN_NOT_FOUND
ARTIFACT_NOT_FOUND
RUN_NOT_REVIEWABLE
JOB_ALREADY_RUNNING
PDF_INSPECTION_FAILED
AGENT_INVOCATION_FAILED
TOOL_EXECUTION_FAILED
BEDROCK_CALL_FAILED
PRICE_BOOK_NOT_FOUND
INTERNAL_ERROR
```

HTTP status guidance:

```text
400 validation or unsupported input
404 missing resource
409 invalid state transition
500 internal failure
502/504 downstream service failure
```

## Frontend component inventory

```text
StatusBadge
CostBasisBadge
WorkflowVariantBadge
MoneyValue
PercentScore
DocumentSummaryCard
InspectionPanel
ValueModelForm
WorkflowVariantSelector
JobEconomicsCards
RunSummaryCards
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

## Frontend state management

```text
Next.js app router
React Query or SWR for API data
Poll active runs every 2–5 seconds
Stop polling when run status is terminal or AWAITING_REVIEW
Use optimistic UI only for small form actions, not run execution
```

Polling states:

```text
Document INSPECTING
Run QUEUED
Run RUNNING
Run EVALUATING
```

Stop polling when:

```text
Document READY
Document UNSUPPORTED
Document FAILED_INSPECTION
Run AWAITING_REVIEW
Run ACCEPTED
Run REJECTED
Run ESCALATED
Run FAILED
```

## State transition rules

Document:

```text
UPLOADED → INSPECTING → READY
UPLOADED → INSPECTING → UNSUPPORTED
UPLOADED → INSPECTING → FAILED_INSPECTION
```

Job:

```text
CREATED → RUNNING
RUNNING → AWAITING_REVIEW
AWAITING_REVIEW → ACCEPTED
AWAITING_REVIEW → REJECTED
AWAITING_REVIEW → ESCALATED
RUNNING → FAILED
```

Run:

```text
CREATED → QUEUED → RUNNING → EVALUATING → AWAITING_REVIEW
AWAITING_REVIEW → ACCEPTED
AWAITING_REVIEW → REJECTED
AWAITING_REVIEW → ESCALATED
QUEUED/RUNNING/EVALUATING → FAILED
```

Invalid transitions return `409`.

## MVP acceptance criteria for frontend/API

```text
The user can upload and inspect a Spanish PDF.
The user can create a TranslationJob for V1, V2, or V3.
The user can start a Run for a TranslationJob.
The user can see Run progress through a stage timeline.
The user can open source and translated PDF artifacts.
The user can see automated evaluation results.
The user can accept, reject, or escalate a run.
The reviewer decision adds human-review cost.
The user can see LLM-only cost and full workflow cost separately.
The user can see job-level cost per verified outcome after acceptance.
The user can compare V1, V2, and V3 jobs for the same document.
The user can edit or inspect the active price book.
The UI labels estimated versus reconciled cost correctly.
Invalid state transitions return consistent errors.
```
