# PR-014 - V2 Image Annotation

PR-014 starts only after the deployed V1 workflow works end to end. It adds V2 behavior for translating text found in material images through annotations or callouts.

## Objective

Implement `V2_TEXT_AND_IMAGE_ANNOTATION` so text-bearing images in the controlled PDF can be extracted, translated, represented in the translated PDF, evaluated, and costed separately from the V1 text-only path.

## Scope

In scope:

- Image extraction and manifest creation for controlled digitally generated PDFs.
- Materiality classification for images.
- Translation of likely text-bearing images through Bedrock Converse using the shared wrapper.
- V2 recomposition with annotations, callouts, or captions for translated image text.
- Evaluation updates for image-text handling.
- Ledger rows for image extraction, image text translation, additional Gateway/tool usage, model inference, and review.
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
- Image translation response validation tests.
- Recomposition tests proving annotations/callouts are represented without corrupting the PDF.
- Evaluation tests proving V1 can warn on untranslated image text and V2 can improve image-text handling.
- Cost tests proving V2 image work creates additional ledger rows and rolls up into job economics.
- `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm cdk synth`.

## Deployed Verification

After merge, CI must deploy the merged SHA and produce the deploy artifact.

Codex must use the deployed app/API directly:

1. Use the controlled Spanish PDF with the page 4 process diagram.
2. Create or reuse a comparison group with a V1 accepted job.
3. Create a `V2_TEXT_AND_IMAGE_ANNOTATION` job for the same document.
4. Start the V2 run and wait for `AWAITING_REVIEW`.
5. Open/download the translated PDF and verify image text is represented as annotations, callouts, or captions.
6. Open evaluation and verify image-text checks are present.
7. Accept or reject through reviewer workflow based on observed output quality.
8. Verify V2 ledger rows include image extraction and image text translation costs.
9. Open comparison view and verify V1 and V2 costs/margins are shown from persisted jobs.

## Telemetry Verification

Use merged SHA, deploy run ID, `validationRunId`, `comparisonGroupId`, `documentId`, `jobId`, `runId`, trace ID, Gateway invocation IDs, Lambda request IDs, and Bedrock request IDs when available.

Required when telemetry is queryable:

- V2 run invokes image extraction and image translation stages.
- Bedrock image-text translation call occurs only for selected text-bearing images.
- No unexpected Gateway or Lambda system errors.
- No missing terminal StageEvent for image stages.

Telemetry is correlation evidence only. Economics remain sourced from `LedgerItem` rows.

## Acceptance Criteria

- PR is merged to `main`.
- Post-merge deployment succeeds and produces a deploy artifact.
- Deployed V2 run reaches `AWAITING_REVIEW`.
- V2 translated PDF visibly represents controlled image text.
- Evaluation reflects image-text handling.
- Ledger shows additional V2 image/tool/model costs.
- Comparison view shows V1 and V2 from real persisted jobs.

## Review Traps

Reject or revise if the change:

- Makes V1 depend on V2 behavior.
- Treats decorative images as mandatory translation work.
- Adds image inpainting or scanned-PDF OCR.
- Seeds fake V2 comparison data.
- Hard-codes prices or model IDs.
