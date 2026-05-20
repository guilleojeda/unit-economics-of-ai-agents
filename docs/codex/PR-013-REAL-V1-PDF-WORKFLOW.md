# PR-013 - Real V1 PDF Workflow

PR-013 starts only after PR-012 is deployed and directly verified. It implements the first real controlled Spanish-to-English PDF workflow through AgentCore Runtime and Gateway.

## Objective

Execute V1 text-only PDF translation for the controlled Spanish PDF, producing a translated English PDF, evaluation result, review decision, ledger-derived economics, and unit margin for one accepted `TranslationJob`.

## Scope

In scope:

- Controlled digitally generated Spanish PDF upload and inspection.
- Complete or validate the repository-controlled MVP PDF fixture before using it as V1 acceptance input. It must contain the documented title, four pages, required glossary terms, page 4 Spanish process diagram labels, and one decorative image without material text.
- Replace the PR-010 placeholder inspection basis for V1 acceptance evidence with real PDF inspection metadata and artifacts. A document marked `READY` only by the placeholder path is not sufficient for PR-013 acceptance.
- Resolve and document the PDF extraction/recomposition library decision before implementing real PDF tools.
- Resolve and document whether real PDF pipeline tools run as Python container Lambda or TypeScript Lambda.
- Resolve and document the Bedrock translation and evaluator model configuration for dev without hard-coding model IDs.
- Persist the effective translation and evaluator model IDs, prompt/configuration versions or labels, and cost-basis inputs used by the run in StageEvents, LedgerItems, EvaluationResult, or other explicit run metadata so later comparisons can prove which configuration produced the result.
- Persist or expose enough source lineage evidence for the accepted V1 job to prove the exact canonical source artifact identity and checksum/hash used by the run. Later V2/V3 comparisons must not rely only on a display title or mutable object path.
- Persist workflow implementation provenance for the accepted V1 run, including deployed commit SHA/build ID, runtime image tag/digest, agent implementation label/version, Gateway target version, and tool Lambda version/alias when available. Later V2/V3 comparisons must label or block stale/build-mismatched evidence where it could affect quality, cost, or optimization claims.
- Persist or propagate deployed environment and validation evidence for the accepted V1 run, including stage, region, AWS account ID, deploy artifact identity, resolved workspace, and `validationRunId` when supplied. This evidence must prevent wrong-environment or stale records from satisfying V1 acceptance or later comparisons.
- Resolve the initial runtime-cost basis for V1 as omitted, price-book-estimated, telemetry-derived, or reconciled; label it honestly in the product.
- `inspect_pdf`, `extract_text_layout`, `chunk_and_align`, `translate_text_chunks`, `recompose_pdf`, and `evaluate_translation` for V1.
- V1 tool requests must pass explicit input artifact IDs and S3 keys for source, intermediate, translated, preview, and evaluation artifacts as applicable. Tool requests must not pass raw PDF bytes or infer file inputs only from a bare `documentId`.
- Bedrock Converse calls only through the shared wrapper.
- Configurable model IDs and `PriceBook`-derived cost assumptions.
- S3 artifacts for source PDF, inspection JSON, text layout JSON, source chunks, translated chunks, translated PDF, previews if used, and evaluation JSON.
- `LedgerItem` rows for model inference, Gateway/tool usage, retry if any, and human review.
- Artifact integrity metadata for source, intermediate, translated PDF, preview, and evaluation artifacts, including content type, size, and checksum/hash when available. Reads and reviewer links must resolve by artifact ID/S3 key and must not depend on raw PDF bytes in API/Runtime/Gateway payloads.
- Reviewer-visible source, preview, translated PDF, and evaluation artifact links must use the private Control API artifact-access route from PR-010. Do not make S3 objects public and do not return artifact bytes in normal JSON APIs.
- Bedrock, Gateway, and tool retry accounting that distinguishes deliberate retry/remediation cost from duplicate delivery. Re-delivery of the same model/tool result must not duplicate `MODEL_INFERENCE`, Gateway/tool, artifact, or evaluation ledger evidence.
- Reviewer accept/reject/escalate workflow.
- Job economics derived from all runs under the job.

## Non-Goals

- No V2 image annotation.
- No V3 optimization.
- No placeholder document-readiness path as deployed V1 acceptance evidence.
- No scanned-PDF OCR.
- No image inpainting.
- No multi-language support.
- No production billing reconciliation.
- No replay, synthetic-run, live-capture, recording, or presentation mode.

## Deterministic Checks

- Contract tests for every V1 tool request and response.
- Tool contract tests proving V1 file-bearing stages require explicit input artifact references and reject raw bytes, local paths, arbitrary keys, or documentId-only file input.
- Fixture validation tests or generator checks proving the controlled MVP PDF has the required title, page count, glossary terms, page 4 diagram labels, and decorative image.
- Tests proving PR-010 placeholder inspection labels/basis are replaced or rejected for V1 acceptance evidence, and real inspection produces the persisted inspection artifact used to mark the document `READY`.
- PDF inspection tests for controlled digitally generated PDFs and unsupported scanned-PDF detection.
- Chunk alignment tests proving one translated output per source chunk.
- Bedrock wrapper tests for JSON parsing, usage normalization, repair retry, and failure behavior.
- Costing tests proving Bedrock usage creates `MODEL_INFERENCE` ledger rows and job economics include all attempts.
- Configuration snapshot tests proving V1 runs persist the effective translation model ID, evaluator model ID, and prompt/configuration version or label used for that run without hard-coding those values in source.
- Source-lineage tests proving the V1 run, artifacts, evaluation, review, ledger, and comparison evidence can be tied back to the immutable canonical source artifact identity/checksum for the document.
- Implementation-provenance tests proving the V1 run, artifacts, evaluation, review, ledger, and comparison evidence expose the deployed commit/build and runtime/tool implementation versions that produced the result.
- Environment/validation scoping tests proving V1 acceptance and comparison evidence cannot be satisfied by wrong-stage, wrong-account, wrong-workspace, stale, or uncorrelated records.
- Retry/idempotency tests proving Bedrock repair retries create explicit retry/model ledger evidence, while duplicate Gateway/tool/model result delivery for the same invocation identity does not double-count artifacts, evaluations, or LedgerItems.
- Artifact integrity tests proving translated PDF, inspection, text layout, chunk, preview if used, and evaluation artifacts persist expected content type, size, checksum/hash where available, and can be read back by artifact ID/S3 key.
- Artifact access tests proving source, translated PDF, preview if used, and evaluation artifacts are opened through authorized private artifact access and reject public S3, raw JSON bytes, cross-workspace, and arbitrary-key access.
- API/end-to-end tests for V1 run and review flow using controlled fixtures where external calls are mocked.
- `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm cdk synth`.

## Deployed Verification

After merge, CI must deploy the merged SHA and produce the deploy artifact.

Codex must use the deployed app for the end-to-end product flow and may use API calls only as supporting evidence. Validation must use the current deploy artifact's frontend/API/Runtime/Gateway outputs, AWS account, region, stage, resolved workspace, and a stable `validationRunId` or equivalent selector:

1. Upload the repository-controlled Spanish PDF fixture through the deployed product flow.
2. Inspect the document and verify it becomes `READY` based on real PDF inspection metadata/artifacts, not the PR-010 placeholder readiness contract.
3. Create a `V1_TEXT_ONLY` `TranslationJob`.
4. Start a run and wait for `AWAITING_REVIEW`.
5. Open or download the translated English PDF artifact through the deployed app's private artifact-access path and confirm it is readable, has the expected page count, and contains English text for key controlled-document content.
6. Verify the translated PDF and supporting artifacts expose persisted content type, size, and checksum/hash metadata where available.
7. Verify required glossary terms are represented correctly in the output, including refund, eligibility, chargeback, manual review, and escalated case.
8. Verify the result does not leave material untranslated Spanish text in the extracted text path.
9. Open the evaluation and verify deterministic checks plus model-based scores are persisted.
10. Verify the run evidence records the effective translation model ID, evaluator model ID, and prompt/configuration version or label used for V1.
11. Verify the V1 run evidence, source artifact, translated artifact, evaluation, ledger, and review all point back to the same immutable canonical source artifact identity/checksum.
12. Verify the V1 run evidence records deployed commit/build and runtime/tool implementation provenance for the code that produced the result.
13. Verify the V1 run evidence is scoped to the current deployed account, stage, workspace, deploy artifact, and validation selector.
14. Repeat a supported read/retry path for at least one completed V1 tool or model invocation and verify duplicate delivery is not double-counted as new artifact, evaluation, or ledger cost.
15. Accept the run with positive reviewer seconds only if the output is acceptable under the product review flow.
16. Repeat the same accept request or equivalent browser retry and verify the job remains `ACCEPTED` with exactly one `ReviewDecision` and one `HUMAN_REVIEW` ledger row for that decision.
17. Verify ledger rows include `MODEL_INFERENCE`, Gateway/tool costs, any explicit retry/remediation cost, and a non-zero `HUMAN_REVIEW` cost derived from reviewer seconds and the job's recorded `PriceBook` version and value model.
18. Verify LLM-only cost and full workflow cost are shown separately.
19. Verify cost per verified outcome and unit margin are calculated from ledger rows.

## Telemetry Verification

Use merged SHA, deploy run ID, `validationRunId`, `documentId`, `jobId`, `runId`, trace ID, Bedrock request ID when available, Gateway invocation ID, and Lambda request IDs.

Required when telemetry is queryable:

- Control API route signals for upload metadata, job creation, run start, reads, and review.
- Environment/workspace evidence showing the V1 validation run was produced in the deploy artifact's account, region, stage, and resolved workspace.
- Runtime execution signal for the V1 `runId`.
- Gateway tool invocations for V1 stages.
- Gateway/tool evidence that V1 file-bearing stages used explicit artifact references for the validation source and generated artifacts.
- Bedrock Converse invocation for translation and evaluation.
- Persisted model/configuration evidence for translation and evaluation tied to the validation `runId`.
- Source-lineage evidence tying the validation `runId` and artifact set to the immutable canonical source artifact identity/checksum.
- Implementation-provenance evidence tying the validation `runId` to the deployed commit/build and runtime/tool versions that produced the result.
- Control API artifact-access route signal for the source and translated PDF artifacts, with no public S3 access required.
- No unhandled 5xx response.
- No terminal run state other than `AWAITING_REVIEW` before review and `ACCEPTED` after review.
- No duplicate artifact, evaluation, review, or ledger rows for repeated delivery of the same V1 invocation identity or repeated reviewer submission.

Telemetry is correlation evidence only. Economics remain sourced from `LedgerItem` rows.

## Acceptance Criteria

- PR is merged to `main`.
- Post-merge deployment succeeds and produces a deploy artifact.
- A deployed V1 run completes to `AWAITING_REVIEW`.
- A reviewer can accept the V1 run.
- Document readiness for the accepted V1 run is based on real PDF inspection, not placeholder inspection.
- Translated PDF, evaluation, artifacts, StageEvents, and LedgerItems are persisted.
- V1 artifacts include enough integrity metadata to verify that reviewer-visible files are the persisted S3 artifacts for the validation run.
- V1 records the effective translation/evaluator model IDs and prompt/configuration versions or labels used for the accepted run.
- V1 records enough source-lineage evidence to prove the accepted run used the document's immutable canonical source artifact.
- V1 records enough implementation-provenance evidence to prove which deployed build and runtime/tool versions produced the accepted result.
- V1 records enough environment and validation evidence to prove the accepted run came from the current deployed account, stage, workspace, deploy artifact, and validation selector.
- V1 output passes the controlled-document glossary/content checks needed for reviewer acceptance.
- Reviewer acceptance creates a non-zero `HUMAN_REVIEW` ledger row from positive reviewer seconds.
- Duplicate tool/model delivery and duplicate review submission do not double-count V1 economics or create contradictory terminal records.
- Accepted job economics show cost per verified outcome and unit margin.
- Raw PDFs are passed by S3 key/artifact ID, not API/Runtime/Gateway payload bytes.
- File-bearing V1 tool requests use explicit artifact IDs/S3 keys rather than documentId-only inference.
- Source and translated PDFs remain private S3 artifacts opened through authorized short-lived artifact access.
- The controlled MVP PDF fixture source/path or generation command is recorded, and V1 verification uses that fixture rather than an ad hoc document.
- PDF tooling, tool runtime, Bedrock model configuration, and initial runtime-cost basis decisions are documented.
- Cost displays label their basis honestly.

## Review Traps

Reject or revise if the change:

- Implements V2/V3 behavior inside V1.
- Treats automated evaluation as business acceptance.
- Accepts a run without directly inspecting the translated PDF content and glossary behavior.
- Hides rejected or failed attempts from job cost.
- Hard-codes model IDs or prices.
- Leaves the effective model IDs or prompt/configuration versions invisible for the accepted V1 run.
- Reprices review cost with the currently active price book instead of the job's recorded `priceBookVersion`.
- Claims AWS bill reconciliation.
- Stores PDF bytes in DynamoDB.
- Makes source or translated PDF artifacts public or returns them as raw JSON/API payload bytes.
- Lets V1 tools infer file inputs from a bare `documentId`, local path, mutable object path, or arbitrary S3 key instead of explicit artifact references.
- Leaves artifact integrity unverifiable for the source or translated PDF.
- Double-counts `MODEL_INFERENCE`, Gateway/tool, artifact, evaluation, or human-review rows when a Runtime, Gateway, Lambda, Bedrock wrapper, API, or browser request is retried.
- Uses a different or ad hoc PDF that does not prove the documented controlled workflow.
- Allows V1 acceptance evidence to depend on a mutable source object path without proving source artifact identity/checksum.
- Omits deployed build or runtime/tool implementation provenance from the accepted V1 run evidence.
- Lets wrong-stage, wrong-account, wrong-workspace, stale, or uncorrelated V1 records satisfy deployed acceptance or comparison evidence.
- Reuses PR-010 placeholder inspection as proof that real V1 PDF inspection works.
- Allows reviewer acceptance with zero or missing reviewer seconds.
