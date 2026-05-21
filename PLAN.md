# PLAN

## Objective

Implement `PR-011 - Agent Runtime Stage Runner Without Real Gateway`: a TypeScript pre-Gateway runner that turns a persisted V1 run into visible workflow evidence before AgentCore Runtime, AgentCore Gateway, Bedrock, and real PDF tooling are introduced.

## Current Slice

This branch implements the local/deployed product behavior needed for PR-011:

- `POST /api/jobs/{jobId}/runs` still creates the technical `Run`, then invokes the pre-Gateway runner through the existing runtime client seam.
- The runner loads the persisted `Document`, `TranslationJob`, `Run`, and job `PriceBook` version by ID.
- The runner executes the V1 proof stage plan:
  - `inspect_pdf`
  - `extract_text_layout`
  - `extract_images` as skipped for V1
  - `chunk_and_align`
  - `translate_text_chunks`
  - `recompose_pdf`
  - `evaluate_translation`
- Each stage persists a terminal `StageEvent`.
- Development tools persist private S3 artifacts plus `Artifact` records for inspection, text layout, source chunks, translated chunks, translated PDF proof output, and evaluation JSON.
- Development tool ledger rows are `EXTERNAL_SERVICE` rows with `PRICE_BOOK_ESTIMATE` basis and no `MODEL_INFERENCE` rows.
- The run moves through `CREATED -> QUEUED -> RUNNING -> EVALUATING -> AWAITING_REVIEW`.
- The job moves to `AWAITING_REVIEW` and economics remain ledger-derived.
- Run, stage, artifact, ledger, and evaluation records carry PR-011 pre-Gateway provenance.
- V2/V3 run starts remain rejected until their owning stories.
- The UI labels PR-011 outputs as pre-Gateway proof, not real V1 PDF quality evidence.

## Non-Goals

- No AgentCore Runtime deployment.
- No AgentCore Gateway deployment.
- No Bedrock calls.
- No real PDF text extraction, translation, evaluation, or recomposition quality claim.
- No model inference ledger rows.
- No V2 or V3 execution.
- No user-selectable execution mode.

## Verification

Local verification completed on this branch:

- `pnpm --filter @agentcore-pdf-translator/schemas typecheck`
- `pnpm --filter @agentcore-pdf-translator/data typecheck`
- `pnpm --filter @agentcore-pdf-translator/control-api typecheck`
- `pnpm --filter @agentcore-pdf-translator/web typecheck`
- `pnpm --filter @agentcore-pdf-translator/schemas test`
- `pnpm --filter @agentcore-pdf-translator/data test`
- `pnpm --filter @agentcore-pdf-translator/control-api test`
- `pnpm --filter @agentcore-pdf-translator/web test`

Full repository verification completed on this branch:

- `pnpm typecheck`
- `pnpm test`
- `pnpm lint`
- `pnpm cdk synth -c priceBookHumanReviewHourlyRateUsd=90`

Note: bare `pnpm cdk synth` requires the repository context value `priceBookHumanReviewHourlyRateUsd` and fails without it.

## Deployed Verification

PR-011 deployed verification is not complete on this branch yet. Per repository rules, completion requires:

1. Merge this PR to `main`.
2. Let normal post-merge CI deploy the merged SHA.
3. Locate the deploy artifact for the merged SHA.
4. Use the protected deployed frontend to create or reuse a controlled document/job.
5. Start a V1 pre-Gateway proof run through the deployed app.
6. Verify the run reaches `AWAITING_REVIEW`.
7. Verify persisted stage events, artifacts, ledger rows, evaluation, and provenance.
8. Verify review accept and non-accepted paths create review decisions plus non-zero human review ledger rows.
9. Verify no `MODEL_INFERENCE` ledger rows exist for PR-011 proof runs.

Telemetry verification remains pending until the merged deployed environment is available and queryable with the deploy/run selectors.
