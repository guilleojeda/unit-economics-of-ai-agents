# 03 — Product UI and workflow spec v0.2

## Corrected baseline

The product has no:

```text
LIVE_CAPTURE
REPLAY_CAPTURED
SYNTHETIC_SEED
recording mode
presentation mode
```

A run is a real product run. Historical runs are normal product history, not replay.

Seed data may exist only in local development, tests, or demo-environment setup. It is not a user-facing product capability.

The recorded video is external to the product. The video records the product operating normally.

The product requirement is:

```text
observability
auditability
economic transparency
```

Those are normal product requirements, not recording-specific requirements.

## Product objects

```text
Document:
  uploaded Spanish PDF and inspection metadata

Run:
  one execution attempt

Artifact:
  source PDF, extracted layout JSON, extracted images, translated chunks, final PDF, page previews, evaluation report

StageEvent:
  workflow step with status, timing, tool/model metadata, trace IDs, warnings, errors

LedgerItem:
  normalized cost row

EvaluationResult:
  automated verification output

ReviewDecision:
  human accept/reject/escalate decision

PriceBook:
  configured unit prices used to turn telemetry into estimated dollars

ValueModel:
  configured business value assumptions
```

Later refinement: introduce `TranslationJob` between `Document` and `Run`.

## Main screens

### 1. Document Library

Purpose: manage PDFs that can be translated.

Visible information:

```text
document title
source language
target language
page count
image count
last run status
last accepted run
last full workflow cost
last unit margin
```

Primary actions:

```text
Upload PDF
Open document
Start new run from document
Compare previous runs for document
```

Validation:

```text
Only PDFs are accepted.
Warn when file appears scanned, too large, or outside supported page-count range.
Controlled digitally generated PDFs first.
Arbitrary scanned PDFs are not an MVP guarantee.
```

### 2. Upload / Inspect Document

Flow:

```text
1. UI requests presigned S3 upload URL.
2. User uploads PDF to S3.
3. Control API creates Document.
4. App invokes inspect_pdf.
5. Inspection result updates document metadata.
```

Inspection output shown:

```text
Pages
Text blocks
Images
Estimated scanned pages
Detected source language
Layout complexity
Supported / unsupported
Warnings
Recommended workflow variant
```

Unsupported documents should explain why.

### 3. Document Detail / Run Configuration

Required configuration:

```text
Workflow variant:
  V1_TEXT_ONLY
  V2_TEXT_AND_IMAGE_ANNOTATION
  V3_OPTIMIZED

Source language:
  Spanish

Target language:
  English

Value per accepted PDF:
  configurable dollar amount

Human review hourly rate:
  configurable dollar amount

Layout preservation:
  approximate

Policy checks:
  enabled by default

Memory:
  disabled by default unless glossary memory is added
```

Workflow variant selector:

```text
V1_TEXT_ONLY:
  lowest capability, lowest expected cost

V2_TEXT_AND_IMAGE_ANNOTATION:
  translates text plus image text annotations, higher cost

V3_OPTIMIZED:
  routes selectively, batches work, narrows review, intended to improve margin
```

### 4. Run Detail / Timeline

Run states:

```text
CREATED
QUEUED
RUNNING
EVALUATING
AWAITING_REVIEW
ACCEPTED
REJECTED
ESCALATED
FAILED
```

Stage states:

```text
PENDING
RUNNING
SUCCEEDED
FAILED
SKIPPED
```

Timeline stages:

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
write_cost_ledger
```

Timeline row fields:

```text
stage status
duration
tool name
model ID
retry count
warnings
error message
trace ID
span ID
input artifacts
output artifacts
```

### 5. PDF Result View

Layout:

```text
Source PDF on left.
Translated PDF on right.
Page selector.
Zoom controls.
Artifact download links.
Image-translation annotations where applicable.
```

For V1:

```text
Embedded Spanish text inside images may remain untranslated.
The UI should show evaluation warnings.
```

For V2/V3:

```text
Translated image text should appear as annotations or overlays.
Full image inpainting is not required.
```

### 6. Evaluation View

Evaluation categories:

```text
Semantic coverage
Missing chunks
Untranslated Spanish text
Terminology consistency
Layout warnings
Image-text handling
Overall pass/fail
```

Reviewer actions:

```text
Accept
Reject
Escalate
```

Accepted means the translated PDF counts in the denominator for cost-per-verified-outcome. Rejected means the run consumed cost but did not produce a verified outcome. Escalated means a human workflow is required and human review/remediation cost must be added.

### 7. Cost Ledger View

Top cards:

```text
LLM-only cost
Full workflow cost
Cost per verified outcome
Configured value per accepted PDF
Unit margin
```

Ledger table columns:

```text
Stage
Component type
Component name
Billable unit
Unit count
Unit price
Estimated cost
Cost source
Trace ID
Span ID
Retry count
```

Component types:

```text
MODEL_INFERENCE
AGENTCORE_RUNTIME
AGENTCORE_GATEWAY
AGENTCORE_POLICY
AGENTCORE_MEMORY
EXTERNAL_SERVICE
HUMAN_REVIEW
RETRY
REMEDIATION
```

Cost source values:

```text
BEDROCK_RESPONSE_USAGE
AGENTCORE_RUNTIME_METRIC
AGENTCORE_GATEWAY_METRIC
AGENTCORE_POLICY_METRIC
AGENTCORE_MEMORY_METRIC
EXTERNAL_SERVICE_METRIC
HUMAN_REVIEW_TIMER
PRICE_BOOK_ESTIMATE
AWS_BILL_RECONCILED
```

Default MVP cost basis:

```text
Telemetry-derived units × configured price book
```

### 8. Run Comparison View

Supported comparisons:

```text
Same document, V1 vs V2 vs V3
Same workflow variant across different documents
Accepted vs rejected vs escalated outcomes
Cost by stage
Cost by component
Margin by workflow variant
```

Default comparison:

```text
V1_TEXT_ONLY
V2_TEXT_AND_IMAGE_ANNOTATION
V3_OPTIMIZED
```

Columns:

```text
Workflow variant
Outcome
Automated evaluation score
Reviewer decision
LLM-only cost
Full workflow cost
Review cost
Retry/remediation cost
Cost per verified outcome
Unit value
Unit margin
```

### 9. Price Book / Economics Settings

Configurable fields:

```text
Value per accepted PDF
Manual translation baseline
Manual review baseline
Human reviewer hourly rate
Model input token price
Model output token price
AgentCore Runtime unit prices
Gateway operation unit prices
Policy authorization request unit prices
Memory operation unit prices
External service unit prices
```

Show:

```text
price book version
last updated timestamp
source of pricing values
whether values are estimated or reconciled
```

Never present configured estimates as AWS-bill-reconciled actuals.

## Demo document specification

Title:

```text
Procedimiento de Reembolsos y Elegibilidad
```

Properties:

```text
4 pages
Spanish source language
Digitally generated PDF
One table
One embedded workflow diagram with Spanish labels
One decorative image without relevant text
No personal data
No regulated content
No scanned pages
```

Required glossary:

```text
reembolso -> refund
elegibilidad -> eligibility
contracargo -> chargeback
revisión manual -> manual review
caso escalado -> escalated case
```

Diagram labels:

```text
Recibir solicitud
Validar compra
Evaluar elegibilidad
Aprobar reembolso
Escalar revisión
Cerrar caso
```

Recommended default behavior:

```text
V1 completes and can be acceptable with warnings if image text is non-critical.
V2 produces a more complete output at higher cost.
V3 preserves quality benefit of V2 while reducing unnecessary work through routing and selective image-text handling.
```

## Tool implementation split

Use TypeScript for:

```text
Control API
Frontend
CDK
Strands agent
Schemas
Cost ledger
Price book
Evaluation orchestration
```

Use Python only where needed:

```text
PDF text/layout extraction
PDF recomposition
Image extraction
Image annotation/overlay
```

## Corrected ADR backlog

Remove recording-driven ADRs and replace with:

```text
ADR-013: The product performs real workflow runs only; recording the product is external to product behavior.
ADR-014: Use TypeScript Strands as the primary AgentCore Runtime agent implementation.
ADR-015: Keep a Python fallback only for PDF/image tooling where TypeScript is materially weaker.
ADR-016: Expose deterministic document-processing operations through AgentCore Gateway.
ADR-017: Support historical run comparison as normal product analytics, not replay.
ADR-018: Keep cost-basis labeling in the product: telemetry estimate, price-book estimate, or AWS-bill-reconciled.
ADR-019: Treat translation as a structured workflow stage, not unconstrained agent reasoning.
```
