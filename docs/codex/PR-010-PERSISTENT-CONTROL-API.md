# PR-010 - Persistent Control API

PR-010 starts only after PR-009 is complete. It replaces placeholder Control API behavior with real persistence against DynamoDB and S3 while keeping workflow execution deferred.

PR-010 must resolve the dev API protection decision before it exposes persistent product data. If PR-009 used a dev-only unauthenticated placeholder route, PR-010 must remove, restrict, or clearly isolate that placeholder before real product APIs are accepted.

## Objective

Expose the deployed Control API as the first persistent product surface for documents, jobs, run placeholders, artifacts, ledgers, economics, review contract validation, and price-book reads.

## Scope

In scope:

- Replace the placeholder Control API Lambda handler with routed API behavior.
- Validate all requests and responses with shared schemas.
- Use DynamoDB repositories and S3 artifact key conventions from `packages/data`.
- Support document presign, document creation, document reads, job creation, run placeholder creation, timeline/ledger/artifact/evaluation reads, job economics reads, and price-book reads.
- Resolve and document the dev API protection mechanism for real product API routes.
- Resolve and seed the first dev `PriceBook` values as configuration/data records, not hard-coded pricing logic.
- Keep `TranslationJob` as the business unit and `Run` as a technical attempt.
- Calculate economics only from persisted `LedgerItem` rows.
- Return `409` for review attempts unless the run is `AWAITING_REVIEW`.
- Produce deterministic API error responses.

## Non-Goals

- No AgentCore Runtime invocation.
- No stage runner execution.
- No Gateway tools.
- No Bedrock calls.
- No PDF extraction, translation, evaluation, or recomposition.
- No fake completed run histories.
- No replay mode, synthetic-run mode, live-capture mode, recording mode, or presentation mode.
- No unauthenticated real product API if PR-009 used dev-only anonymous placeholder smoke checks.
- No frontend hosting; that is `PR-010A`.
- No enterprise auth, multi-tenant RBAC, or production auth hardening unless explicitly chosen as the minimal dev API protection mechanism.

## Deterministic Checks

- API route contract tests for all implemented routes.
- Repository integration tests for DynamoDB/S3 persistence boundaries using local or test doubles approved by the repo.
- State-transition tests for document, job, run, and review validation paths.
- Cost rollup tests proving job economics are derived from `LedgerItem` rows.
- PriceBook tests proving configured records, not hard-coded constants in costing logic, drive cost assumptions.
- Negative tests proving unsupported documents cannot start jobs and non-`AWAITING_REVIEW` runs cannot be accepted, rejected, or escalated.
- Access-protection tests proving real product routes are not anonymously readable unless explicitly documented as non-sensitive health/smoke routes.
- `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm cdk synth`.

## Deployed Verification

After merge, the normal CI deployment must deploy the merged SHA and produce the deploy artifact required by PR-009.

Codex must use the deployed API directly and record:

1. Deploy artifact location and merged SHA.
2. Unauthorized or unauthenticated access to a protected product route is denied, challenged, or otherwise blocked according to the documented dev protection mechanism.
3. Authorized dev access can exercise the API verification path.
4. `GET /api/price-books/current` returns the active `PriceBook`.
5. `POST /api/documents/presign` returns a presigned S3 upload URL and an artifact key, without returning raw PDF bytes.
6. A controlled digitally generated Spanish PDF is uploaded through the presigned URL.
7. `POST /api/documents` creates a `Document` and `SOURCE_PDF` `Artifact`.
8. `GET /api/documents/{documentId}` returns the persisted document.
9. `POST /api/documents/{documentId}/jobs` creates a `TranslationJob`.
10. `POST /api/jobs/{jobId}/runs` creates a run placeholder without invoking AgentCore.
11. `GET /api/jobs/{jobId}/economics` returns economics derived from ledger rows, with no verified outcome for an unaccepted job.
12. `POST /api/runs/{runId}/review` for the non-`AWAITING_REVIEW` run returns `409` and creates no `ReviewDecision` or `HUMAN_REVIEW` ledger row.

## Telemetry Verification

Use the deployed validation run's merged SHA plus a `validationRunId` request header or equivalent stable selector.

Required when telemetry is queryable:

- Control API request signal for each exercised route.
- No 5xx response for successful routes.
- DynamoDB writes for `Document`, `Artifact`, `TranslationJob`, and `Run`.
- No `ReviewDecision` write for the rejected invalid review attempt.

If telemetry cannot be queried yet, record the blocker in `PLAN.md`; do not claim telemetry verification passed.

## Acceptance Criteria

- PR is merged to `main`.
- Post-merge CI deployment succeeds.
- Deploy artifact exists for the merged SHA.
- Deployed API verification above passes.
- Persistent data survives a fresh read by ID.
- The dev API protection decision is resolved and real product API routes are not anonymously readable.
- The first dev `PriceBook` values are stored as records/configuration and are visible through the deployed API.
- Raw PDF bytes are not stored in DynamoDB or returned by API responses.
- Review contract blocks non-`AWAITING_REVIEW` decisions.
- `PLAN.md` records deterministic, deployed, and telemetry evidence.

## Review Traps

Reject or revise if the change:

- Treats `Run` as the business unit.
- Calculates economics from logs instead of `LedgerItem` rows.
- Adds fake accepted/rejected runs to make the UI look complete.
- Hard-codes prices or model IDs.
- Passes raw PDF bytes through API payloads.
- Exposes real dev product data unauthenticated without an explicit documented guardrail.
