# PR-010 - Persistent Control API

PR-010 starts only after PR-009 is complete. It replaces placeholder Control API behavior with real persistence against DynamoDB and S3 while keeping workflow execution deferred.

PR-010 must replace the PR-009 dev-only unauthenticated placeholder with protected real product API access. Real product routes must require a server-side dev API access token, supplied by an `x-dev-access-token` request header or a clearly documented equivalent, and the token must be stored in AWS configuration/secrets rather than committed code, deploy artifacts, browser JavaScript, or `PLAN.md`.

## Objective

Expose the deployed Control API as the first persistent product surface for documents, jobs, run placeholders, artifacts, ledgers, economics, review contract validation, and price-book reads.

## Scope

In scope:

- Reconcile this story contract with the active `PLAN.md` before application code edits. Any PR-010 acceptance requirement added during planning must either be copied into this story contract or explicitly rejected in `PLAN.md` with rationale, because repository instructions treat dedicated story contracts as the acceptance source.
- Replace the placeholder Control API Lambda handler with routed API behavior.
- Validate all requests and responses with shared schemas.
- Use DynamoDB repositories and S3 artifact key conventions from `packages/data`.
- Support document presign, document creation, document reads, document inspection placeholder, job creation, run placeholder creation, timeline/ledger/artifact/evaluation reads, job economics reads, and price-book reads.
- Support authorized artifact-read access through Control API-generated short-lived presigned read URLs or an equivalent private artifact-access response. This route must resolve by `artifactId`, enforce workspace/resource ownership, preserve private S3 buckets, and must not expose raw PDF bytes through normal JSON APIs or public S3 objects.
- Define and enforce idempotency or conditional-write behavior for all mutating routes that can be retried by browsers, scripts, CI validation, or API clients. At minimum this covers document creation, job creation, run placeholder creation, inspection requests, and future review requests. Repeated identical submissions must return the existing resource or an equivalent stable response; conflicting repeats must fail without creating duplicate business records or ledger rows.
- Define multi-record consistency boundaries for every mutating route that writes more than one product record or artifact object. Document creation, job creation, run placeholder creation, price-book activation, inspection, and future review requests must either commit their required record group atomically or leave an explicit failed/incomplete state that blocks misleading reads until recovery.
- Resolve all product API requests to a server-side workspace/environment context and scope every read, write, list, comparison, and artifact-access operation to that context. Do not trust a client-supplied `workspaceId` as authorization. Wrong-workspace, wrong-stage, or wrong-account resources must not satisfy API responses or deployed verification.
- Propagate a deployed verification `validationRunId` header or equivalent stable selector into telemetry and persisted workflow records where practical. This selector is only for evidence correlation and must not become a product mode or alter business behavior.
- Sanitize deployed verification evidence, API logs, telemetry, and `PLAN.md`: do not record auth headers, cookies, full presigned upload/download URLs, signed query strings, raw PDF bytes, or full document text. Record artifact IDs, S3 bucket/key pairs, checksum/hash, expiry duration, route/status, request IDs, and validation summaries instead.
- Verify S3 source-object integrity before `POST /api/documents` creates a `Document` or `SOURCE_PDF` `Artifact`: the object must exist at the generated repository key, belong to the expected workspace/document context, and persist metadata such as bucket, key, content type, size, and checksum/hash when available.
- Treat the registered `SOURCE_PDF` artifact as the immutable canonical source for that `Document`. After a `Document` and source artifact are created, the API must not overwrite, repoint, or re-register that source with different object identity, size, checksum/hash, or metadata; changing the source PDF requires a new `Document`.
- Implement `POST /api/documents/{documentId}/inspect` as an honest placeholder inspection contract that can move the repository-controlled MVP fixture or a documented controlled-fixture checksum/object-identity allowlist through `UPLOADED -> INSPECTING -> READY`, and can move other documents to `UNSUPPORTED`/`FAILED_INSPECTION`, without claiming real PDF extraction, translation quality, or layout analysis. Arbitrary uploaded PDFs must not become `READY` through placeholder inspection.
- Gate job creation and run placeholder creation on `Document.status == READY`.
- Restrict PR-010 job creation to `V1_TEXT_ONLY`. V2 and V3 are later product slices and must return deterministic deferred/unsupported responses without creating `TranslationJob`, `Run`, comparison, artifact, ledger, or evaluation records.
- Protect real product Control API routes with the dev API access token. Missing, invalid, or anonymous requests must be rejected before reading or writing product data. A non-sensitive health/smoke route may remain unauthenticated only if it returns no product, artifact, workflow, economics, or environment-secret data.
- Resolve and seed the first dev `PriceBook` values as configuration/data records, not hard-coded pricing logic.
- Define bounded monetary input validation before exposing persistent job and price-book routes. `valueModel` and `PriceBook` money fields must be finite USD decimals within documented dev caps; `humanReviewHourlyRateUsd` and `humanReviewHourlyRateDefaultUsd` must be positive so human review cannot appear free through a zero hourly rate.
- Define `PriceBook` versioning as append-only product economics configuration. Updating the active price book must create or select a versioned record and update `ACTIVE_PRICE_BOOK_VERSION`; it must not mutate or overwrite a version already referenced by a `TranslationJob`, `Run`, `LedgerItem`, or `ReviewDecision`.
- Snapshot the `TranslationJob.priceBookVersion` and `TranslationJob.valueModel` at job creation. Existing job economics must continue to roll up from persisted `LedgerItem` rows and the job's recorded value model even if the active price book changes later.
- Use a repository-controlled MVP PDF fixture for deployed upload verification. If the fixture does not exist yet, add only the deterministic fixture source/generation support needed for verification under `demo-data` and/or `scripts`; this is test/demo input, not product-facing seeded history.
- Keep `TranslationJob` as the business unit and `Run` as a technical attempt.
- Calculate economics only from persisted `LedgerItem` rows.
- Return `409` for review attempts unless the run is `AWAITING_REVIEW`.
- Validate review-decision request payloads so accept, reject, and escalate require positive reviewer seconds before any future `HUMAN_REVIEW` ledger row can be created.
- Produce deterministic API error responses.
- Do not expose MVP hard-delete, purge, cleanup, or archive routes for `Document`, `TranslationJob`, `Run`, `StageEvent`, `Artifact`, `LedgerItem`, `EvaluationResult`, `ReviewDecision`, `PriceBook`, or artifact object evidence. Any future destructive or archival behavior requires a separate explicit story that preserves ledger-derived economics and auditability.

## Required Pre-Implementation Decisions

Before application code edits, PR-010 must document these decisions in `PLAN.md` and implement to the selected contract:

- API Gateway authorization strategy. If the dev API token is enforced in Lambda, API Gateway must not also require IAM in a way that blocks CI smoke or Codex direct verification before Lambda can validate the token.
- Dev token lifecycle. Token storage, provisioning/reference, CI smoke access, Codex direct-verification access, rotation, caching, KMS/decrypt permissions, and failure behavior must be CI/IaC-controlled or preflighted. The token value must not appear in CloudFormation templates, Lambda environment variables, deploy artifacts, logs, snapshots, screenshots, or `PLAN.md`.
- Token parsing and comparison. Missing, duplicated, malformed, whitespace-padded, or invalid token input must fail closed without logging supplied values; comparison must use a normalized timing-safe path where applicable.
- PR-010A access compatibility. Browser JavaScript must never need the dev API token. Any future CloudFront origin-proof path must use an unguessable secret or equivalent proof, not a public marker header that direct API Gateway callers can forge.
- HTTP method and CORS behavior. The deployed adapter must handle `OPTIONS`, `HEAD`, and unsupported methods deterministically; CORS/preflight support must be narrow and must not weaken product-route protection.
- Runtime packaging and controls. CDK must package the real Control API with workspace dependencies for the configured Lambda runtime, set explicit timeout/memory/throttling/log retention/log group choices, and keep Lambda permissions least-privilege.
- Structured evidence. Logs and runtime evidence must include route, status, request ID, validation selector, stage/workspace/build identity, duration, and sanitized error code where available; they must not include request bodies, auth values, cookies, full presigned URLs, signed query strings, raw PDF bytes, or raw document text.
- Upload constraints and source identity. Presign/registration must constrain key, content type, size, expiry, and metadata as much as AWS supports. Registration must verify object existence, prefix, content type, size, checksum/hash from server-observed bytes or S3-validated metadata, PDF plausibility where practical, and immutable object identity such as version ID plus checksum/ETag.
- Unregistered upload lifecycle. Abandoned staging uploads may be cleaned only through behavior isolated from registered product artifacts and economics evidence.
- Idempotency, consistency, and pagination. Mutating routes must define idempotency keys/fingerprints and conditional/transactional boundaries. List routes must be bounded and ordered; deployed verification must account for GSI eventual consistency without treating transient lag as proof of missing data.
- Business value and variant scope. PR-010 must document money precision/caps, reject zero human-review hourly rates, accept only V1 job creation, and defer V2/V3 without writes.
- Placeholder inspection readiness criteria. PR-010 must document the controlled fixture or checksum/object-identity allowlist that can become `READY`; other uploaded PDFs cannot pass the placeholder as ready.
- Partial-write proof boundary. Partial-write and fault-injection behavior must be proven through deterministic tests and non-product test doubles or harnesses only. PR-010 must not add deployed fault-injection routes, debug modes, test modes, API-selectable failure triggers, or other product-facing fault controls.
- Placeholder honesty. Run placeholders must not be marked `RUNNING` unless execution actually begins. PR-010 placeholders must not create workflow-looking `StageEvent`, `EvaluationResult`, translated/completed-output artifact, `MODEL_INFERENCE` ledger row, tool ledger row, or completed-output evidence.
- Route surface parity. The application router, CDK route definitions, infrastructure tests, API reference, CI smoke tooling, deploy artifact, and deployed verification plan must agree on the implemented PR-010 route set, including artifact private-read access.
- CI/deploy artifact update. PR-010 must remove PR-009 assumptions around `DEV_UNAUTHENTICATED_PLACEHOLDER`, placeholder 501 smoke behavior, and unauthenticated product access from workflow validation, smoke checks, and deploy artifact creation.
- Data-resource replacement safety. PR-010 must not replace, rename, or destroy retained DynamoDB tables or the artifact bucket. API/Lambda replacement is acceptable only when stack outputs and deployed verification use the newly deployed endpoint/resources.
- Existing dev data handling. The API must safely read, migrate/backfill through IaC-controlled logic, or exclude prior placeholder-era/incomplete records without silently corrupting product or economics claims.

## Non-Goals

- No AgentCore Runtime invocation.
- No stage runner execution.
- No Gateway tools.
- No Bedrock calls.
- No PDF extraction, translation, evaluation, or recomposition.
- No real PDF inspection claim. The inspection endpoint is a readiness/state contract placeholder only until PR-013 implements real PDF tooling.
- No fake completed run histories.
- No replay mode, synthetic-run mode, live-capture mode, recording mode, or presentation mode.
- No unauthenticated real product API. The PR-009 anonymous placeholder access must be removed, restricted to non-sensitive health/smoke behavior, or replaced by dev-token protection before persistent product records are exposed.
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
- Value-model and money validation tests proving job value inputs and price-book monetary fields reject negative, non-finite, excessive-precision, out-of-cap, and zero human-review hourly rate values; `humanReviewHourlyRateUsd` and active `humanReviewHourlyRateDefaultUsd` must be positive.
- Workflow-variant scope tests proving PR-010 accepts `V1_TEXT_ONLY` job creation and returns deterministic deferred/unsupported errors for V2/V3 without creating `TranslationJob`, `Run`, comparison, artifact, ledger, or evaluation records.
- Document inspection placeholder tests proving valid transitions to `READY`, `UNSUPPORTED`, and `FAILED_INSPECTION`, rejecting invalid transitions, and allowing `READY` only for the repository-controlled MVP fixture or documented controlled-fixture checksum/object-identity allowlist.
- Access-protection tests proving real product routes reject missing or invalid dev API tokens, accept the configured dev API token, and do not log or persist the token. Only explicitly documented non-sensitive health/smoke routes may be anonymously readable.
- Workspace/environment scoping tests proving list, read, mutate, comparison, and artifact-access routes reject or exclude wrong-workspace, wrong-stage, and wrong-account resources, and do not trust a body/query `workspaceId` as authorization.
- Validation-selector tests proving `validationRunId` or equivalent request metadata is visible in telemetry and persisted validation records without changing product behavior.
- Artifact access tests proving presigned read URLs or equivalent private artifact access are issued only for authorized artifacts in the current workspace, expire quickly, do not expose raw bytes through JSON APIs, and reject missing, cross-workspace, cross-document, or unregistered S3 keys.
- Evidence-redaction tests proving request/response logging, telemetry fields, CI/deployed verification summaries, and `PLAN.md` examples use sanitized artifact/request identifiers and do not persist full presigned URLs, signed query strings, auth headers, cookies, raw PDF bytes, or full document text.
- Fixture/generator check proving the controlled MVP PDF used for deployed verification is reproducible from the repository and not an ad hoc local file.
- Idempotency/conditional-write tests proving duplicate document creation, job creation, run placeholder creation, inspection, and review-validation submissions do not create duplicate `Document`, `Artifact`, `TranslationJob`, `Run`, `ReviewDecision`, `StageEvent`, or `LedgerItem` records.
- Partial-failure consistency tests proving document creation cannot leave a visible `Document` without a canonical `SOURCE_PDF` `Artifact`, job/run creation cannot leave contradictory job/run state, price-book activation cannot leave `ACTIVE_PRICE_BOOK_VERSION` pointing to a missing or invalid version, and future review validation cannot leave terminal state without matching review/economics evidence.
- Test-only fault-injection checks proving partial persistence failures stay out of product-facing runtime behavior; do not add deployed fault-injection routes, debug modes, test modes, or API-selectable failure triggers to satisfy testing.
- S3 artifact integrity tests proving document creation rejects missing objects, arbitrary client-chosen keys, wrong workspace/document prefixes, wrong content type, and mismatched size/checksum metadata where the upload flow provides those expectations.
- Source immutability tests proving an existing `Document`'s canonical `SOURCE_PDF` artifact cannot be overwritten, repointed, or re-registered with a different checksum/hash, size, S3 key, S3 object identity, or metadata; a different source PDF must create a different `Document`.
- Route-surface tests proving unsupported `DELETE`, purge, cleanup, or archive attempts cannot remove or hide persisted economic, review, workflow, or artifact evidence.
- `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm cdk synth`.

## Deployed Verification

After merge, the normal CI deployment must deploy the merged SHA and produce the deploy artifact required by PR-009.

Codex must use the deployed API directly and record:

1. Deploy artifact location and merged SHA.
2. Deploy artifact AWS account ID, region, stage, `ControlApiUrl`, and stack outputs match the API endpoint used for validation.
3. Anonymous access and access with an invalid dev API token to a protected product route are denied before product data is read or written.
4. Authorized dev access using the configured token can exercise the API verification path with a stable `validationRunId` or equivalent selector. `PLAN.md` must record only that authorized access was used; it must not record the token value.
5. `GET /api/price-books/current` returns the active `PriceBook`.
6. If `PUT /api/price-books/current` is enabled in PR-010, it creates/selects an append-only version and preserves already-created job economics; if it is not enabled, it returns an honest not-yet-implemented or protected response.
7. `POST /api/documents/presign` returns a presigned S3 upload URL and an artifact key, without returning raw PDF bytes.
8. The repository-controlled MVP Spanish PDF fixture is uploaded through the presigned URL, while `PLAN.md` records only sanitized URL evidence such as artifact key, expiry window, status code, and request ID.
9. `POST /api/documents` creates a `Document` and `SOURCE_PDF` `Artifact` only after verifying the uploaded S3 object and persisting source metadata.
10. Repeating the same document creation request returns the same document/artifact outcome or an equivalent stable response, with no duplicate rows.
11. A conflicting source registration for the same `Document` or source key with different size/checksum/object identity is rejected, and the original `Document` plus `SOURCE_PDF` artifact metadata remain unchanged.
12. `POST /api/documents/{documentId}/jobs` before inspection returns `409` or `DOCUMENT_UNSUPPORTED` and creates no `TranslationJob`.
13. `POST /api/documents/{documentId}/inspect` moves the controlled fixture document through the documented state contract and marks it `READY` without claiming real PDF extraction.
14. A non-allowlisted or unknown PDF object cannot be marked `READY` by placeholder inspection and cannot start a job.
15. Repeating the same inspection request does not create duplicate terminal inspection records or contradictory document state.
16. `GET /api/documents/{documentId}` returns the persisted `READY` document and any placeholder inspection warning/basis label.
17. V2/V3 job creation attempts return deterministic deferred/unsupported responses and create no job/run/economics records.
18. Invalid value models, including zero human-review hourly rate and out-of-bounds money values, are rejected and create no job.
19. `POST /api/documents/{documentId}/jobs` creates a V1 `TranslationJob` only after the document is `READY` and records the active `PriceBook` version and submitted value model.
20. Repeating the same job creation request returns the existing job or an equivalent stable response, with no duplicate `TranslationJob`.
21. `POST /api/jobs/{jobId}/runs` creates a run placeholder without invoking AgentCore.
22. Repeating the same run-start request returns the existing run placeholder or an equivalent stable response, with no duplicate `Run`.
23. `GET /api/jobs/{jobId}/economics` returns economics derived from ledger rows, with no verified outcome for an unaccepted job.
24. `GET /api/artifacts/{artifactId}/download-url` or the chosen equivalent returns authorized, short-lived private access for the source PDF artifact and rejects unauthorized or cross-workspace artifact access.
25. The full presigned artifact access URL, signed query string, auth headers, cookies, and raw PDF bytes are absent from durable logs, telemetry, CI artifacts, and `PLAN.md`.
26. Wrong-workspace, wrong-stage, or wrong-account resource IDs cannot be used to read, mutate, compare, or retrieve artifacts through the validation API surface.
27. `POST /api/runs/{runId}/review` for the non-`AWAITING_REVIEW` run returns `409` and creates no `ReviewDecision` or `HUMAN_REVIEW` ledger row, including on repeated submissions.
28. Unsupported `DELETE`, purge, cleanup, or archive attempts against representative document/job/run/artifact/economics routes are rejected or not routed, and the previously created records remain readable.
29. Record partial-write and fault-injection evidence from deterministic tests only. Deployed verification may exercise ordinary invalid or conflicting requests, but PR-010 must not add deployed fault-injection routes, debug modes, test modes, or API-selectable failure triggers.

## Telemetry Verification

Use the deployed validation run's merged SHA plus a `validationRunId` request header or equivalent stable selector.

Required when telemetry is queryable:

- Control API request signal for each exercised route.
- Environment/workspace evidence showing the validation requests hit the deployed account, stage, and workspace from the deploy artifact.
- The stable validation selector appears on relevant API telemetry and persisted workflow records where implemented.
- Logs and telemetry contain sanitized route, artifact, request, and status evidence without full presigned URLs, auth headers, cookies, raw PDF bytes, or full document text.
- No 5xx response for successful routes.
- DynamoDB writes for `Document`, `Artifact`, `TranslationJob`, and `Run`.
- No `TranslationJob` write for the pre-inspection job creation attempt.
- No `ReviewDecision` write for the rejected invalid review attempt.
- No duplicate business, artifact, stage, or ledger writes for repeated validation submissions with the same idempotency key or equivalent request identity.
- No visible successful document, job, run, price-book, or review outcome whose required related records are missing or contradictory.
- No mutation of an existing price-book version that is already referenced by a job or ledger row.
- No mutation of the validation `Document`'s canonical `SOURCE_PDF` artifact or source metadata during conflicting source-registration attempts.
- Artifact-read route signal for the validation artifact and denied signal for unauthorized/cross-workspace artifact access.
- No delete, purge, cleanup, archive, TTL-expiry, or destructive mutation signal for validation `Document`, `TranslationJob`, `Run`, `StageEvent`, `Artifact`, `LedgerItem`, `EvaluationResult`, `ReviewDecision`, `PriceBook`, or artifact object evidence.

If telemetry cannot be queried yet, record the blocker in `PLAN.md`; do not claim telemetry verification passed.

## Acceptance Criteria

- PR is merged to `main`.
- Post-merge CI deployment succeeds.
- Deploy artifact exists for the merged SHA.
- Deployed API verification above passes.
- Persistent data survives a fresh read by ID.
- Persistent data, lists, comparisons, and artifact access are scoped to the server-resolved workspace and deployed environment; wrong-workspace, wrong-stage, and wrong-account resources cannot satisfy validation.
- Validation evidence is isolated by a stable selector such as `validationRunId` without adding a product mode.
- Mutating routes are idempotent or conditionally written so client retries do not duplicate product records or economics records.
- Mutating routes that write multiple records or artifact objects commit required record groups atomically or expose an explicit failed/incomplete state; successful reads cannot be assembled from partial record groups.
- Source PDF artifacts are created only after S3 object existence and integrity metadata are verified.
- A document's canonical source artifact is immutable after registration; source replacement requires a new `Document`.
- Placeholder inspection can mark only the repository-controlled fixture or documented controlled-fixture checksum/object-identity allowlist as `READY`; arbitrary PDFs stay unsupported or failed.
- Document inspection state is required before job creation; non-`READY` documents cannot create jobs or run placeholders.
- PR-010 job creation accepts only V1 and defers V2/V3 without creating records.
- Job value models and active price-book money fields obey documented finite USD bounds and precision; human-review hourly rates are positive.
- Real product API routes require the configured dev API access token, reject anonymous access, and do not leak the token through logs, telemetry, CI artifacts, deploy artifacts, screenshots, or `PLAN.md`.
- The first dev `PriceBook` values are stored as records/configuration and are visible through the deployed API.
- PriceBook activation is append-only or explicitly deferred; historical jobs and ledger rows cannot be repriced by changing the current price book.
- The controlled MVP PDF fixture path or generation command used for deployed verification is recorded in `PLAN.md`.
- Raw PDF bytes are not stored in DynamoDB or returned by API responses.
- MVP API routes cannot hard-delete, purge, clean up, or archive product records or artifact object evidence required for economics and auditability.
- Reviewer-visible artifact access is private, authorized, artifact-ID based, and short-lived; source and generated artifact bytes are not made public.
- Durable evidence in logs, telemetry, CI artifacts, and `PLAN.md` is sanitized and excludes credentials, auth headers, cookies, full presigned URLs, signed query strings, raw PDF bytes, and full document text.
- Review contract blocks non-`AWAITING_REVIEW` decisions.
- Review request contracts require positive reviewer seconds for valid future review decisions.
- `PLAN.md` records deterministic, deployed, and telemetry evidence.

## Review Traps

Reject or revise if the change:

- Treats `Run` as the business unit.
- Calculates economics from logs instead of `LedgerItem` rows.
- Adds fake accepted/rejected runs to make the UI look complete.
- Allows jobs or run placeholders for documents that have not reached `READY`.
- Lets placeholder inspection mark arbitrary uploaded PDFs as `READY`.
- Creates V2/V3 jobs, runs, comparisons, artifacts, evaluations, or ledger records in PR-010.
- Accepts a zero human-review hourly rate in job value models or the active price book.
- Accepts unbounded or excessive-precision money inputs that can distort persisted economics.
- Presents placeholder inspection as real PDF extraction, OCR, or translation readiness evidence.
- Hard-codes prices or model IDs.
- Mutates an existing price-book version instead of creating/selecting a new version.
- Recalculates existing job or ledger economics from the current price book instead of persisted ledger rows and the job's recorded value model.
- Passes raw PDF bytes through API payloads.
- Makes the artifact bucket or object URLs public to satisfy PDF viewing.
- Lets a caller request signed URLs by arbitrary S3 key instead of an authorized `Artifact` record.
- Persists full presigned URLs, signed query strings, auth headers, cookies, raw PDF bytes, or full document text in logs, telemetry, CI artifacts, or `PLAN.md`.
- Exposes real dev product data unauthenticated without an explicit documented guardrail.
- Trusts a request body/query `workspaceId`, comparison group ID, artifact ID, or other client-supplied ID without verifying it belongs to the server-resolved workspace and deployed environment.
- Lets stale data from another stage, AWS account, workspace, or validation run satisfy deployed verification.
- Uses an ad hoc local PDF instead of a repository-controlled fixture for deployed verification.
- Allows a persisted `Document` to silently change source PDF bytes, source artifact identity, checksum/hash, or source metadata.
- Allows zero-duration or missing-duration reviewer decisions that would make human review appear free.
- Lets duplicate submissions create multiple jobs, runs, review decisions, artifacts, or ledger rows for the same user intent.
- Returns success or shows normal economics/review/comparison output after only part of the required record group was persisted.
- Adds deployed fault-injection routes, debug modes, test modes, API-selectable failure triggers, or other product-facing fault controls to prove partial-write handling.
- Allows clients to register arbitrary S3 keys or unverified/mismatched upload objects as source PDF artifacts.
- Adds hard-delete, purge, cleanup, archive, TTL, or destructive mutation behavior that can hide failed/rejected work, remove review decisions, remove ledger cost, orphan artifact records, or make historical economics unverifiable.
