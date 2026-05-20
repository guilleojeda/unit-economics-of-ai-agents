# PR-013 - Real V1 PDF Workflow

PR-013 starts only after PR-012 is deployed and directly verified. It implements the first real controlled Spanish-to-English PDF workflow through AgentCore Runtime and Gateway.

## Objective

Execute V1 text-only PDF translation for the controlled Spanish PDF, producing a translated English PDF, evaluation result, review decision, ledger-derived economics, and unit margin for one accepted `TranslationJob`.

## Scope

In scope:

- Controlled digitally generated Spanish PDF upload and inspection.
- Resolve and document the PDF extraction/recomposition library decision before implementing real PDF tools.
- Resolve and document whether real PDF pipeline tools run as Python container Lambda or TypeScript Lambda.
- Resolve and document the Bedrock translation and evaluator model configuration for dev without hard-coding model IDs.
- Resolve the initial runtime-cost basis for V1 as omitted, price-book-estimated, telemetry-derived, or reconciled; label it honestly in the product.
- `inspect_pdf`, `extract_text_layout`, `chunk_and_align`, `translate_text_chunks`, `recompose_pdf`, and `evaluate_translation` for V1.
- Bedrock Converse calls only through the shared wrapper.
- Configurable model IDs and `PriceBook`-derived cost assumptions.
- S3 artifacts for source PDF, inspection JSON, text layout JSON, source chunks, translated chunks, translated PDF, previews if used, and evaluation JSON.
- `LedgerItem` rows for model inference, Gateway/tool usage, retry if any, and human review.
- Reviewer accept/reject/escalate workflow.
- Job economics derived from all runs under the job.

## Non-Goals

- No V2 image annotation.
- No V3 optimization.
- No scanned-PDF OCR.
- No image inpainting.
- No multi-language support.
- No production billing reconciliation.
- No replay, synthetic-run, live-capture, recording, or presentation mode.

## Deterministic Checks

- Contract tests for every V1 tool request and response.
- PDF inspection tests for controlled digitally generated PDFs and unsupported scanned-PDF detection.
- Chunk alignment tests proving one translated output per source chunk.
- Bedrock wrapper tests for JSON parsing, usage normalization, repair retry, and failure behavior.
- Costing tests proving Bedrock usage creates `MODEL_INFERENCE` ledger rows and job economics include all attempts.
- API/end-to-end tests for V1 run and review flow using controlled fixtures where external calls are mocked.
- `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm cdk synth`.

## Deployed Verification

After merge, CI must deploy the merged SHA and produce the deploy artifact.

Codex must use the deployed app for the end-to-end product flow and may use API calls only as supporting evidence:

1. Upload the controlled Spanish PDF through the deployed product flow.
2. Inspect the document and verify it becomes `READY`.
3. Create a `V1_TEXT_ONLY` `TranslationJob`.
4. Start a run and wait for `AWAITING_REVIEW`.
5. Open or download the translated English PDF artifact and confirm it is readable, has the expected page count, and contains English text for key controlled-document content.
6. Verify required glossary terms are represented correctly in the output, including refund, eligibility, chargeback, manual review, and escalated case.
7. Verify the result does not leave material untranslated Spanish text in the extracted text path.
8. Open the evaluation and verify deterministic checks plus model-based scores are persisted.
9. Accept the run with reviewer seconds only if the output is acceptable under the product review flow.
10. Verify the job is `ACCEPTED`.
11. Verify ledger rows include `MODEL_INFERENCE`, Gateway/tool costs, and `HUMAN_REVIEW`.
12. Verify LLM-only cost and full workflow cost are shown separately.
13. Verify cost per verified outcome and unit margin are calculated from ledger rows.

## Telemetry Verification

Use merged SHA, deploy run ID, `validationRunId`, `documentId`, `jobId`, `runId`, trace ID, Bedrock request ID when available, Gateway invocation ID, and Lambda request IDs.

Required when telemetry is queryable:

- Control API route signals for upload metadata, job creation, run start, reads, and review.
- Runtime execution signal for the V1 `runId`.
- Gateway tool invocations for V1 stages.
- Bedrock Converse invocation for translation and evaluation.
- No unhandled 5xx response.
- No terminal run state other than `AWAITING_REVIEW` before review and `ACCEPTED` after review.

Telemetry is correlation evidence only. Economics remain sourced from `LedgerItem` rows.

## Acceptance Criteria

- PR is merged to `main`.
- Post-merge deployment succeeds and produces a deploy artifact.
- A deployed V1 run completes to `AWAITING_REVIEW`.
- A reviewer can accept the V1 run.
- Translated PDF, evaluation, artifacts, StageEvents, and LedgerItems are persisted.
- V1 output passes the controlled-document glossary/content checks needed for reviewer acceptance.
- Accepted job economics show cost per verified outcome and unit margin.
- Raw PDFs are passed by S3 key/artifact ID, not API/Runtime/Gateway payload bytes.
- PDF tooling, tool runtime, Bedrock model configuration, and initial runtime-cost basis decisions are documented.
- Cost displays label their basis honestly.

## Review Traps

Reject or revise if the change:

- Implements V2/V3 behavior inside V1.
- Treats automated evaluation as business acceptance.
- Accepts a run without directly inspecting the translated PDF content and glossary behavior.
- Hides rejected or failed attempts from job cost.
- Hard-codes model IDs or prices.
- Claims AWS bill reconciliation.
- Stores PDF bytes in DynamoDB.
