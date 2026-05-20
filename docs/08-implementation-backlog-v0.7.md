# 08 — Implementation backlog v0.7

## Build strategy

Build the product in vertical slices, not by completing every infrastructure component first.

First slice:

```text
Document → TranslationJob → Run → StageEvents → LedgerItems → ReviewDecision → Job economics
```

Second slice:

```text
S3 + DynamoDB + Control API
```

Third slice:

```text
AgentCore Runtime + Gateway + tool Lambdas
```

Fourth slice:

```text
real document processing and Bedrock calls
```

The app’s economic model and UI should be correct before deep AWS service integration.

## Milestones

### Milestone 0 — Repository foundation

Goal: create a working monorepo with shared schemas, type checking, and test setup.

Deliverables:

```text
Monorepo scaffold
TypeScript package setup
Shared Zod schemas
Costing package skeleton
Data repository interfaces
Basic frontend shell
Basic CDK app shell
CI checks
```

Acceptance criteria:

```text
pnpm install succeeds.
pnpm typecheck succeeds.
pnpm test succeeds.
pnpm lint succeeds.
cdk synth succeeds for empty/base stacks.
Shared schemas export Document, TranslationJob, Run, StageEvent, Artifact, LedgerItem, EvaluationResult, ReviewDecision, PriceBook.
```

### Milestone 1 — Product model and economics without AWS workflow execution

Goal: make the business model work before wiring the agent.

Deliverables:

```text
Fixture-backed frontend
Fixture-backed Control API or mock API layer
TranslationJob and Run screens
Stage timeline screen
Ledger screen
Review decision flow
Run comparison screen
Price book screen
Cost rollup functions
```

Acceptance criteria:

```text
A fixture document appears in the Document Library.
A fixture job appears on the Document Detail page.
A fixture run shows stage events.
The ledger shows LLM-only cost and full workflow cost separately.
A reviewer decision changes job status to ACCEPTED, REJECTED, or ESCALATED.
Accepted jobs show cost per verified outcome and unit margin.
Rejected jobs show cost consumed but no verified outcome.
Comparison view shows V1, V2, and V3 jobs for the same document.
No AWS services are required for this milestone.
```

### Milestone 2 — CI-backed AWS dev deployment, DynamoDB, S3, and Control API

Goal: establish CI-owned AWS deployment, then replace fixtures with real persistence and artifact storage.

The first deliverable in this milestone is `PR-009 - CI-backed dev deployment pipeline`. It is the next task and must follow `docs/codex/PR-009-CI-DEPLOYMENT-PIPELINE.md`.

No Persistent Control API work, AgentCore integration, Bedrock call, PDF processing, frontend hosting, or later product behavior may be accepted before PR-009 is merged, deployed from `main` by the normal CI path, directly verified by Codex against the deployed API/app, and recorded with evidence in `PLAN.md`.

Deliverables:

```text
DynamoDB tables
S3 artifact bucket
Control API Lambda
GitHub Actions dev deployment through CDK/IaC
Protected deployment environment or equivalent guardrail
Post-deploy smoke verification
Presigned upload endpoint
Document creation
Document inspection endpoint placeholder
Job creation
Run creation placeholder
Run/timeline/ledger/evaluation/artifact read endpoints
Review endpoint
Price book endpoint
```

Acceptance criteria:

```text
PR-009 deploys the current dev CDK stacks to us-east-1 through CI/CD.
The deployment is triggered by the normal post-merge main path, not by local cdk deploy or manual AWS changes.
The CI deployment captures stack outputs, including ControlApiUrl.
Codex directly exercises the deployed placeholder Control API or deployed app and records evidence in PLAN.md.
Persistent Control API behavior remains deferred until PR-010.
POST /api/documents/presign returns a presigned S3 upload URL.
POST /api/documents creates a Document and SOURCE_PDF Artifact.
GET /api/documents returns persisted documents.
POST /api/documents/{documentId}/jobs creates a TranslationJob.
POST /api/jobs/{jobId}/runs creates a Run record.
GET /api/runs/{runId}/timeline returns persisted StageEvents.
POST /api/runs/{runId}/review creates a ReviewDecision and HUMAN_REVIEW LedgerItem.
GET /api/jobs/{jobId}/economics returns recalculated job economics.
GET /api/price-books/current returns the active PriceBook.
The merged SHA deploys to us-east-1 through CI, not through local cdk deploy.
Codex verifies the deployed API directly and records evidence.
```

Persistent Control API work must not be accepted before the CI-backed deployment path exists and PR-009 has met the acceptance criteria in `docs/codex/PR-009-CI-DEPLOYMENT-PIPELINE.md`.

### Milestone 3 — Local/tool-simulated workflow

Goal: execute a real workflow shape without AgentCore yet.

This is not a fake product mode. It is a development implementation path to prove the workflow contracts before deploying AgentCore.

Deliverables:

```text
Stage runner
Stage plan builder
Tool request/response contracts
Simulated tool implementations
Artifact draft persistence
Ledger draft persistence
Run status transitions
Evaluation result creation
```

Acceptance criteria:

```text
Starting a run creates StageEvents in the correct sequence for V1, V2, and V3.
Each simulated stage returns artifacts, metrics, warnings, and ledger item drafts.
The run ends in AWAITING_REVIEW.
The run has a translated PDF placeholder artifact.
The run has an evaluation result.
The run ledger is populated from tool outputs.
Run-level and job-level cost rollups are correct.
Invalid state transitions return 409.
```

### Milestone 4 — AgentCore Runtime and Gateway integration

Goal: move the stage coordinator into AgentCore Runtime and expose tools through AgentCore Gateway.

Deliverables:

```text
TypeScript Strands agent runtime
AgentCore Runtime container image
AgentCore Runtime endpoint
AgentCore Gateway
PdfPipelineTools Gateway target
TranslationTools Gateway target
EvaluationTools Gateway target
Agent runtime invocation from Control API
Gateway tool invocation from agent runtime
```

Acceptance criteria:

```text
POST /api/jobs/{jobId}/runs invokes AgentCore Runtime.
AgentCore Runtime loads Document, TranslationJob, Run, and PriceBook from DynamoDB.
Agent executes the correct stage plan.
Agent invokes Gateway tools.
Gateway invokes Lambda tool targets.
Tool responses are persisted as Artifacts, StageEvents, and LedgerItems.
Run ends in AWAITING_REVIEW unless a technical failure occurs.
CloudWatch logs exist for Control API, Runtime, Gateway, and tool Lambdas.
```

### Milestone 5 — Real PDF inspection and text extraction

Goal: process the controlled Spanish PDF.

Acceptance criteria:

```text
The controlled demo PDF uploads successfully.
inspect_pdf detects page count, image count, text block count, scanned-page estimate, source language, and layout complexity.
Unsupported PDFs are marked UNSUPPORTED with a clear reason.
extract_text_layout writes TEXT_LAYOUT_JSON with page coordinates and stable block IDs.
Document Detail shows inspection metadata.
```

### Milestone 6 — Text translation with Bedrock Converse

Goal: translate source text chunks and capture model cost.

Acceptance criteria:

```text
chunk_and_align creates SOURCE_CHUNKS_JSON.
translate_text_chunks calls Bedrock Converse.
The response is validated against schema.
Every input chunk has exactly one translated output chunk.
TRANSLATED_CHUNKS_JSON is written to S3.
MODEL_INFERENCE ledger rows are created from Bedrock usage.
Gateway/tool ledger rows are created.
Malformed model JSON triggers one repair attempt.
Repair attempts create retry/cost evidence.
```

### Milestone 7 — PDF recomposition and previews

Acceptance criteria:

```text
recompose_pdf creates TRANSLATED_PDF.
The translated PDF is readable.
The translated PDF has the same page count as the source unless explicitly warned.
Preview PNGs are generated or browser PDF preview works reliably.
Source and translated PDFs can be viewed side by side.
Layout overflow count is reported.
```

### Milestone 8 — Evaluation and reviewer workflow

Acceptance criteria:

```text
evaluate_translation checks missing chunks, untranslated Spanish, glossary consistency, artifact validity, and layout warnings.
evaluate_translation calls Bedrock for semantic coverage scoring.
EVALUATION_JSON is written to S3.
EvaluationResult is persisted.
Run moves to AWAITING_REVIEW after evaluation.
Reviewer can accept, reject, or escalate.
Reviewer time creates HUMAN_REVIEW cost.
Accepted jobs calculate cost per verified outcome and unit margin.
Rejected jobs retain full cost but no verified outcome.
```

### Milestone 9 — Image extraction and V2 image annotation

Acceptance criteria:

```text
V1 skips image translation and may warn about untranslated image text.
V2 extracts likely text-bearing images.
V2 translates image text into annotations/callouts.
V2 recomposes the translated PDF with image annotations.
Evaluation reflects improved image-text handling.
Ledger shows additional model/tool costs for image translation.
```

### Milestone 10 — V3 optimized route

Acceptance criteria:

```text
V3 translates main document text.
V3 only processes material image text.
V3 skips decorative/low-materiality image handling.
V3 has fewer unnecessary tool/model operations than V2.
Comparison view shows V1, V2, and V3 economics side by side.
The comparison makes clear that V3 is architectural optimization, not just a different model.
```

### Milestone 11 — Observability and cost attribution hardening

Acceptance criteria:

```text
Run, StageEvent, and LedgerItem records carry trace IDs.
Ledger rows can be correlated to stages.
Model inference rows include model ID and token counts.
Gateway/tool rows include tool name.
Cost basis labels distinguish telemetry-derived estimate from AWS-bill-reconciled actual.
The app does not claim bill reconciliation unless implemented.
```

### Milestone 12 — Hardening and final product pass

Acceptance criteria:

```text
The controlled demo PDF can complete V1, V2, and V3.
Each variant can be accepted through reviewer workflow.
Cost ledger rows exist for model, tool, runtime estimate if implemented, policy if enabled, review, retry if any.
Comparison view works from persisted historical jobs.
All major screens are usable from normal product navigation.
Deployment to us-east-1 succeeds from the CI pipeline in a clean environment.
```

## Epic backlog

```text
Epic A — Monorepo and developer workflow
Epic B — Shared schemas
Epic C — Costing package
Epic D — Data repositories
Epic E — S3 artifact repository
Epic F — Control API
Epic G — Frontend
Epic H — Agent runtime
Epic I — Gateway and tool Lambdas
Epic J — PDF pipeline tools
Epic K — Bedrock model tooling
Epic L — Translation tools
Epic M — Evaluation
Epic N — Infrastructure
Epic O — Observability and reconciliation
Epic P — Demo document and product validation
```

## Recommended build order for Codex

Current next task: item 10, `N - CI-backed AWS dev deployment pipeline`. Do not start item 11 or later until item 10 satisfies `docs/codex/PR-009-CI-DEPLOYMENT-PIPELINE.md`.

```text
1. A — Monorepo and developer workflow
2. B — Shared schemas
3. C — Costing package
4. D — Data repository interfaces with in-memory implementations
5. G — Frontend using in-memory/API-shaped fixtures
6. F — Control API skeleton
7. N — CDK Storage/Database/API/Lambda basics
8. D — DynamoDB repository implementations
9. E — S3 artifact repository
10. N — CI-backed AWS dev deployment pipeline
11. F — Full Control API persistence
12. H — Agent runtime stage runner with simulated Gateway client
13. I — Gateway/tool Lambda wrappers
14. N — AgentCore Runtime/Gateway infrastructure
15. H/I — Real AgentCore ↔ Gateway execution
16. J — PDF inspection/text extraction/recomposition
17. K/L — Bedrock translation
18. M — Evaluation
19. L/J — Image translation and annotation
20. O — Observability/cost attribution hardening
21. P — Controlled demo document validation
```

## Critical path

```text
Schemas
Cost rollups
Control API
DynamoDB/S3
Agent stage runner
Gateway tools
PDF text extraction
Bedrock translation
PDF recomposition
Evaluation
Review decision
Ledger
Comparison
```

Not critical path for first working product:

```text
AgentCore Memory
Full runtime cost reconciliation
Complex auth
VPC networking
Full scanned-PDF OCR
Image inpainting
Production billing reconciliation
Sophisticated charting
```

AgentCore Policy is desirable for talk-complete version, but should not block first end-to-end translation workflow.

## Test plan

Unit tests:

```text
Zod schema validation
Costing formulas
State transition validation
S3 key generation
DynamoDB key generation
Tool request/response validation
Translation output alignment validation
Evaluation deterministic checks
Price book lookup
```

Integration tests:

```text
Control API document upload flow
Document → Job → Run creation
Run timeline retrieval
Ledger retrieval
Review decision flow
Price book update flow
Comparison endpoint
S3 JSON artifact write/read
DynamoDB repository queries
```

Agent/tool integration tests:

```text
Agent loads context and executes stage plan.
Agent invokes Gateway tool.
Tool Lambda returns valid ToolResponseBase.
Agent persists artifacts and ledger rows.
Agent handles tool failure.
Agent handles retryable failure.
Agent marks run FAILED for technical failure.
Agent leaves completed failed-evaluation run AWAITING_REVIEW.
```

End-to-end tests:

```text
Upload controlled Spanish PDF.
Inspect document.
Create V1 TranslationJob.
Start V1 Run.
Wait for AWAITING_REVIEW.
Open translated PDF.
Open evaluation.
Accept run.
Verify cost per verified outcome and unit margin.
Repeat for V2.
Repeat for V3.
Open comparison group.
Verify cost and margin comparison.
```

## State-transition matrix

Document:

```text
UPLOADED → INSPECTING: allowed
INSPECTING → READY: allowed
INSPECTING → UNSUPPORTED: allowed
INSPECTING → FAILED_INSPECTION: allowed
READY → INSPECTING: allowed only for reinspection
UNSUPPORTED → job creation: disallowed
FAILED_INSPECTION → job creation: disallowed
```

Job:

```text
CREATED → RUNNING: allowed
RUNNING → AWAITING_REVIEW: allowed
RUNNING → FAILED: allowed
AWAITING_REVIEW → ACCEPTED: allowed
AWAITING_REVIEW → REJECTED: allowed
AWAITING_REVIEW → ESCALATED: allowed
REJECTED → RUNNING: allowed only as remediation attempt if product later supports it
ACCEPTED → RUNNING: disallowed
```

Run:

```text
CREATED → QUEUED: allowed
QUEUED → RUNNING: allowed
RUNNING → EVALUATING: allowed
EVALUATING → AWAITING_REVIEW: allowed
RUNNING/EVALUATING → FAILED: allowed
AWAITING_REVIEW → ACCEPTED: allowed
AWAITING_REVIEW → REJECTED: allowed
AWAITING_REVIEW → ESCALATED: allowed
FAILED → any non-terminal state: disallowed
ACCEPTED/REJECTED/ESCALATED → any other state: disallowed
```

## First slices

Minimal first implementation slice:

```text
Shared schemas
Costing package
In-memory repositories
Frontend with fixture data
Control API shape
Review decision flow
Comparison view
```

First AWS-backed slice:

```text
CI-backed dev deployment pipeline
S3 artifact bucket
DynamoDB tables
Control API Lambda
Document upload
Document creation
Price book seed
Job creation
Run creation
Manual/simulated StageEvents and LedgerItems
Review decision
Job economics
```

First AgentCore slice:

```text
AgentCore Runtime
AgentCore Gateway
One trivial Gateway tool: inspect_pdf_stub
Agent invokes inspect_pdf_stub
StageEvent is persisted
LedgerItem is persisted
Run status updates
```

First real document slice:

```text
inspect_pdf
extract_text_layout
chunk_and_align
translate_text_chunks
recompose_pdf
evaluate_translation
reviewer_decision
```

## Risks and mitigations

```text
Risk: Strands TypeScript support is immature.
Mitigation: Keep agent logic mostly framework-light and portable.

Risk: AgentCore CDK/CloudFormation details differ during implementation.
Mitigation: Isolate AgentCore resources in AgentCoreStack and use L1 constructs where possible.

Risk: PDF layout preservation becomes time-consuming.
Mitigation: Limit MVP to controlled digitally generated PDFs and approximate layout preservation.

Risk: Cost numbers look too small or abstract.
Mitigation: Show LLM-only cost next to full workflow cost and include human review and margin.

Risk: Runtime cost reconciliation is hard.
Mitigation: Label runtime rows as telemetry-derived estimates unless reconciliation exists.

Risk: V3 does not clearly improve margin.
Mitigation: Design controlled PDF with both material and non-material image content; make V3 skip non-material work.
```

## Definition of talk-complete

```text
A controlled Spanish PDF can be uploaded and inspected.
V1, V2, and V3 TranslationJobs can be created for the same document.
Each job can execute a real Run through AgentCore Runtime.
Each run uses AgentCore Gateway tools.
Each run produces a translated PDF artifact.
Each run produces StageEvents, Artifacts, LedgerItems, and EvaluationResult.
Reviewer decisions update outcomes and add human-review cost.
Accepted jobs show cost per verified outcome and unit margin.
The ledger shows LLM-only cost separately from full workflow cost.
The comparison view shows how architecture changes cost and margin.
The UI labels cost basis honestly.
The app is deployed in us-east-1 through CI/CD.
```
