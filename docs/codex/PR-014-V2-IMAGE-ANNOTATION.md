# PR-014 - V2 Image Annotation

PR-014 starts only after the deployed V1 workflow works end to end. It adds V2 behavior for translating text found in material images through annotations or callouts.

## Objective

Implement `V2_TEXT_AND_IMAGE_ANNOTATION` so text-bearing images in the controlled PDF can be extracted, translated, represented in the translated PDF, evaluated, and costed separately from the V1 text-only path.

## Scope

In scope:

- Image extraction and manifest creation for controlled digitally generated PDFs.
- Materiality classification for images.
- Specific handling for the controlled page 4 process diagram with Spanish labels.
- Explicit non-material treatment for the controlled decorative image so it is not costed as mandatory image-text translation work.
- Use the same repository-controlled MVP PDF fixture, immutable source artifact identity/checksum, and comparison group lineage proven by V1; do not substitute a different document or changed source object to make V2 pass.
- Use the same `PriceBook` version and business value assumptions as the accepted V1 comparison job for deployed comparison evidence, or explicitly block the comparison as not apples-to-apples.
- Use matching translation/evaluator model configuration and prompt/configuration versions or labels for V1/V2 comparison claims, or explicitly block/label the comparison as configuration-mismatched.
- Use compatible workflow implementation provenance for V1/V2 comparison claims, or explicitly block/label the comparison as implementation-version-mismatched. Persisted provenance must include deployed commit/build and runtime/tool versions where available.
- Translation of likely text-bearing images through Bedrock Converse using the shared wrapper.
- V2 image, annotation, and recomposition tool requests must pass explicit input artifact IDs and S3 keys for source PDF, image assets, image manifests, annotations, and generated PDFs as applicable. They must not pass raw PDF/image bytes or infer file inputs only from a bare `documentId`.
- V2 recomposition with annotations, callouts, or captions for translated image text.
- Evaluation updates for image-text handling.
- Ledger rows for image extraction, image text translation, additional Gateway/tool usage, model inference, and review.
- Private artifact access for V2 translated PDF, preview, image manifest, and annotation artifacts through the Control API artifact-access route.
- Stable image IDs and invocation identities so retries of image extraction, materiality classification, image translation, recomposition, evaluation, or review do not duplicate artifacts or cost rows for the same V2 stage attempt.
- Comparison between V1 and V2 jobs in the same comparison group.

## Non-Goals

- No V3 optimization.
- No image inpainting.
- No arbitrary scanned-PDF OCR.
- No multi-language image translation.
- No product-facing fake image histories.
- No replay, synthetic-run, live-capture, recording, or presentation mode.

## Deterministic Checks

- Image extraction contract tests for image manifests and stable image IDs.
- Materiality tests for decorative versus text-bearing controlled images.
- Tests proving page 4 process-diagram labels are selected for image-text handling and the decorative image is not treated as mandatory text-bearing work.
- Image translation response validation tests.
- Tool contract tests proving V2 file-bearing and image-bearing stages require explicit input artifact references and reject raw bytes, local paths, arbitrary keys, or documentId-only file input.
- Recomposition tests proving annotations/callouts are represented without corrupting the PDF.
- Artifact-access tests proving V2 translated PDF, preview, image manifest, and annotation artifacts are not public and are opened only through authorized artifact access.
- Evaluation tests proving V1 can warn on untranslated image text and V2 can improve image-text handling.
- Cost tests proving V2 image work creates additional ledger rows and rolls up into job economics.
- Idempotency tests proving repeated V2 image-stage/tool/model deliveries for the same image and invocation identity do not duplicate image artifacts, annotations, evaluation evidence, or LedgerItems.
- Comparison tests proving V1/V2 cost and margin comparisons use matching `PriceBook` versions and value assumptions, or clearly refuse/label mismatched comparisons.
- Comparison tests proving V1/V2 quality and economics claims either use matching translation/evaluator model configuration and prompt/configuration versions or clearly refuse/label mismatched comparisons.
- Comparison/source-lineage tests proving V2 comparison evidence uses the same immutable source artifact identity/checksum as the accepted V1 job, or clearly refuses/labels the mismatch.
- Comparison/implementation-provenance tests proving V1/V2 comparison evidence exposes deployed commit/build and runtime/tool versions, and clearly refuses or labels stale/build-mismatched comparisons where implementation differences could affect the claim.
- Review validation tests proving V2 accept/reject decisions require positive reviewer seconds and create non-zero `HUMAN_REVIEW` cost.
- `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm cdk synth`.

## Deployed Verification

After merge, CI must deploy the merged SHA and produce the deploy artifact.

Codex must use the deployed app for user-facing workflow and comparison steps, with API calls only as supporting evidence:

1. Use the same repository-controlled Spanish PDF fixture with the page 4 process diagram and the same immutable source artifact identity/checksum that V1 used.
2. Create or reuse a comparison group with a V1 accepted job using the same `PriceBook` version, business value assumptions, translation/evaluator configuration, and implementation provenance compatible with the V2 comparison claim; if the existing V1 job is stale/build-mismatched, the UI/API must label or block apples-to-apples claims.
3. Create a `V2_TEXT_AND_IMAGE_ANNOTATION` job for the same document.
4. Start the V2 run and wait for `AWAITING_REVIEW`.
5. Open/download the translated PDF through the deployed app's private artifact-access path and verify page 4 process-diagram Spanish labels are represented in English as annotations, callouts, or captions.
6. Verify the controlled decorative image is either skipped as non-material or handled without creating mandatory image-text translation cost.
7. Open evaluation and verify image-text checks are present and refer to the controlled page 4 diagram.
8. Accept or reject through reviewer workflow with positive reviewer seconds based on observed output quality.
9. Verify V2 ledger rows include image extraction, image text translation, and non-zero human review costs for selected text-bearing image work and reviewer time.
10. Repeat a supported V2 image-stage or review retry path and verify no duplicate image artifact, annotation, evaluation, or ledger rows are created for the same invocation identity.
11. Open comparison view and verify V1 and V2 costs/margins are shown from persisted jobs with matching `PriceBook` version, business value assumptions, model/prompt configuration, and compatible implementation provenance, or are explicitly blocked/labeled as mismatched.

## Telemetry Verification

Use merged SHA, deploy run ID, `validationRunId`, `comparisonGroupId`, `documentId`, `jobId`, `runId`, trace ID, Gateway invocation IDs, Lambda request IDs, and Bedrock request IDs when available.

Required when telemetry is queryable:

- V2 run invokes image extraction and image translation stages.
- Bedrock image-text translation call occurs only for selected text-bearing images.
- Persisted V2 model/configuration evidence can be compared against the accepted V1 job in the comparison group.
- Persisted V2 source-lineage evidence matches the accepted V1 job's canonical source artifact identity/checksum.
- Persisted V2 implementation-provenance evidence can be compared against the accepted V1 job and is surfaced or blocked/labeled if stale/build-mismatched.
- Gateway/tool evidence that V2 file-bearing and image-bearing stages used explicit artifact references for validation inputs and outputs.
- Control API artifact-access route signal for the V2 translated PDF and image-related artifacts used during validation.
- No unexpected Gateway or Lambda system errors.
- No missing terminal StageEvent for image stages.
- No duplicate V2 image artifacts, annotations, evaluation rows, or LedgerItems for repeated delivery of the same image invocation identity.

Telemetry is correlation evidence only. Economics remain sourced from `LedgerItem` rows.

## Acceptance Criteria

- PR is merged to `main`.
- Post-merge deployment succeeds and produces a deploy artifact.
- Deployed V2 run reaches `AWAITING_REVIEW`.
- V2 translated PDF visibly represents controlled image text.
- V2 reviewer-visible artifacts remain private and accessible only through authorized artifact access.
- The controlled decorative image is not costed as mandatory image-text translation work.
- Evaluation reflects image-text handling.
- Ledger shows additional V2 image/tool/model costs.
- V2 image-stage retries and review retries do not duplicate image artifacts, annotations, evaluation evidence, ReviewDecisions, or LedgerItems.
- Review decisions create non-zero `HUMAN_REVIEW` ledger cost from positive reviewer seconds.
- V1/V2 comparison evidence uses matching canonical source artifact identity/checksum, `PriceBook` version, business value assumptions, translation/evaluator configuration, and compatible implementation provenance, or the UI/API clearly refuses or labels the mismatch.
- Comparison view shows V1 and V2 from real persisted jobs.

## Review Traps

Reject or revise if the change:

- Makes V1 depend on V2 behavior.
- Treats decorative images as mandatory translation work.
- Passes V2 with generic annotations that do not handle the controlled page 4 process diagram text.
- Adds image inpainting or scanned-PDF OCR.
- Seeds fake V2 comparison data.
- Hard-codes prices or model IDs.
- Uses a different document than the accepted V1 comparison input.
- Uses the same document label or comparison group but a different source artifact identity/checksum than the accepted V1 job.
- Compares V1 and V2 margins or quality using different price books, value assumptions, model IDs, or prompt/configuration versions without an explicit mismatch label/block.
- Compares V1 and V2 margins, quality, or capability claims using stale or incompatible workflow implementation provenance without an explicit mismatch label/block.
- Makes V2 translated or image artifacts public to satisfy review.
- Lets V2 tools infer file or image inputs from a bare `documentId`, local path, mutable object path, or arbitrary S3 key instead of explicit artifact references.
- Allows V2 review decisions with zero or missing reviewer seconds.
- Double-counts V2 image extraction, image translation, annotation, evaluation, or human-review cost when requests are retried.
