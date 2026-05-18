# 02 — Locked decisions and build plan v0.1

## Locked working decisions

```text
The business unit is one accepted Spanish-to-English translated PDF.

The value model is manual translation and review cost avoided.
This should be configurable in the app, not hard-coded as a universal claim.

The verified outcome is an English PDF that passes automated checks and receives a reviewer decision of accepted.

V1 is text-only translation.

V2 adds image-text handling by annotation or overlay, not full professional image editing.

V3 is the optimized route:
  deterministic inspection
  selective image translation
  narrower review
  fewer model calls
  fewer retries

The UI stays in English, but the demo document and source workflow are Spanish-to-English.

The app must distinguish telemetry-derived cost estimates from AWS bill-derived actuals.
```

Safe phrasing when bill reconciliation is not implemented:

```text
measured from this run’s telemetry and current price book
```

## Demo narrative the product must support

The product flow should support this talk sequence:

```text
1. Upload or select a controlled Spanish demo PDF.
2. Run V1: text-only translation.
3. Show the translated PDF.
4. Show the ledger with “LLM-only cost” first.
5. Expand to the full workflow ledger:
   model inference
   runtime
   tools
   policy
   memory if used
   review
   retries
   remediation
6. Show automated evaluation results.
7. Click reviewer accept/reject.
8. Show cost per verified outcome.
9. Run V2 with image translation enabled.
10. Show that higher capability increases cost and may or may not improve acceptance.
11. Run V3 optimized route.
12. Show unit margin before and after optimization.
```

Important correction adopted later:

```text
The product has no replay/live-capture/synthetic-run modes.
The fact that the talk uses a recorded video does not change product behavior.
Historical runs are normal product data.
```

## Architecture v0

```text
Frontend:
  Next.js or React app for upload, run configuration, PDF preview, workflow trace, cost ledger, evaluation result, and accept/reject decision.

Control API:
  API Gateway plus Lambda, or a small backend service, for creating documents, starting runs, reading run status, retrieving artifacts, and recording reviewer decisions.

Artifact storage:
  S3 buckets/prefixes for source PDFs, extracted text/layout JSON, extracted image artifacts, translated chunks, evaluation reports, and final PDFs.

Run database:
  DynamoDB tables for documents, runs, stages, ledger items, eval results, and reviewer decisions.

Agent runtime:
  Amazon Bedrock AgentCore Runtime.
  The agent receives run_id, document_id, S3 keys, and workflow configuration.
  It should not receive raw PDF bytes.

Tool plane:
  Amazon Bedrock AgentCore Gateway.
  Expose tools:
    inspect_pdf
    extract_text_layout
    extract_images
    translate_text_chunks
    translate_image_text
    recompose_pdf
    evaluate_translation
    write_cost_ledger

Model calls:
  Amazon Bedrock Converse API.
  Use request metadata with run_id, stage_name, document_id, workflow_variant.

Observability:
  AgentCore Observability plus CloudWatch.

Policy:
  Include one narrow Policy demonstration if useful:
    translate_image_text may be called only when workflow variant is V2/V3
    and image count is below threshold.

Memory:
  optional.
  Do not use AgentCore Memory as the document vector store.
```

## Framework decision

Use Strands with TypeScript if possible.

```text
Frontend:
  Next.js / React / TypeScript

Control API:
  TypeScript Lambda behind API Gateway

Agent:
  TypeScript Strands agent on AgentCore Runtime

Infra:
  AWS CDK in TypeScript

Schemas:
  Zod / TypeScript shared models

Costing:
  TypeScript price-book and ledger package
```

Use Python only where forcing TypeScript would damage implementation quality:

```text
PDF extraction / recomposition tools
Image/PDF layout tooling
```

The agent does not need to know whether a tool is implemented in TypeScript or Python. Tools are exposed through AgentCore Gateway.

## Workflow stages

```text
inspect_pdf
extract_text_layout
chunk_and_align
translate_text_chunks
vectorize_or_score_chunks
extract_images
translate_image_text
recompose_pdf
evaluate_translation
reviewer_decision
write_cost_ledger
```

Recommendation for vectorization:

```text
Do not build a full vector database unless needed.
Interpret vectorization as semantic alignment/evaluation support.
```

## Cost ledger

Minimum fields:

```text
ledger_item_id
run_id
document_id
workflow_variant
stage_name
component_type
component_name
model_id
tool_name
billable_unit
unit_count
unit_price_usd
estimated_cost_usd
actual_cost_usd
cost_source
input_tokens
output_tokens
cache_read_tokens
cache_write_tokens
runtime_vcpu_hours
runtime_gb_hours
gateway_operations
policy_authorization_requests
memory_events
external_service_units
human_review_seconds
retry_count
trace_id
span_id
created_at
```

Cost source values:

```text
bedrock_response_usage
agentcore_runtime_metric
agentcore_gateway_metric
agentcore_policy_metric
agentcore_memory_metric
external_service_metric
human_review_timer
price_book_estimate
aws_bill_reconciled
manual_demo_value
```

Core formulas:

```text
run_cost =
  sum(ledger_item.estimated_cost_usd)

cost_per_verified_outcome =
  sum(cost of all attempts, retries, escalations, and remediation)
  / count(accepted outcomes)

unit_margin =
  configured_value_per_accepted_pdf
  - cost_per_verified_outcome

net_unit_margin =
  configured_value_per_accepted_pdf
  - cost_per_verified_outcome
  - allocated_platform_overhead
```

## MVP scope

Supported input:

```text
1–5 page digitally generated Spanish PDFs
Selectable controlled demo PDFs
Optional simple embedded image with Spanish text
No arbitrary scanned-document guarantee
No legal/medical/regulated documents
No promise of production-grade layout preservation
```

Outputs:

```text
Translated English PDF
Per-page preview
Stage trace
Cost ledger
Evaluation result
Reviewer decision
Unit margin
Historical run comparison
```

Required variants:

```text
V1_TEXT_ONLY
V2_TEXT_AND_IMAGE_ANNOTATION
V3_OPTIMIZED
```

Non-goals:

```text
Perfect desktop-publishing-quality PDF reconstruction
Full OCR support for arbitrary scanned PDFs
Full image inpainting/editing
Real-time AWS billing reconciliation
Multi-tenant enterprise auth
Production document privacy/compliance workflow
```

## Recommended repo shape

```text
/apps/web
/apps/control-api
/apps/agent-runtime
/apps/tools/pdf-pipeline-lambda
/apps/tools/translation-lambda
/apps/tools/evaluation-lambda
/packages/schemas
/packages/data
/packages/costing
/packages/bedrock
/packages/gateway
/infra
/demo-data
/scripts
/docs
```

## First ADR backlog

```text
ADR-001: Use Amazon Bedrock AgentCore Runtime as the primary workflow orchestrator.
ADR-002: Use S3 object references rather than passing PDF bytes through AgentCore requests.
ADR-003: Expose deterministic document-processing operations through AgentCore Gateway tools.
ADR-004: Use DynamoDB as the run and ledger store.
ADR-005: Use a local price book for telemetry-derived cost estimates.
ADR-006: Treat “accepted translated PDF” as the verified outcome.
ADR-007: Build historical comparison as normal product analytics.
ADR-008: Use Strands for stage orchestration.
ADR-009: Keep AgentCore Memory optional and out of the document vectorization path.
ADR-010: Use AgentCore Policy only for a narrow tool-access governance demonstration.
ADR-011: Use controlled demo PDFs rather than arbitrary user documents.
ADR-012: Implement image translation as annotation/overlay, not full image editing.
```
