# 01 — Initial framing and recommendations

## Product framing

Do not build “a PDF translator.” Build a cost-instrumented document-translation agent whose output is both a translated PDF and a unit-economics ledger.

The talk’s thesis is:

```text
Start with business value.
Measure the full end-to-end cost.
Show how architecture changes margin.
```

The app should support that thesis directly.

## Corrected pipeline

The basic diagram describes document processing, but the product needs a verified-outcome and cost layer.

Recommended pipeline:

```text
run created
  → document inspected
  → text/images extracted
  → translated
  → recomposed
  → evaluated
  → accepted/rejected/escalated
  → cost ledger
  → unit margin
```

The accepted outcome should not be “translation completed.” It should be:

```text
English PDF accepted by automated checks and/or reviewer.
```

That gives the denominator for cost per verified outcome.

## Recommended demo/product scope

Use three workflow variants:

```text
V1: text-only translation
  Extract text, translate, recompose PDF, evaluate.
  No image translation.
  This is the clean baseline.

V2: text plus image translation
  Extract image regions, identify text in images, translate image text, recompose.
  This intentionally shows higher cost and higher complexity.

V3: optimized route
  Use cheaper/deterministic paths where possible.
  Skip image translation when it does not affect acceptance.
  Reduce tool calls.
  Batch translation chunks.
  Narrow human review.
  This gives the before/after economics story.
```

## Product surfaces

The app should have four primary visible surfaces:

```text
upload/run
output PDF
trace/workflow view
cost ledger
```

The audience should see the translated document, but the point of the app is the ledger:

```text
model tokens
AgentCore Runtime
Gateway/tool calls
Memory if used
Policy checks
external service costs
human review
retries
remediation
```

## Recommended architecture

```text
Frontend:
  simple web app for upload, run status, translated PDF preview, cost ledger, accept/reject decision

Storage:
  S3 for source PDFs, extracted page artifacts, image assets, translated chunks, final PDFs

Run database:
  DynamoDB for run, stage, ledger item, evaluation result, and outcome records

Agent orchestrator:
  Amazon Bedrock AgentCore Runtime

Tool plane:
  Amazon Bedrock AgentCore Gateway

Model calls:
  Amazon Bedrock Converse API

Observability:
  AgentCore Observability plus CloudWatch

Policy:
  optional but useful for governance demonstration

Memory:
  optional; do not use AgentCore Memory as the document vector store
```

AgentCore Runtime should receive S3 object keys and IDs, not raw PDF bytes. PDF workflows should be durable and status-polled. The product should pass references and treat the workflow as stage-driven execution.

## Extraction approach

Two viable approaches:

```text
Simpler demo path:
  custom Python tooling behind AgentCore Gateway, using libraries such as PyMuPDF for digitally generated PDFs

More AWS-native path:
  Textract or Bedrock Data Automation for more advanced multimodal extraction
```

Recommendation:

```text
Use custom extraction for V1 unless scanned PDFs are required.
Add Textract/BDA only if document extraction itself is part of the talk.
```

## Cost ledger design

Minimum ledger fields:

```text
run_id
workflow_variant
document_id
page_count
image_count
stage_name
tool_name
model_id
input_tokens
output_tokens
runtime_vcpu_hours
runtime_gb_hours
gateway_invocations
memory_events
policy_checks
external_service_units
human_review_minutes
retry_count
failure_reason
accepted
unit_value
estimated_cost_usd
actual_cost_source
```

Show two numbers separately:

```text
telemetry-derived estimated per-run cost
actual AWS bill-derived cost, where available
```

Do not pretend AWS billing data is always immediately attributable per run.

## Initial ADR candidates

```text
ADR 001: Use AgentCore Runtime as the primary orchestrator rather than Step Functions for the demo.
ADR 002: Pass S3 object keys through the agent instead of PDF bytes.
ADR 003: Expose deterministic document-processing steps as AgentCore Gateway tools.
ADR 004: Use a separate cost ledger database rather than relying only on CloudWatch.
ADR 005: Treat “accepted translated PDF” as the verified outcome.
ADR 006: Make image translation a V2 feature, not part of the baseline.
ADR 007: Do not use AgentCore Memory as the document vector store unless there is a clear memory-specific use case.
ADR 008: Use application inference profiles and request metadata for cost attribution of Bedrock model calls.
ADR 009: Include Policy only if it supports the narrative; otherwise it becomes demo bloat.
ADR 010: Use generated/safe demo PDFs, not arbitrary user documents.
```

## Decisions adopted

```text
business unit:
  one accepted Spanish-to-English translated PDF

value model:
  manual translation and review cost avoided

verified outcome:
  English PDF that passes automated checks and receives reviewer acceptance

V1:
  text-only translation

V2:
  image-text handling by annotation/overlay, not full professional image editing

V3:
  optimized route with deterministic inspection, selective image translation, narrower review, fewer model calls, fewer retries

UI language:
  English UI, Spanish-to-English document workflow

cost claims:
  distinguish telemetry-derived estimates from bill-reconciled actuals
```
