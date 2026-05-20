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
- Support document presign, document creation, document reads, document inspection placeholder, job creation, run placeholder creation, timeline/ledger/artifact/evaluation reads, job economics reads, and price-book reads.
- Define and enforce idempotency or conditional-write behavior for all mutating routes that can be retried by browsers, scripts, CI validation, or API clients. At minimum this covers document creation, job creation, run placeholder creation, inspection requests, and future review requests. Repeated identical submissions must return the existing resource or an equivalent stable response; conflicting repeats must fail without creating duplicate business records or ledger rows.
- Verify S3 source-object integrity before `POST /api/documents` creates a `Document` or `SOURCE_PDF` `Artifact`: the object must exist at the generated repository key, belong to the expected workspace/document context, and persist metadata such as bucket, key, content type, size, and checksum/hash when available.
- Implement `POST /api/documents/{documentId}/inspect` as an honest placeholder inspection contract that can move a controlled MVP document through `UPLOADED -> INSPECTING -> READY` or to `UNSUPPORTED`/`FAILED_INSPECTION` without claiming real PDF extraction, translation quality, or layout analysis.
- Gate job creation and run placeholder creation on `Document.status == READY`.
- Resolve and document the dev API protection mechanism for real product API routes.
- Resolve and seed the first dev `PriceBook` values as configuration/data records, not hard-coded pricing logic.
- Define `PriceBook` versioning as append-only product economics configuration. Updating the active price book must create or select a versioned record and update `ACTIVE_PRICE_BOOK_VERSION`; it must not mutate or overwrite a version already referenced by a `TranslationJob`, `Run`, `LedgerItem`, or `ReviewDecision`.
- Snapshot the `TranslationJob.priceBookVersion` and `TranslationJob.valueModel` at job creation. Existing job economics must continue to roll up from persisted `LedgerItem` rows and the job's recorded value model even if the active price book changes later.
- Use a repository-controlled MVP PDF fixture for deployed upload verification. If the fixture does not exist yet, add only the deterministic fixture source/generation support needed for verification under `demo-data` and/or `scripts`; this is test/demo input, not product-facing seeded history.
- Keep `TranslationJob` as the business unit and `Run` as a technical attempt.
- Calculate economics only from persisted `LedgerItem` rows.
- Return `409` for review attempts unless the run is `AWAITING_REVIEW`.
- Validate review-decision request payloads so accept, reject, and escalate require positive reviewer seconds before any future `HUMAN_REVIEW` ledger row can be created.
- Produce deterministic API error responses.

## Non-Goals

- No AgentCore Runtime invocation.
- No stage runner execution.
- No Gateway tools.
- No Bedrock calls.
- No PDF extraction, translation, evaluation, or recomposition.
- No real PDF inspection claim. The inspection endpoint is a readiness/state contract placeholder only until PR-013 implements real PDF tooling.
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
- PriceBook versioning tests proving active-price-book changes are append-only, reject overwriting referenced versions, preserve existing job `priceBookVersion` and `valueModel`, and do not recalculate historical ledger-derived economics from the new active price book.
- Negative tests proving `UPLOADED`, `INSPECTING`, `UNSUPPORTED`, and `FAILED_INSPECTION` documents cannot start jobs or run placeholders, and non-`AWAITING_REVIEW` runs cannot be accepted, rejected, or escalated.
- Review request validation tests proving missing, zero, negative, or non-finite reviewer seconds are rejected and cannot create a free `HUMAN_REVIEW` event.
- Document inspection placeholder tests proving valid transitions to `READY`, `UNSUPPORTED`, and `FAILED_INSPECTION` and rejecting invalid transitions.
- Access-protection tests proving real product routes are not anonymously readable unless explicitly documented as non-sensitive health/smoke routes.
- Fixture/generator check proving the controlled MVP PDF used for deployed verification is reproducible from the repository and not an ad hoc local file.
- Idempotency/conditional-write tests proving duplicate document creation, job creation, run placeholder creation, inspection, and review-validation submissions do not create duplicate `Document`, `Artifact`, `TranslationJob`, `Run`, `ReviewDecision`, `StageEvent`, or `LedgerItem` records.
- S3 artifact integrity tests proving document creation rejects missing objects, arbitrary client-chosen keys, wrong workspace/document prefixes, wrong content type, and mismatched size/checksum metadata where the upload flow provides those expectations.
- `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm cdk synth`.

## Deployed Verification

After merge, the normal CI deployment must deploy the merged SHA and produce the deploy artifact required by PR-009.

Codex must use the deployed API directly and record:

1. Deploy artifact location and merged SHA.
2. Unauthorized or unauthenticated access to a protected product route is denied, challenged, or otherwise blocked according to the documented dev protection mechanism.
3. Authorized dev access can exercise the API verification path.
4. `GET /api/price-books/current` returns the active `PriceBook`.
5. If `PUT /api/price-books/current` is enabled in PR-010, it creates/selects an append-only version and preserves already-created job economics; if it is not enabled, it returns an honest not-yet-implemented or protected response.
6. `POST /api/documents/presign` returns a presigned S3 upload URL and an artifact key, without returning raw PDF bytes.
7. The repository-controlled MVP Spanish PDF fixture is uploaded through the presigned URL.
8. `POST /api/documents` creates a `Document` and `SOURCE_PDF` `Artifact` only after verifying the uploaded S3 object and persisting source metadata.
9. Repeating the same document creation request returns the same document/artifact outcome or an equivalent stable response, with no duplicate rows.
10. `POST /api/documents/{documentId}/jobs` before inspection returns `409` or `DOCUMENT_UNSUPPORTED` and creates no `TranslationJob`.
11. `POST /api/documents/{documentId}/inspect` moves the document through the documented state contract and marks the controlled document `READY` without claiming real PDF extraction.
12. Repeating the same inspection request does not create duplicate terminal inspection records or contradictory document state.
13. `GET /api/documents/{documentId}` returns the persisted `READY` document and any placeholder inspection warning/basis label.
14. `POST /api/documents/{documentId}/jobs` creates a `TranslationJob` only after the document is `READY` and records the active `PriceBook` version and submitted value model.
15. Repeating the same job creation request returns the existing job or an equivalent stable response, with no duplicate `TranslationJob`.
16. `POST /api/jobs/{jobId}/runs` creates a run placeholder without invoking AgentCore.
17. Repeating the same run-start request returns the existing run placeholder or an equivalent stable response, with no duplicate `Run`.
18. `GET /api/jobs/{jobId}/economics` returns economics derived from ledger rows, with no verified outcome for an unaccepted job.
19. `POST /api/runs/{runId}/review` for the non-`AWAITING_REVIEW` run returns `409` and creates no `ReviewDecision` or `HUMAN_REVIEW` ledger row, including on repeated submissions.

## Telemetry Verification

Use the deployed validation run's merged SHA plus a `validationRunId` request header or equivalent stable selector.

Required when telemetry is queryable:

- Control API request signal for each exercised route.
- No 5xx response for successful routes.
- DynamoDB writes for `Document`, `Artifact`, `TranslationJob`, and `Run`.
- No `TranslationJob` write for the pre-inspection job creation attempt.
- No `ReviewDecision` write for the rejected invalid review attempt.
- No duplicate business, artifact, stage, or ledger writes for repeated validation submissions with the same idempotency key or equivalent request identity.
- No mutation of an existing price-book version that is already referenced by a job or ledger row.

If telemetry cannot be queried yet, record the blocker in `PLAN.md`; do not claim telemetry verification passed.

## Acceptance Criteria

- PR is merged to `main`.
- Post-merge CI deployment succeeds.
- Deploy artifact exists for the merged SHA.
- Deployed API verification above passes.
- Persistent data survives a fresh read by ID.
- Mutating routes are idempotent or conditionally written so client retries do not duplicate product records or economics records.
- Source PDF artifacts are created only after S3 object existence and integrity metadata are verified.
- Document inspection state is required before job creation; non-`READY` documents cannot create jobs or run placeholders.
- The dev API protection decision is resolved and real product API routes are not anonymously readable.
- The first dev `PriceBook` values are stored as records/configuration and are visible through the deployed API.
- PriceBook activation is append-only or explicitly deferred; historical jobs and ledger rows cannot be repriced by changing the current price book.
- The controlled MVP PDF fixture path or generation command used for deployed verification is recorded in `PLAN.md`.
- Raw PDF bytes are not stored in DynamoDB or returned by API responses.
- Review contract blocks non-`AWAITING_REVIEW` decisions.
- Review request contracts require positive reviewer seconds for valid future review decisions.
- `PLAN.md` records deterministic, deployed, and telemetry evidence.

## Review Traps

Reject or revise if the change:

- Treats `Run` as the business unit.
- Calculates economics from logs instead of `LedgerItem` rows.
- Adds fake accepted/rejected runs to make the UI look complete.
- Allows jobs or run placeholders for documents that have not reached `READY`.
- Presents placeholder inspection as real PDF extraction, OCR, or translation readiness evidence.
- Hard-codes prices or model IDs.
- Mutates an existing price-book version instead of creating/selecting a new version.
- Recalculates existing job or ledger economics from the current price book instead of persisted ledger rows and the job's recorded value model.
- Passes raw PDF bytes through API payloads.
- Exposes real dev product data unauthenticated without an explicit documented guardrail.
- Uses an ad hoc local PDF instead of a repository-controlled fixture for deployed verification.
- Allows zero-duration or missing-duration reviewer decisions that would make human review appear free.
- Lets duplicate submissions create multiple jobs, runs, review decisions, artifacts, or ledger rows for the same user intent.
- Allows clients to register arbitrary S3 keys or unverified/mismatched upload objects as source PDF artifacts.
