# PLAN

## Objective

Implement `PR-010 - Persistent Control API`: replace the deployed placeholder API with a protected, DynamoDB/S3-backed Control API for the first persistent product surface while keeping workflow execution, AgentCore, Gateway, Bedrock, PDF extraction, frontend hosting, replay, synthetic, live-capture, and presentation behavior out of scope.

## Scope and non-goals

In scope:

- Replace the inline placeholder Control API Lambda with the real routed Control API package deployed through CDK.
- Protect all real product routes with a server-side dev API access token, using `x-dev-access-token` or an equivalent documented header.
- Store token configuration in AWS configuration/secrets or CI/CD configuration, never in committed code, browser JavaScript, deploy artifacts, logs, or `PLAN.md`.
- Establish the direct deployed-verification credential path before merge. Codex must be able to use the protected deployed API after the post-merge deployment without exposing the token in durable evidence; if that access path is unresolved, PR-010 is blocked.
- Reconcile the active `PLAN.md` with `docs/codex/PR-010-PERSISTENT-CONTROL-API.md` before implementation edits. Any acceptance requirement added during planning must either be promoted to the PR-010 story contract or explicitly rejected with rationale before code changes begin.
- Keep the PR-010 access design compatible with PR-010A: browser JavaScript must never need the dev API token, and the Control API must be able to accept a later CloudFront origin-proof path without weakening direct API token protection.
- Resolve API Gateway authorization deliberately. The current fallback `HttpIamAuthorizer` conflicts with a plain `x-dev-access-token` Lambda check; PR-010 must either remove/replace API Gateway IAM auth for product routes and enforce the dev token in Lambda, or choose an equivalent access mechanism that CI and Codex can actually use after deployment.
- Ensure the token value never appears in synthesized CloudFormation templates, Lambda environment variables, deploy artifacts, logs, or test snapshots. Store only a secret/parameter identifier in infrastructure configuration unless a safer mechanism is proven.
- Compare dev API tokens using a timing-safe, normalized header path that rejects missing, duplicated, malformed, or whitespace-padded token input without logging supplied values.
- Define token lifecycle explicitly, including how the token is created, retrieved by CI smoke, retrieved by Codex for direct verification, rotated, cached, and failed closed. If Secrets Manager or SSM SecureString is used, include least-privilege read and KMS/decrypt permissions in CDK tests.
- Provision or reference the dev token through CI/IaC-controlled configuration, not an undocumented manual console step. If a pre-existing secret/parameter is required, the name/ARN and creation prerequisite must be documented without exposing the value, and CI must fail before deployment if it is absent.
- Keep future CloudFront origin-proof compatibility resistant to direct-client forgery. If PR-010 reserves an origin-proof path for PR-010A, it must assume that ordinary clients can send arbitrary headers to API Gateway and therefore require an unguessable origin-proof secret or equivalent mechanism, not a public marker header.
- Resolve workspace and environment context server-side from deployment configuration.
- Add an API Gateway/Lambda adapter for the routed Control API. It must parse method/path/query/body/headers, reject malformed input deterministically, return stable headers/status/body, and never depend on the in-memory test context in deployed mode.
- Define behavior for every HTTP method API Gateway can deliver, including `OPTIONS`, `HEAD`, and unsupported destructive methods. Unsupported methods must return deterministic errors without crashing; any CORS/preflight support must not open product routes broadly or weaken PR-010A access controls.
- Configure explicit dev throttling/rate limits for the protected API so token guessing, accidental retry loops, and validation mistakes cannot create unbounded request volume or cost. The limits must still allow the documented deployed verification path.
- Enforce bounded request and upload limits. JSON request bodies, presign metadata, uploaded object size, presigned URL expiry, and supported PDF shape must have explicit dev limits that fit the controlled MVP fixture and fail deterministically before expensive or unsafe processing.
- Use an upload mechanism that constrains key, content type, expiry, metadata, and size as much as AWS supports, such as presigned POST conditions when appropriate. Registration checks remain mandatory because upload constraints alone are not proof.
- Add a Lambda packaging/bundling strategy that includes workspace packages and runtime dependencies. The synthesized/deployed artifact must be importable by Node.js 24 in Lambda before PR-010 can merge.
- Set explicit Lambda timeout, memory, and any concurrency/throttle choices for the real Control API based on the bounded PR-010 work. The timeout must be short enough to fail safely and long enough for DynamoDB/S3/secret calls under expected dev latency.
- Include sanitized deployment identity in runtime evidence, such as stage, workspace, request ID, validation selector, and build SHA via response headers or structured logs, without creating a product mode.
- Configure structured runtime logging and queryable evidence identifiers deliberately. Logs should include route, status, request ID, validation selector, stage/workspace/build identity, duration, and sanitized error code; they must not include request bodies, token values, full presigned URLs, signed query strings, cookies, or raw document text. Log retention and log group names must be IaC-controlled or captured in the deploy artifact.
- Remove the current router behavior that lets `request.workspaceId` override the server context.
- Validate all request and response payloads with shared schemas.
- Use DynamoDB repositories and S3 artifact object storage/key conventions from `packages/data`.
- Add the missing persistent API behavior for document presign, document creation, document reads/lists, placeholder inspection, job creation, run placeholder creation, timeline/ledger/artifact/evaluation reads, job economics reads, price-book reads, and artifact private-read access.
- Add artifact-ID-based private read access, such as `GET /api/artifacts/{artifactId}/download-url`, with workspace ownership checks and short-lived S3 presigned URLs.
- Add every implemented route to the CDK route surface, route tests, API reference expectations, and deploy smoke/verification tooling. The current route surface does not include the artifact private-read route, so PR-010 must close that gap before deployed verification.
- Verify S3 source-object existence, content type, size, checksum/hash metadata where available, and object identity before registering a `Document` and canonical `SOURCE_PDF` `Artifact`.
- Do not trust client-supplied S3 metadata alone as proof that the upload is a controlled PDF. Registration must reject missing objects, oversized objects, wrong content type, mismatched checksum/size metadata, wrong key prefix, and non-PDF-looking bytes where a cheap bounded signature check is practical. Source checksum evidence must come from server-observed object bytes or an S3-validated checksum, not only from a JSON body field.
- Treat `SOURCE_PDF` artifacts as immutable canonical source evidence for a document; a different source PDF requires a new `Document`. Because the artifact bucket is versioned, PR-010 must persist enough S3 object identity evidence, such as version ID plus checksum/ETag metadata, and use it for private reads where needed so later overwrites of the same key cannot silently change a registered source.
- Define what happens to presigned uploads that are never registered. They must not be represented as product artifacts or economic evidence; any lifecycle policy for unregistered staging objects must be isolated from registered artifact/economics evidence and must not create a product cleanup mode.
- Define idempotency for browser/script/CI retries on document creation, job creation, run placeholder creation, inspection, and review-validation requests.
- Bound all list/read collection routes with explicit ordering, limits, pagination tokens or a deliberately documented small-dev cap. Do not rely on unbounded DynamoDB `queryAll` behavior or in-memory arrays as the deployed API contract.
- Account for DynamoDB read-after-write behavior. Direct reads by primary key should prove durable writes; list routes backed by GSIs must either use bounded retry/polling in deployed verification or document eventual consistency without letting transient GSI lag look like missing data.
- Define conditional-write or transaction boundaries for each mutating route that writes more than one record.
- Treat infrastructure replacement as an explicit risk. PR-010 must not replace, rename, or destroy retained data-bearing S3/DynamoDB resources. Any API/Lambda replacement is acceptable only if the deploy artifact captures the new endpoint/resources and post-merge verification uses the newly deployed outputs.
- Seed or configure the first dev `PriceBook` as records/configuration, not hard-coded costing logic.
- Seed the active dev `PriceBook` through an idempotent CI/IaC/runtime-bootstrap path that can be verified after deployment. Do not rely on manual DynamoDB writes, and do not create multiple active price books through Lambda cold-start races.
- Define bounded monetary input validation before exposing persistent job and price-book routes. `valueModel` and `PriceBook` money fields must be finite USD decimals within documented dev caps; `humanReviewHourlyRateUsd` and `humanReviewHourlyRateDefaultUsd` must be positive so human review cannot appear free through a zero hourly rate.
- Keep `PriceBook` versions append-only when referenced by jobs/runs/ledger/review records.
- Snapshot `TranslationJob.priceBookVersion` and `TranslationJob.valueModel` at job creation.
- Keep economics derived only from persisted `LedgerItem` rows.
- Restrict PR-010 job creation to `V1_TEXT_ONLY`. V2 and V3 are later product slices and must return deterministic deferred/unsupported responses without creating `TranslationJob`, `Run`, comparison, artifact, ledger, or evaluation records.
- Implement `POST /api/jobs/{jobId}/runs` as a persistent run placeholder only; it must not invoke AgentCore Runtime.
- Define exact run-placeholder and job state semantics before implementation. Do not mark a job or run as `RUNNING` unless execution has actually begun. If the placeholder uses `CREATED` or another non-executing state, reads and economics must label it honestly and later PR-011 must have a valid transition path.
- Implement `POST /api/documents/{documentId}/inspect` as an honest placeholder readiness/state contract only; it must not claim real extraction, OCR, translation, or layout quality. Until real inspection exists, it may mark `READY` only for the repository-controlled MVP fixture or an explicitly documented controlled-fixture checksum/object-identity allowlist; arbitrary uploaded PDFs must become `UNSUPPORTED` or `FAILED_INSPECTION` without enabling job creation.
- Do not fabricate workflow-looking `StageEvent`, `EvaluationResult`, translated artifact, model-inference ledger, or completed-output evidence for PR-010 placeholders. Empty timelines, empty ledgers, and absent evaluations are acceptable only when responses label them as not-yet-executed placeholder state.
- Gate job creation and run placeholder creation on `Document.status == READY`.
- Return deterministic API errors and use `409` where product-state conflicts are expected.
- Extend the shared API error model before implementation if needed so auth failures, forbidden/cross-workspace access, idempotency conflicts, malformed/unsupported methods, payload-too-large, artifact-access denial, and deferred routes do not collapse into misleading validation or internal errors.
- Validate review payloads so future accept/reject/escalate actions require positive reviewer seconds, while PR-010 review attempts against non-`AWAITING_REVIEW` runs create no `ReviewDecision` or `HUMAN_REVIEW` ledger rows.
- Add a repository-controlled controlled MVP Spanish PDF fixture or deterministic generator under `demo-data` and/or `scripts` if no fixture exists yet.
- Extend deterministic checks and CI validation for the persistent API, access protection, idempotency, partial-write safety, artifact privacy, source immutability, and evidence redaction.
- Update PR-009 CI deployment follow-through for the new API reality: `.github/workflows/ci.yml`, `scripts/ci/smoke-control-api.mjs`, `scripts/ci/create-deploy-artifact.mjs`, and `scripts/ci/validate-workflow.mjs` must stop assuming `DEV_UNAUTHENTICATED_PLACEHOLDER` access and must smoke-test the protected persistent API without leaking secrets.
- Keep CI smoke non-mutating for PR-010, preferably by calling a protected read route such as `GET /api/price-books/current`; mutating deployed product validation remains Codex direct verification after merge.
- Update deploy artifact schema/content so post-merge artifacts describe the persistent protected Control API, active access mode, CI smoke route, and required verification endpoints rather than PR-009 placeholder semantics.
- Handle existing dev records and prior placeholder-era data deliberately. If deployed tables contain old or incomplete records, the API must either read them safely, migrate/backfill them through IaC-controlled logic, or exclude them from validation without silently corrupting product/economics claims.
- Deploy only through the normal post-merge CI deployment created by PR-009, then directly verify the deployed API as Codex.

Non-goals:

- No frontend hosting or rendered app workflow; that is `PR-010A`.
- No AgentCore Runtime integration.
- No AgentCore Gateway integration.
- No stage runner execution.
- No Bedrock calls.
- No real PDF extraction, OCR, translation, evaluation, or recomposition.
- No fake completed run histories or product-facing seeded run histories.
- No replay mode, synthetic-run mode, live-capture mode, recording mode, or presentation mode.
- No unauthenticated real product API.
- No raw PDF bytes in JSON APIs or DynamoDB.
- No public S3 objects or public artifact bucket access.
- No hard-coded prices or model IDs.
- No hard delete, purge, cleanup, archive, TTL-expiry, or destructive mutation route for product/economics/artifact evidence.
- No AWS console edits, local `cdk deploy`, or manually triggered deployment path.
- No manual cleanup of validation records or artifact objects after failed verification. Recovery must happen through a new PR/CI deployment or additive records that preserve evidence.

## Assumptions and open questions

- PR-009 is complete and deployed. Evidence already captured: merged SHA `362af046106c12c5adb71e6205c9f308e541a8cb`, GitHub Actions run `https://github.com/guilleojeda/unit-economics-of-ai-agents/actions/runs/26198101436`, and deployed `ControlApiUrl` `https://se5hnu1t32.execute-api.us-east-1.amazonaws.com/`.
- The next implementation unit is PR-010. Repository-local `AGENTS.md` identifies PR-010 as next and blocks later product/API behavior until PR-010 and then PR-010A are completed and deployed.
- The current deployed placeholder may be unauthenticated because PR-009 exposed no product data. PR-010 must replace that with protected product routes before any persistent product records are reachable.
- The current CI workflow still sets `CDK_ALLOW_UNAUTHENTICATED_PLACEHOLDER_API=true`, and the current smoke/deploy-artifact scripts require `DEV_UNAUTHENTICATED_PLACEHOLDER` and a 501 `NOT_IMPLEMENTED` response. PR-010 must update these or the post-merge deployment and acceptance path will remain coupled to obsolete placeholder behavior.
- The current CDK Control API stack uses `HttpIamAuthorizer` when unauthenticated placeholder mode is false. That is incompatible with the documented `x-dev-access-token` path unless the client also signs requests with AWS IAM credentials. PR-010 must make this authorization layer explicit and test it through deployed-event-shaped requests.
- The current CDK route surface and infrastructure tests do not include `GET /api/artifacts/{artifactId}/download-url`. PR-010 must update route definitions and tests, not only the application router.
- Current code already has an API route table and in-memory tests for several job/run/economics behaviors, but document upload/creation/inspection are deferred and infrastructure deploys an inline placeholder Lambda.
- Current `dispatch` accepts `request.workspaceId` and overrides the server context. This contradicts PR-010 and must be removed before persistent routes are accepted.
- Current `startRun` invokes `context.agentRuntimeClient.invoke`. PR-010 must change deployed behavior to create a run placeholder without invoking AgentCore.
- Current repository interfaces are simple `put/get/list` contracts. PR-010 may need a narrow transaction/idempotency abstraction in `packages/data` or an API-layer persistence service so multi-record writes cannot appear successful when partial.
- Open question: exact dev token storage and retrieval mechanism. Resolution: choose the smallest AWS-native mechanism that can be deployed through CI and CDK without committing secret values. Prefer Secrets Manager or SSM SecureString referenced by ARN/name from deployment configuration. Runtime and CI smoke must fail closed when token configuration is missing, and the chosen mechanism must leave Codex with a secure direct-verification access path after merge.
- Open question: exact dev token provisioning prerequisite. Resolution: prefer IaC/CI-managed creation or reference. If a pre-existing secret is required, document the non-secret identifier, require CI preflight validation before deployment, and do not treat manual console setup as part of slice completion.
- Open question: exact token lifecycle and rotation mechanism. Resolution: define a single source of truth for the dev token or a deterministic synchronization path between AWS secret storage, CI smoke, and Codex direct verification. Rotation must not require browser JavaScript changes, must not expose old or new token values in artifacts, and must fail closed if runtime and smoke credentials diverge.
- Open question: PR-010 story-contract alignment. Resolution: before code edits, compare the active `PLAN.md` against `docs/codex/PR-010-PERSISTENT-CONTROL-API.md`; promote plan-only acceptance requirements into the story contract or document why they are intentionally plan-local implementation detail. Do not let later implementation rely on requirements that only exist in a temporary plan when repository instructions identify story contracts as acceptance sources.
- Open question: exact idempotency key shape. Resolution: use a documented request header such as `Idempotency-Key` for mutating routes, combine it with server workspace, route, and stable business identifiers, and persist enough request fingerprint data to distinguish identical retries from conflicting repeats.
- Open question: exact list pagination and consistency contract. Resolution: define response limits, ordering, next-token shape or explicit small-dev caps for every list route, and define how deployed verification handles GSI eventual consistency after fresh writes without masking real missing-record bugs.
- Open question: exact run-placeholder state semantics. Resolution: choose and test a non-misleading state model before implementation. The default should avoid `RUNNING` unless execution starts; if job/run status remains `CREATED`, later PR-011 must have an explicit valid transition path and no duplicate run side effects.
- Open question: PR-010 workflow variant scope. Resolution: accept only `V1_TEXT_ONLY` in PR-010 job creation. Return a deterministic deferred/unsupported error for V2/V3 requests with no product records created, because PR-014 and PR-015 own those product behaviors.
- Open question: exact placeholder inspection readiness criteria. Resolution: `READY` is permitted only for the repository-controlled MVP fixture or a documented controlled-fixture checksum/object-identity allowlist. Unknown or arbitrary PDFs must not pass placeholder inspection.
- Open question: exact value model and monetary precision/cap rules. Resolution: define finite USD decimal caps and precision for API inputs before implementation. Keep `valuePerAcceptedPdfUsd` and optional baseline values nonnegative within caps, and require positive `humanReviewHourlyRateUsd` plus positive active `PriceBook.humanReviewHourlyRateDefaultUsd`.
- Open question: exact request/upload size and PDF plausibility limits. Resolution: set explicit limits before implementing presign/registration and prove the controlled MVP PDF fits them while oversized, wrong-type, wrong-prefix, and non-PDF-looking objects fail deterministically.
- Open question: exact API throttling and Lambda timeout/memory settings. Resolution: choose conservative dev limits that allow the deployed verification flow while bounding brute-force attempts, runaway retries, S3/DynamoDB calls, and Lambda cost. Record the chosen limits in CDK tests and deploy artifact evidence.
- Open question: whether unregistered presigned uploads need lifecycle handling. Resolution: if cleanup is needed, isolate it to unregistered staging objects only and document that it cannot delete or hide registered `Document`, `Artifact`, `LedgerItem`, or review/economics evidence.
- Open question: source upload checksum and immutable object identity availability. Resolution: support checksum/hash metadata when the presign flow can require or receive it, and capture S3 object version ID/ETag or equivalent identity from `HeadObject` after upload. If the current schemas or object store do not carry enough object identity, extend them before claiming source immutability.
- Open question: whether `PUT /api/price-books/current` should be enabled in PR-010. Resolution: implement append-only activation only if it remains small and strongly testable; otherwise return an honest protected not-yet-implemented response and keep `GET /api/price-books/current` plus seeded active price book in scope.
- Open question: telemetry queryability for PR-010 validation. Resolution: propagate `validationRunId` into boundary logs and persisted records where practical, configure structured logs and log retention through IaC where possible, query telemetry if available after deployment, and record an exact blocker instead of claiming telemetry verification if it cannot be isolated.
- Open question: infrastructure replacement risk during the placeholder-to-real API transition. Resolution: review synthesized templates/diff evidence before merge and post-merge artifact outputs after deploy; data-bearing tables and artifact bucket must retain names, retention, PITR/versioning, and no replacement/delete behavior.

## Adversarial assumption register

- Assumption: PR-009 deployment pipeline remains healthy enough to deploy PR-010.
  - Evidence: PR-009 completed with a successful deploy artifact and direct placeholder API verification.
  - Could be false if: IAM trust, CDK bootstrap, stack status, artifact bucket permissions, or workflow validation drift after the last successful run.
  - Breakage if false: PR-010 code can pass local checks but never reach deployed verification.
  - Plan change: PR-010 keeps PR-009 deploy checks, treats post-merge deploy failure as incomplete work, and recovers only through a new PR/CI path.

- Assumption: The repository-local story changes and `PLAN.md` are the instructions actually driving implementation.
  - Evidence: current working tree has uncommitted instruction/story edits and `AGENTS.md` points PR-010 as next.
  - Could be false if: implementation starts from a branch that omits these edits, or the PR mixes stale story contracts with code changes.
  - Breakage if false: agents could implement older placeholder assumptions or miss the protected API requirements.
  - Plan change: resolve instruction/story-doc diffs intentionally before implementation PR scope is finalized; do not let stale local docs govern deployed acceptance.

- Assumption: It is safe for the active `PLAN.md` to contain stricter acceptance requirements than the PR-010 story contract.
  - Evidence: repeat plan reviews have added detailed blockers for token provisioning, artifact access, source identity, placeholder honesty, throttling, logging, and route parity.
  - Could be false if: a future implementer follows only `docs/codex/PR-010-PERSISTENT-CONTROL-API.md`, because repository-local `AGENTS.md` identifies dedicated story contracts as the acceptance source.
  - Breakage if false: PR-010 could be implemented and reviewed as compliant while missing constraints that only appear in the temporary plan, especially around deployed verification, token handling, and placeholder evidence.
  - Plan change: make story-contract reconciliation a step-1 blocker. Any plan-only acceptance requirement must be promoted into the PR-010 story contract or explicitly rejected before implementation code changes begin.

- Assumption: A secure dev API token can be provisioned for both CI smoke and Codex direct verification.
  - Evidence: PR-010 contract requires server-side dev API token protection.
  - Could be false if: no secret/parameter is created, CI cannot read it, Codex cannot use it after merge, or evidence handling would expose it.
  - Breakage if false: persistent product API either remains unauthenticated or cannot be directly verified.
  - Plan change: step 1 blocks implementation until token storage, provisioning/reference prerequisites, CI access, Codex access, and redaction are defined and testable.

- Assumption: The token secret can be read reliably and safely at runtime.
  - Evidence: Secrets Manager or SSM SecureString is the preferred storage direction.
  - Could be false if: Lambda lacks `kms:Decrypt` or secret read permissions, secret lookup adds avoidable latency or throttling, secret rotation leaves CI and runtime out of sync, or caching keeps accepting an old token unexpectedly.
  - Breakage if false: valid validation traffic is denied, invalid old credentials remain accepted, or the API turns secret-store failures into 5xx noise.
  - Plan change: define token lifecycle, cache/refresh behavior, KMS permissions, fail-closed semantics, and rotation evidence before implementation.

- Assumption: API Gateway will let the selected dev-token request reach Lambda.
  - Evidence: the PR-010 story says real routes require a dev API token header or equivalent.
  - Could be false if: the current `HttpIamAuthorizer` remains enabled and rejects unsigned requests before Lambda token validation.
  - Breakage if false: CI smoke and Codex direct verification fail with API Gateway 401/403 even though Lambda auth code is correct.
  - Plan change: explicitly decide API Gateway auth versus Lambda-layer token auth, update CDK/tests, and verify the deployed path with the same access mechanism Codex will use.

- Assumption: PR-010 token protection can coexist with PR-010A browser access.
  - Evidence: PR-010A requires CloudFront origin proof and forbids browser-exposed API tokens.
  - Could be false if: PR-010 hardwires token-only access without an origin-proof extension point, or if the origin-proof design trusts a public header that direct API Gateway callers can forge.
  - Breakage if false: PR-010A would need to weaken API auth, leak secrets to the browser, or expose product routes to forged origin-proof headers.
  - Plan change: PR-010 must design a direct-token path and a future CloudFront origin-proof path up front, with explicit anti-forgery requirements for any origin-proof header/mechanism.

- Assumption: API Gateway method handling and future browser preflight behavior are harmless details.
  - Evidence: current internal `HttpMethod` type only includes `GET`, `POST`, and `PUT`, while PR-010A will introduce browser traffic through CloudFront.
  - Could be false if: API Gateway delivers `OPTIONS`, `HEAD`, or unsupported destructive methods to the Lambda adapter and the router crashes or returns misleading errors, or if permissive CORS exposes protected product routes.
  - Breakage if false: browser access fails in PR-010A, unsupported methods bypass intended route guards, or CORS weakens the access model.
  - Plan change: PR-010 adapter tests must cover all delivered methods and any CORS/preflight behavior must be explicit, narrow, and compatible with PR-010A.

- Assumption: A bearer dev token is enough to keep request volume and brute-force attempts bounded.
  - Evidence: PR-010 is a dev-only protected API, not a production auth story.
  - Could be false if: the endpoint is publicly reachable and attackers or buggy clients hammer protected routes, presign routes, or artifact access attempts.
  - Breakage if false: unnecessary AWS cost, noisy logs, throttled legitimate validation, and possible brute-force pressure on the token check.
  - Plan change: configure explicit dev API throttling/rate limits and verify that denied traffic does not read/write product data.

- Assumption: Lambda packaging for the real Control API is straightforward.
  - Evidence: workspace packages already exist and `pnpm-lock.yaml` contains bundling-related dependencies transitively.
  - Could be false if: CDK lacks a NodejsFunction/esbuild setup, workspace package exports point at TypeScript sources, dependencies are not bundled, or Lambda Node.js cannot import the emitted modules.
  - Breakage if false: deployed Lambda returns import/runtime errors even though typecheck and synth pass.
  - Plan change: add explicit bundling/importability checks and CDK assertions for the real Lambda artifact.

- Assumption: Lambda runtime sizing and timeout are incidental.
  - Evidence: current placeholder Lambda uses small memory and a ten-second timeout.
  - Could be false if: secret lookup, S3 `HeadObject`, presign generation, DynamoDB transactions, or cold starts exceed current settings, or if a too-long timeout hides partial failures and makes verification slow.
  - Breakage if false: deployed validation flakes, API Gateway times out, client retries duplicate attempts, or costs grow unnecessarily.
  - Plan change: choose explicit timeout/memory/concurrency settings and test timeout/retry/idempotency behavior.

- Assumption: API Gateway event adaptation is a small wrapper around existing router tests.
  - Evidence: `apps/control-api` currently exposes an internal `dispatch` API, not a deployed Lambda handler.
  - Could be false if: headers, multi-value query strings, body encoding, JSON parse failures, path normalization, or CORS-like behavior are mishandled.
  - Breakage if false: deployed routes fail or authorize incorrectly while in-memory tests pass.
  - Plan change: add adapter-level contract tests with representative API Gateway events and malformed requests.

- Assumption: The existing shared API error model is expressive enough for PR-010.
  - Evidence: current API errors cover validation, not found, some conflicts, not implemented, agent invocation, and internal errors.
  - Could be false if: auth failures, forbidden cross-workspace access, idempotency conflicts, payload-too-large, unsupported methods, artifact access denial, and secret/config failures are forced into `VALIDATION_ERROR` or `INTERNAL_ERROR`.
  - Breakage if false: clients and CI cannot distinguish expected product conflicts from security failures or runtime defects, and deployed verification can pass on the wrong failure mode.
  - Plan change: extend shared error codes and status mapping before implementing protected persistent routes.

- Assumption: Small dev data volume makes unbounded list routes acceptable.
  - Evidence: current repositories expose list methods that return arrays, and DynamoDB helpers can query all pages.
  - Could be false if: validation retries, future slices, or stale dev data accumulate enough records to cause slow responses, high memory use, timeout, or expensive scans/queries.
  - Breakage if false: list/read routes become unreliable and CI smoke/direct verification can fail from data volume rather than product behavior.
  - Plan change: define pagination, stable ordering, limits, and next-token or explicit small-dev caps for every collection route before implementation.

- Assumption: Freshly written records are immediately visible through all required reads.
  - Evidence: primary-key `GetItem` can be strongly consistent, but many list routes use DynamoDB GSIs.
  - Could be false if: GSI eventual consistency delays list-by-workspace, list-by-document, list-by-job, list-by-status, or comparison reads immediately after writes.
  - Breakage if false: deployed verification flakes or, worse, implementation adds unsafe duplicate writes because a list route did not see the first write yet.
  - Plan change: prove writes with primary-key reads where possible, use conditional/idempotency keys instead of list-before-write, and use bounded polling/retry for GSI-backed deployed verification.

- Assumption: The infrastructure route surface matches the product API route surface.
  - Evidence: current route definitions cover many Control API routes.
  - Could be false if: app router adds artifact private-read or health routes but CDK route definitions and tests are not updated.
  - Breakage if false: local tests pass through `dispatch`, but deployed API returns route-not-found for required product behavior.
  - Plan change: route-surface tests must compare app route definitions, CDK route definitions, API reference, and deployed verification expectations.

- Assumption: CI smoke can validate the persistent API safely.
  - Evidence: PR-009 already has a smoke script, but it checks unauthenticated 501 placeholder behavior.
  - Could be false if: smoke remains placeholder-coupled, mutates product data on every deploy, or requires secrets that CI cannot access.
  - Breakage if false: deploy artifacts misrepresent persistent API readiness, or CI pollutes product tables.
  - Plan change: PR-010 smoke must be protected and non-mutating, preferably `GET /api/price-books/current`.

- Assumption: Source PDF immutability can be proven from existing `Document`/`Artifact` fields.
  - Evidence: schemas currently store bucket/key and optional checksum.
  - Could be false if: S3 key is overwritten, version ID is not persisted, ETag/checksum semantics vary, S3 metadata or client JSON checksum is spoofed, uploaded bytes are not a plausible PDF, or presigned reads fetch latest object by key.
  - Breakage if false: an accepted source artifact could silently point to different bytes later.
  - Plan change: persist object identity evidence, verify bounded PDF plausibility and server-observed or S3-validated checksum evidence, and use registered object identity for private reads where needed.

- Assumption: Presigned upload staging is not a product/evidence concern.
  - Evidence: product records are created only on document registration.
  - Could be false if: abandoned uploads accumulate cost, share the same prefix as registered artifacts, or a lifecycle policy deletes registered evidence by mistake.
  - Breakage if false: storage cost grows silently or cleanup hides source evidence that economics/review later depends on.
  - Plan change: define staging versus registered artifact prefixes and lifecycle rules, and keep any cleanup isolated to unregistered staging objects only.

- Assumption: Presigned upload constraints can be bolted on after registration validation.
  - Evidence: registration checks already reject invalid objects before product records are created.
  - Could be false if: presigned PUTs allow very large uploads, wrong metadata, or long-lived write access before registration ever runs.
  - Breakage if false: storage cost and object clutter occur even though product records remain clean.
  - Plan change: choose the most constrained upload mechanism practical, including key/content-type/metadata/size/expiry conditions where supported, then keep registration validation as defense in depth.

- Assumption: Existing DynamoDB table design can support idempotency and multi-record consistency.
  - Evidence: separate tables exist and DynamoDB supports transactional writes across tables.
  - Could be false if: repository interfaces do not expose conditional/transaction writes, idempotency records have no durable home, transaction limits are hit, or indexes do not support conflict checks.
  - Breakage if false: client retries or partial failures create duplicate or contradictory product/economics records.
  - Plan change: add a small persistence service or repository extension for idempotency and transaction boundaries before route implementation is accepted.

- Assumption: Active PriceBook seeding is easy and harmless.
  - Evidence: current config has `ACTIVE_PRICE_BOOK_VERSION` context and an `AppSettings` table.
  - Could be false if: no seed path writes the record, multiple active records exist, Lambda cold starts race, or seeding mutates referenced versions.
  - Breakage if false: job creation fails after deploy or historical jobs get repriced.
  - Plan change: require idempotent seed/bootstrap verification and append-only activation semantics.

- Assumption: Existing dev data will not break new stricter schemas.
  - Evidence: PR-009 placeholder should not have created product records, but dev tables may contain manual/test remnants.
  - Could be false if: old records lack new object identity fields, use different workspace IDs, or have incomplete record groups.
  - Breakage if false: list/read routes throw, or validation accidentally uses stale data.
  - Plan change: add compatibility/migration/exclusion strategy and validation must use fresh IDs plus `validationRunId`.

- Assumption: Placeholder inspection can honestly mark the controlled fixture `READY`.
  - Evidence: PR-010 explicitly allows placeholder inspection state contract.
  - Could be false if: implementation infers readiness for arbitrary PDFs, labels the result as real analysis, or cannot distinguish the controlled fixture.
  - Breakage if false: product appears to support arbitrary PDF inspection before PR-013.
  - Plan change: inspection must be fixture-aware or explicitly limited and labeled; tests must reject unsupported/unknown cases.

- Assumption: Run placeholders will not be confused with workflow execution.
  - Evidence: PR-010 non-goals forbid AgentCore and real PDF workflow.
  - Could be false if: status transitions, responses, timelines, evaluations, artifacts, ledger rows, or UI-facing fields look like queued/running/completed translation execution, or if job status moves to `RUNNING` without execution.
  - Breakage if false: later acceptance evidence may treat PR-010 placeholders as real V1 work.
  - Plan change: define exact placeholder state semantics up front; run placeholder honesty tests and deployed verification must confirm no AgentCore invocation, no workflow-looking stage/evaluation/output evidence, and no completed-output implication.

- Assumption: Token handling is simple enough to implement safely.
  - Evidence: dev-token auth is intentionally lightweight compared with enterprise auth.
  - Could be false if: header casing/duplication, timing leaks, whitespace normalization, secret rotation, or secret lookup errors are mishandled.
  - Breakage if false: unauthorized access, accidental denial of valid CI/Codex traffic, or token leakage in evidence.
  - Plan change: add token parsing, timing-safe comparison, fail-closed secret retrieval, and redaction tests.

- Assumption: Review validation can be safely tested before reviewable runs exist.
  - Evidence: PR-010 only needs conflict behavior for non-`AWAITING_REVIEW` runs and request validation for future reviews.
  - Could be false if: shared request schemas still allow zero reviewer seconds, endpoint implementation accidentally permits review on placeholders, value models or price books allow zero human-review hourly rates, or the handler writes free human-review ledger rows.
  - Breakage if false: economics source of truth is polluted and human review can appear free.
  - Plan change: require schema and handler validation for positive reviewer seconds, positive human-review hourly rates, no review writes for non-reviewable runs, and explicit tests proving zero/missing review time or zero review rates cannot create a free product/economics event.

- Assumption: PR-010 can accept every workflow variant because execution is still deferred.
  - Evidence: shared schemas already include V1, V2, and V3 variants.
  - Could be false if: persisted V2/V3 jobs create product-visible comparison behavior before V1 works or before V2/V3 implementation stories add real workflow behavior.
  - Breakage if false: later slices inherit premature V2/V3 records and acceptance evidence can imply unsupported variants exist.
  - Plan change: PR-010 persistent job creation accepts only `V1_TEXT_ONLY`; V2/V3 requests return deterministic deferred/unsupported responses and create no records.

- Assumption: Placeholder inspection can safely mark any digitally generated Spanish PDF `READY`.
  - Evidence: MVP eventually supports controlled Spanish PDFs, but PR-010 has no real extraction or inspection.
  - Could be false if: arbitrary user PDFs become `READY` based only on upload metadata and can start jobs before PR-013 implements real inspection.
  - Breakage if false: PR-010 becomes a generic PDF intake/product promise rather than a controlled fixture-backed persistent API.
  - Plan change: placeholder `READY` is restricted to the repository-controlled MVP fixture or a documented checksum/object-identity allowlist; unknown PDFs become `UNSUPPORTED` or `FAILED_INSPECTION`.

- Assumption: Existing USD schemas are sufficient for business value assumptions.
  - Evidence: shared schemas currently use finite nonnegative numbers for USD amounts.
  - Could be false if: API clients submit zero review hourly rate, extremely large values, excessive precision, or values that are valid JSON numbers but unusable for honest economics and UI display.
  - Breakage if false: persisted jobs and price books produce misleading margins, free human review, or unstable displays even though ledger rollups are technically derived from rows.
  - Plan change: PR-010 defines bounded USD precision/caps for `valueModel` and price-book fields and requires positive human-review hourly rates.

- Assumption: Deploy artifact evolution will not break future slices.
  - Evidence: PR-009 artifact is versioned for placeholder deployment.
  - Could be false if: PR-010 mutates artifact shape without versioning or leaves placeholder fields as the only source of truth.
  - Breakage if false: PR-010A/PR-011 cannot reliably identify endpoints, access mode, or deployed build.
  - Plan change: PR-010 must version persistent API deploy artifact fields and keep enough provenance for future slices.

- Assumption: Telemetry can be queried or safely marked blocked.
  - Evidence: current plan allows recording a blocker.
  - Could be false if: implementation claims telemetry from logs that cannot isolate `validationRunId`, logs are not retained long enough, API Gateway/Lambda log groups are not discoverable from the deploy artifact, or logs leak secrets.
  - Breakage if false: completion evidence is overstated, unreproducible, or unsafe.
  - Plan change: telemetry verification must use stable selectors, structured logs, known log group/query targets, and missing queryability remains an explicit blocker, not a pass.

- Assumption: Replacing the placeholder Lambda/API with real infrastructure will not disturb retained data resources.
  - Evidence: current storage/database stacks use retained, named resources, but PR-010 will substantially change the Control API stack.
  - Could be false if: logical IDs, table definitions, bucket names, retention controls, or stack dependencies change accidentally during the real API deployment.
  - Breakage if false: existing dev evidence or future economics/artifact data can be lost, orphaned, or inaccessible; deploy verification may target stale outputs.
  - Plan change: require CDK diff/template checks for no replacement/delete of data-bearing resources, keep data-resource protection validation, and record new API outputs in the deploy artifact after any acceptable API replacement.

- Assumption: Direct verification can be performed without leaking sensitive values.
  - Evidence: plan already forbids full presigned URLs, tokens, cookies, and raw bytes in durable evidence.
  - Could be false if: shell traces, CI summaries, browser/network captures, or `PLAN.md` accidentally include signed URLs or headers.
  - Breakage if false: validation artifacts expose private data or reusable access.
  - Plan change: verification tooling and notes must redact by default; only sanitized IDs/status/expiry/request metadata are recorded.

- Assumption: Failure recovery can happen without deleting evidence.
  - Evidence: repo instructions forbid manual AWS edits/deletes and require preserving economics/audit records.
  - Could be false if: failed validation creates messy records and the easiest path appears to be manual cleanup.
  - Breakage if false: failed/rejected cost and artifact lineage can disappear.
  - Plan change: failed validation data is retained and labeled; recovery uses new PR/CI or additive records.

- Assumption: Partial-write safety must be proven in deployed verification.
  - Evidence: the plan and story both require multi-record writes to avoid successful visible outcomes built from partial records.
  - Could be false if: proving partial writes in the deployed product requires an API-selectable fault trigger, debug route, environment flag, or other runtime behavior that users or callers can reach.
  - Breakage if false: PR-010 could accidentally add a hidden fault-injection or test mode, violating the product's mode prohibitions and expanding the deployed attack surface.
  - Plan change: prove partial-write failure behavior with deterministic tests and non-product test doubles or harnesses only. Deployed verification may confirm ordinary invalid/conflicting requests leave no successful records, but it must not require or introduce deployed fault injection.

- Assumption: The PR remains one implementation slice despite being large.
  - Evidence: user explicitly accepted PR-010 being large/dense.
  - Could be false if: token auth, bundling, persistence, idempotency, CI smoke, and fixture generation interact in ways that block review or deployment.
  - Breakage if false: PR becomes unreviewable or fails late after many unrelated changes.
  - Plan change: implementation steps remain separately verifiable; if a prerequisite blocks, stop and report rather than broadening scope.

## Expected outcomes

- Anonymous or invalid-token requests to real product routes are rejected before reading or writing product data.
- The deployed access mechanism is coherent end to end: API Gateway allows the intended protected request path, Lambda or the chosen authorizer enforces the dev token/origin proof, and CI/Codex can use that path without AWS console/manual deployment steps.
- Protected API request volume is bounded by documented dev throttling/rate limits, and those limits do not block the normal CI smoke or direct deployed-verification path.
- Authorized requests use a server-resolved dev workspace and cannot override workspace with body/query/request fields.
- Post-merge CI deployment smoke tests a protected persistent API route using the configured dev access path, and the deploy artifact no longer describes the API as an unauthenticated placeholder.
- `GET /api/price-books/current` returns the configured active dev `PriceBook`.
- Collection routes return bounded, consistently ordered result sets with pagination or documented small-dev caps. Deployed verification accounts for any GSI-backed eventual consistency instead of treating transient list lag as proof of missing persistence.
- If active price-book mutation is enabled, it is append-only and cannot mutate a version already referenced by jobs, runs, ledger items, or reviews.
- `POST /api/documents/presign` returns a short-lived presigned upload URL, source S3 key, expected metadata contract, and any generated IDs needed for registration. Durable evidence records only sanitized key/expiry/status/request metadata, not the full signed URL.
- Uploading the controlled MVP Spanish PDF fixture through the presigned URL succeeds without exposing raw PDF bytes through API JSON.
- Oversized, wrong-type, wrong-prefix, wrong-checksum, missing, or non-PDF-looking uploaded objects are rejected before creating product records.
- Unregistered presigned uploads do not appear as product artifacts or economics evidence, and any lifecycle handling for them cannot affect registered artifact evidence.
- `POST /api/documents` creates a persistent `Document` plus canonical `SOURCE_PDF` `Artifact` only after verifying the S3 object and recording immutable object identity evidence.
- Repeating identical document creation returns the same stable result or equivalent stable response; conflicting repeats fail without duplicate `Document` or `Artifact` rows.
- `POST /api/documents/{documentId}/jobs` before inspection is rejected and creates no `TranslationJob`.
- `POST /api/documents/{documentId}/inspect` moves the controlled document through the documented placeholder state contract to `READY` without claiming real PDF analysis.
- Placeholder inspection rejects or marks unsupported arbitrary PDFs that are not the repository-controlled fixture or a documented controlled-fixture checksum/object-identity allowlist.
- Repeating inspection does not create contradictory document state or duplicate terminal inspection evidence.
- `POST /api/documents/{documentId}/jobs` after `READY` creates a persistent `TranslationJob` with `TranslationJob` as the business unit, active `PriceBook` version snapshot, and submitted value model snapshot.
- PR-010 job creation accepts only `V1_TEXT_ONLY`; V2/V3 requests return deterministic deferred/unsupported errors and create no persistent job/run/economics records.
- Job value model inputs and active price-book money fields obey documented finite USD bounds and precision; human-review hourly rates are positive.
- Repeating identical job creation does not create duplicate jobs for the same user intent; conflicting repeats fail without duplicate business records.
- `POST /api/jobs/{jobId}/runs` creates a persistent run placeholder and updates job attempt state without invoking AgentCore.
- Run placeholder responses and records are labeled or shaped so they cannot be mistaken for completed translation workflow execution, translated output, or accepted business outcome.
- PR-010 placeholder runs do not create workflow-looking stage events, translated artifacts, evaluations, or model/tool ledger rows. Empty timeline/evaluation/ledger reads are allowed only when they are honestly represented as not-yet-executed placeholder state.
- Repeating identical run creation does not duplicate runs.
- Read routes return persisted documents, jobs, runs, timelines, artifacts, ledgers, evaluations, comparisons, and economics scoped to the server workspace.
- `GET /api/jobs/{jobId}/economics` derives values only from persisted `LedgerItem` rows. An unaccepted job has no verified outcome and no unit margin.
- Artifact private-read access is by authorized `artifactId`, not arbitrary S3 key, and returns only short-lived private access.
- `POST /api/runs/{runId}/review` for a non-`AWAITING_REVIEW` run returns conflict and creates no review decision, no human-review ledger item, and no free human review path.
- Unsupported destructive routes remain unavailable and existing validation records remain readable after rejected destructive attempts.
- Persistent records survive fresh reads by ID after deployment.
- Durable evidence in logs, telemetry, deploy artifacts, CI summaries, and `PLAN.md` remains sanitized.
- Structured logs and deploy artifacts include enough sanitized identifiers to find validation evidence without guessing log group names or relying on screenshots.

Forbidden outcomes:

- No product-facing fake data to make the app look complete.
- No API route that treats `Run` as the business unit.
- No cost calculation from logs or telemetry instead of `LedgerItem` rows.
- No hard-coded prices or model IDs in business logic.
- No public artifact access.
- No raw PDFs in DynamoDB or ordinary JSON payloads.
- No acceptance of automated evaluation as business acceptance.
- No human review that can appear free through zero/missing reviewer seconds.
- No human review that can appear free through zero human-review hourly rates in the job value model or active price book.
- No PR-010-created V2/V3 product records before their dedicated implementation slices.
- No arbitrary uploaded PDF marked `READY` by placeholder inspection.
- No placeholder-created `StageEvent`, `EvaluationResult`, translated artifact, or ledger row that makes PR-010 look like workflow execution occurred.
- No duplicate business/economics records from client retries.
- No apparently successful read assembled from partial record groups.
- No unbounded collection route that can time out or exhaust memory as dev data accumulates.
- No unbounded public request volume against protected API routes, presign routes, or artifact-access routes.
- No broad CORS/preflight behavior, public origin-proof marker, or unsupported-method behavior that weakens protected product access.
- No CloudFormation replacement, deletion, or name drift for retained data-bearing tables or the artifact bucket.

## Product design

PR-010 is an API-first product slice. A reviewer or validation client can use the deployed API to register a controlled Spanish source PDF, inspect it into a `READY` placeholder state, create a V1 job, create a technical run placeholder, inspect durable records, and see honest economics with no verified outcome yet. The slice makes the product real enough to persist document/job/run/economics state, but it must still be clear that no translation workflow has run.

The ideal API experience is strict and boring: protected by a dev token, stable under retries, scoped to one server-resolved workspace, deterministic in errors, and explicit about placeholder behavior. Artifact bytes remain private in S3. API responses carry artifact IDs, S3 keys, metadata, and short-lived access URLs only when authorized.

The access model must also set up the next slice cleanly. PR-010 direct API verification may use the dev token, but PR-010A browser traffic must be able to pass through CloudFront with origin proof and without exposing that token in static assets or browser-visible configuration.

Scenarios:

1. Authorized source registration.
   - Given an authorized dev validation client and a repository-controlled MVP Spanish PDF fixture.
   - When the client requests upload access, uploads the file, and registers the document.
   - Then the API verifies the S3 object and persists one `Document` plus one canonical `SOURCE_PDF` `Artifact`.

2. Idempotent retry.
   - Given the same authorized request identity and same payload.
   - When the client repeats document/job/run/inspection requests.
   - Then the API returns the existing stable outcome or equivalent stable response and does not create duplicates.

3. Placeholder readiness.
   - Given an uploaded document.
   - When the client tries to create a job before inspection.
   - Then the API rejects it.
   - When the client runs placeholder inspection for the controlled fixture.
   - Then the document reaches `READY` with honest placeholder labeling and can create a job.

4. Run placeholder.
   - Given a ready document and job.
   - When the client starts a run.
   - Then the API creates a `Run` technical attempt without invoking AgentCore and exposes it through read routes.

5. Economics truth.
   - Given a created job/run placeholder with no accepted review.
   - When the client reads job economics.
   - Then economics are rolled up from ledger rows only, and no verified outcome or unit margin is shown.

6. Review contract guard.
   - Given a run that is not `AWAITING_REVIEW`.
   - When the client posts accept/reject/escalate review input.
   - Then the API rejects the decision and does not create `ReviewDecision` or `HUMAN_REVIEW` ledger evidence.

## Deterministic checks

Required commands:

```text
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm lint
pnpm cdk synth
```

Behavior checks to add or update:

- API contract tests for every implemented route, including success, validation errors, product-state conflicts, and unsupported methods.
- API Gateway/Lambda adapter tests proving method/path/query/header/body parsing, malformed JSON handling, base64/body edge cases, request ID propagation, response serialization, and auth rejection work against deployed-event-shaped inputs.
- HTTP method and preflight tests proving `OPTIONS`, `HEAD`, unsupported methods, and representative destructive methods produce deterministic responses and do not create broad unauthenticated product access.
- API error schema tests proving auth failures, conflicts, idempotency conflicts, artifact access failures, and not-yet-implemented/deferred routes use deterministic response shapes and status codes.
- API error schema tests must include explicit coverage for auth required/invalid, forbidden or cross-workspace access, idempotency conflict, payload-too-large, unsupported method, artifact access denied/not found, deferred route, and internal/config failures.
- Value-model and money validation tests proving job value inputs and price-book monetary fields reject negative, non-finite, excessive-precision, out-of-cap, and zero human-review hourly rate values; `humanReviewHourlyRateUsd` and active `humanReviewHourlyRateDefaultUsd` must be positive.
- Workflow-variant scope tests proving PR-010 accepts `V1_TEXT_ONLY` job creation and returns deterministic deferred/unsupported errors for V2/V3 without creating `TranslationJob`, `Run`, comparison, artifact, ledger, or evaluation records.
- Access-protection tests proving protected product routes reject missing/invalid tokens and accept the configured token without logging or persisting it.
- Secret lifecycle tests proving CI smoke, runtime Lambda, and Codex direct verification can use the same current token source without exposing the value, and proving missing secret, KMS denial, stale cached token, and rotated token paths fail closed or refresh as designed.
- Secret provisioning/preflight tests proving the expected secret/parameter identifier is present before deployment or is created through IaC/CI, and that missing configuration fails before exposing unauthenticated product routes.
- API Gateway authorization tests proving the selected dev access mechanism is not blocked by a stale IAM authorizer and rejects unauthenticated product access at the intended layer.
- Future-origin-proof compatibility tests proving any reserved CloudFront-origin proof cannot be satisfied by a public, easily forged header on direct API Gateway requests.
- Secret hygiene tests proving synthesized templates, Lambda environment variables, deploy artifacts, logs, and snapshots contain only secret identifiers or redacted values, never the token value.
- Token parser tests proving missing, duplicated, malformed, wrong-case, whitespace-padded, and invalid tokens fail closed, while the configured token succeeds through a timing-safe comparison path.
- Route-surface parity tests proving app router routes, CDK `routeDefinitions`, API route reference, and deploy smoke/verification expectations all include required PR-010 routes, including artifact private-read access.
- CI workflow/smoke/deploy-artifact tests proving PR-010 no longer depends on `CDK_ALLOW_UNAUTHENTICATED_PLACEHOLDER_API=true`, `DEV_UNAUTHENTICATED_PLACEHOLDER`, or a placeholder 501 response after merge.
- Lambda bundle/importability test or equivalent build check proving the deployed handler artifact includes workspace packages and AWS SDK dependencies and can be imported by the configured Lambda Node.js runtime.
- Lambda runtime configuration tests proving timeout, memory, concurrency/throttle choices, environment variables, and secret/log settings match the PR-010 runtime contract.
- API throttling tests or CDK assertions proving dev rate/burst limits are configured and that throttled/denied requests do not read or write product data.
- Structured logging tests proving successful and failed requests emit sanitized route/status/request ID/build/stage/workspace/validation selector/duration/error-code fields and omit bodies, auth headers, cookies, full signed URLs, raw PDF bytes, and full document text.
- Workspace/environment scoping tests proving clients cannot override `workspaceId` and wrong-workspace records are excluded or rejected for reads, writes, comparisons, and artifact access.
- Response-schema tests proving implemented route responses validate against shared schemas.
- Collection route tests proving stable ordering, limit handling, pagination/next-token behavior or explicit small-dev caps, no unbounded scan/query contract, and correct workspace scoping across pages.
- Document presign and registration tests proving generated S3 keys follow repository conventions and arbitrary client-chosen keys are rejected.
- DynamoDB consistency tests proving mutating routes do not rely on eventually consistent GSI list-before-write checks for uniqueness/idempotency, and deployed-verification tooling uses primary-key reads or bounded polling where GSI lag is possible.
- Request/upload limit tests proving oversized JSON bodies, oversized object metadata, expired presign attempts, unsupported content types, and objects outside configured MVP limits fail deterministically.
- Presigned upload constraint tests proving the upload URL or form constrains key, expiry, content type, metadata, and size as far as the selected S3 presign mechanism supports.
- S3 object verification tests proving registration rejects missing objects, wrong content type, wrong workspace/document prefix, wrong or missing required checksum/size metadata, non-PDF-looking bounded signature bytes where practical, and persists object identity evidence such as S3 version ID/ETag/checksum. Tests must prove checksum evidence is server-observed or S3-validated, not merely copied from request JSON.
- Source immutability tests proving a persisted document's canonical source artifact cannot be overwritten, repointed, re-registered with different object identity or metadata, or served from a later overwritten object at the same key.
- Unregistered upload tests proving abandoned presigned uploads are not visible as product artifacts, cannot satisfy document/job validation, and any staging lifecycle rule cannot delete registered artifact/economics evidence.
- Placeholder inspection state tests for valid `UPLOADED -> INSPECTING -> READY`, `UNSUPPORTED`, and `FAILED_INSPECTION` paths plus invalid transition rejection.
- Controlled-fixture inspection tests proving placeholder `READY` is limited to the repository-controlled MVP fixture or documented checksum/object-identity allowlist, and unknown PDFs become `UNSUPPORTED` or `FAILED_INSPECTION`.
- Job and run gate tests proving non-`READY` documents cannot create jobs or run placeholders.
- Run placeholder tests proving no AgentCore runtime invocation occurs in PR-010.
- Run placeholder honesty tests proving records and responses cannot be confused with translated output, real V1 execution, or accepted business outcome.
- Placeholder evidence tests proving PR-010 run placeholders do not create workflow-looking `StageEvent`, `EvaluationResult`, translated artifact, `MODEL_INFERENCE`, tool, or completed-output ledger evidence.
- Run/job state tests proving placeholder creation uses the explicitly selected non-executing state semantics and does not move jobs/runs to `RUNNING` without execution.
- Review contract tests proving non-`AWAITING_REVIEW` review requests return conflict, require positive reviewer seconds for future-valid payloads, and write no `ReviewDecision` or `HUMAN_REVIEW` ledger item.
- PriceBook tests proving configured records drive cost assumptions, active version changes are append-only or explicitly deferred, and active human-review default hourly rate is positive.
- PriceBook seed/bootstrap tests proving first-run deployment creates or selects exactly one active dev `PriceBook` idempotently and does not mutate referenced versions.
- Job snapshot tests proving job creation records the active `priceBookVersion` and submitted value model.
- Ledger economics tests proving job economics derive from `LedgerItem` rows, not logs, current price book, or runtime telemetry.
- Idempotency tests for document creation, job creation, run placeholder creation, inspection, and review validation.
- Partial-failure consistency tests for document plus source artifact, job creation, run placeholder plus job update, price-book activation if enabled, and review validation.
- Test-only fault-injection checks for partial persistence must stay out of product-facing runtime behavior; do not add a user- or API-selectable fault mode just to satisfy testing.
- Artifact private-access tests proving access is artifact-ID-based, workspace-scoped, short-lived, and rejects missing/cross-workspace/arbitrary S3-key requests.
- Evidence-redaction tests proving logs/summaries/examples do not include auth headers, cookies, full presigned URLs, signed query strings, raw PDF bytes, or full document text.
- Fixture/generator test proving the controlled MVP Spanish PDF verification input is repository-controlled and reproducible.
- Route-surface tests proving `DELETE`, purge, cleanup, archive, and TTL-like destructive behavior is unavailable.
- CDK tests proving the real Control API Lambda has only required permissions, private S3/DynamoDB access, dev token configuration, and no unauthenticated product-data route.
- CDK/IAM tests proving the Control API Lambda has no AgentCore Runtime, Bedrock, Gateway, or broad `lambda:InvokeFunction` permissions in PR-010.
- CDK replacement-safety tests or diff checks proving PR-010 does not replace, delete, or rename retained DynamoDB tables or the artifact bucket, and preserves table PITR plus bucket versioning/public-access blocks.
- Deploy artifact tests proving API URL, Lambda name, log group/query targets, throttling/access mode, table names, and artifact bucket outputs are captured for the merged SHA.
- Existing-record compatibility tests proving list/read routes handle or exclude pre-PR-010 dev records without crashing or satisfying validation with stale/incomplete data.
- CI/deploy artifact checks from PR-009 remain green and continue to prove post-merge deployment provenance.

## Deployed verification

After implementation is merged to `main`, wait for the normal post-merge CI deployment and use the PR-009 deploy artifact for the merged SHA. Do not manually deploy or manually trigger deployment.

Codex must directly exercise the deployed API and record sanitized evidence:

1. Confirm deploy artifact SHA, run URL, AWS account, region, stage, `ControlApiUrl`, table names, artifact bucket, and access mode match the endpoint used.
2. Generate a `validationRunId` for the deployed validation run.
3. Confirm the CI smoke result for the merged SHA exercised the protected persistent API access mode, not the old unauthenticated placeholder mode.
4. Confirm API Gateway does not reject the intended dev-token request before it reaches the selected auth layer, and that unauthenticated requests fail at the documented layer.
5. Call a protected product route anonymously and with an invalid token; confirm both are denied before product data is read or written.
6. Call protected routes with the configured dev token without recording the token value.
7. Confirm deploy artifact and CloudFormation outputs include the current API URL, Lambda name, log group/query targets, throttling/access mode, table names, and artifact bucket, and that retained data resources were not replaced or renamed.
8. Read `GET /api/price-books/current`.
9. Confirm the API response headers/log evidence identify the deployed stage/workspace/build SHA or equivalent deploy identity for the merged SHA without exposing secrets.
10. Confirm list routes expose the documented limit/pagination contract and that fresh validation records are proven by primary-key reads or bounded polling where GSI-backed lists can lag.
11. If `PUT /api/price-books/current` is enabled, verify append-only activation and historical job price snapshot behavior. If not enabled, verify its honest protected/deferred response.
12. Request document upload access with `POST /api/documents/presign` and confirm the selected S3 presign mechanism constrains key, expiry, content type, metadata, and size as documented.
13. Attempt representative bad registration inputs or uploads, such as wrong content type or wrong checksum/size metadata, and confirm no product records are created.
14. Upload the repository-controlled MVP Spanish PDF fixture through the presigned URL, recording only sanitized artifact key, expiry window, status, and request metadata.
15. Register the document with `POST /api/documents` and confirm the persisted `Document` plus `SOURCE_PDF` artifact metadata, including checksum/hash and immutable object identity evidence.
16. Repeat document registration with the same idempotency identity and confirm no duplicate rows.
17. Attempt conflicting source registration and confirm the original document/source artifact remain unchanged.
18. Attempt job creation before inspection and confirm rejection with no job write.
19. Run placeholder inspection and confirm the document reaches `READY` with honest placeholder basis/warning.
20. Confirm a non-allowlisted or unknown PDF object cannot be marked `READY` by placeholder inspection and cannot start a job.
21. Repeat inspection and confirm no duplicate terminal state or contradictory evidence.
22. Attempt V2/V3 job creation and confirm deterministic deferred/unsupported responses with no job/run/economics records.
23. Attempt job creation with invalid value models, including zero human-review hourly rate and out-of-bounds money values, and confirm rejection with no job write.
24. Create a V1 job after `READY` and confirm `TranslationJob` is the business unit with price-book/value-model snapshots and positive human-review hourly rate.
25. Repeat job creation with the same idempotency identity and confirm no duplicate job.
26. Create a run placeholder and confirm no AgentCore invocation is represented or required, the selected job/run status semantics are honored, and the response cannot be mistaken for real workflow execution.
27. Repeat run creation with the same idempotency identity and confirm no duplicate run.
28. Confirm the placeholder run did not create workflow-looking stage events, translated artifacts, evaluations, `MODEL_INFERENCE` rows, tool ledger rows, or completed-output evidence.
29. Read document, document jobs, jobs list, job runs, run timeline, run artifacts, run evaluation, run ledger, job ledger, job economics, and comparison where applicable.
30. Confirm job economics are ledger-derived and show no verified outcome/unit margin for the unaccepted placeholder job.
31. Request private artifact access by `artifactId` and confirm short-lived authorized access uses the registered object identity where needed, not a later overwritten object at the same key.
32. Attempt unauthorized/cross-workspace/artifact-key-based access and confirm denial.
33. Attempt review on the non-`AWAITING_REVIEW` run and confirm conflict with no `ReviewDecision` and no `HUMAN_REVIEW` ledger row.
34. Attempt representative unsupported methods, preflight/`OPTIONS` where implemented, and destructive methods/routes; confirm they are rejected or narrowed as documented while prior records remain readable.
35. Confirm structured logs can be found through deploy artifact identifiers and contain route/status/request/build/validation evidence without leaked secrets or document contents.
36. Record partial-write/fault-injection evidence from deterministic tests only. Deployed verification may exercise ordinary invalid/conflicting requests, but it must not require or introduce deployed fault injection, debug routes, test modes, or API-selectable failure triggers.
37. Record sanitized status codes, response summaries, entity IDs, S3 bucket/key pairs, checksum/hash/size/object identity metadata, request IDs, and validation summaries in `PLAN.md`.

Completion requires deployed verification against the merged SHA. Local checks, synth, logs, screenshots, and CI success alone are not completion.

## Telemetry verification

Selectors:

- merged commit SHA
- GitHub Actions deploy run ID
- deploy artifact identity
- AWS account ID, region, and stage
- `validationRunId`
- API Gateway request IDs or Lambda request IDs where available
- validation `documentId`, `artifactId`, `jobId`, and `runId`

Required signals when telemetry is queryable:

- Control API route signal for each exercised route.
- Environment/workspace evidence showing requests hit the deployed account, stage, and server-resolved workspace.
- Build/deploy identity evidence showing responses or logs belong to the merged SHA being verified.
- Stable validation selector present in boundary telemetry and persisted records where implemented.
- Runtime signal showing Lambda duration and error behavior stayed within the chosen PR-010 dev budget for the validation run.
- DynamoDB writes for the validation `Document`, `SOURCE_PDF` `Artifact`, `TranslationJob`, and `Run` placeholder.
- CI smoke signal showing the post-merge deployment validated a protected persistent API route.
- Collection route signals showing bounded response sizes and documented pagination/limit behavior.
- No `TranslationJob` write for the pre-inspection job attempt.
- No `ReviewDecision` or `HUMAN_REVIEW` ledger write for the non-reviewable run.
- No duplicate writes for repeated idempotent validation submissions.
- No mutation of the validation document's canonical source artifact after conflicting registration attempts.
- No artifact read serving a different S3 object identity than the registered source artifact.
- Artifact private-access route signal for authorized artifact access and denied signal for unauthorized/cross-workspace access.
- No 5xx for successful validation routes.
- Sanitized telemetry without full presigned URLs, signed query strings, auth headers, cookies, raw PDF bytes, full document text, or token values.
- No secret-store/KMS/config failure hidden as a successful auth decision.
- No evidence of throttling during the normal authorized validation flow, while denied/throttled behavior remains bounded and non-mutating where tested.

Forbidden signals:

- No AgentCore Runtime invocation.
- No Bedrock call.
- No Gateway call.
- No workflow-looking `StageEvent`, `EvaluationResult`, translated artifact, completed-output artifact, or tool ledger row created by PR-010 placeholder behavior.
- No `MODEL_INFERENCE` ledger row created by PR-010 placeholder behavior.
- No delete, purge, cleanup, archive, TTL expiry, or destructive mutation for validation product/economics/artifact evidence.
- No logs or telemetry treated as the source of truth for economics.
- No broad unauthenticated CORS/preflight exposure for product routes.
- No lifecycle or cleanup signal deleting registered product/economics/artifact evidence.

If telemetry cannot be queried or isolated, record the exact blocker and do not claim telemetry verification passed.

## Implementation steps

1. Confirm PR-010 prerequisites and runtime contract.
   - Done when `PLAN.md` records PR-009 deployment evidence, resolves current instruction/story-doc diffs into the implementation branch strategy, promotes or explicitly rejects plan-only acceptance requirements in `docs/codex/PR-010-PERSISTENT-CONTROL-API.md`, and records selected API Gateway authorization strategy, dev-token lifecycle/rotation/cache/provisioning approach, Codex direct-verification access path, CI smoke access path, idempotency strategy, list pagination/consistency strategy, value-model/money bounds, V1-only variant scope, controlled-fixture inspection allowlist criteria, request/upload size limits, source-object verification/object-identity strategy, unregistered-upload handling, exact run-placeholder state semantics, existing-record compatibility strategy, price-book seed/activation decision, and PR-010A access compatibility requirements.

2. Replace the placeholder Lambda deployment with the real Control API package.
   - Done when CDK packages/bundles the Control API handler with workspace package dependencies, importability is tested against the configured Lambda runtime, required build/deploy identity environment is present, timeout/memory/throttle/logging settings are explicit, only required DynamoDB/S3/secret permissions are granted, private data resources are preserved, obsolete unauthenticated placeholder assumptions are removed, and product routes stay protected.

3. Add server-side request context, auth, and validation metadata.
   - Done when API Gateway events become `ApiRequest` objects with server-resolved workspace/stage, all delivered HTTP methods are handled deterministically, the selected authorization layer allows intended dev-token/CI/Codex traffic and rejects anonymous product traffic, protected-route token validation is fail-closed and timing-safe where applicable, secret retrieval and KMS/decrypt failure modes are tested, optional `validationRunId` propagation works, logs are sanitized, and no client workspace override remains.

4. Add schema contracts for PR-010 route requests and responses.
   - Done when document presign/register/inspect, artifact private access, S3 object identity metadata, pagination tokens/limits, idempotency, value-model/money bounds, V1-only variant scope, auth/forbidden/conflict/payload-too-large/unsupported-method errors, and any price-book activation/deferred responses are represented by shared schemas and tests.

5. Add persistence boundaries for idempotency and multi-record writes.
   - Done when document registration, job creation, run placeholder creation, inspection, price-book activation if enabled, and future review validation have conditional/transactional behavior or explicit recoverable incomplete states, and do not rely on eventually consistent list queries for uniqueness.

6. Implement dev PriceBook seeding/configuration.
   - Done when the deployed dev environment exposes exactly one active `PriceBook` record through the API, seeding is idempotent and CI/IaC-controlled, and no costing logic hard-codes prices.

7. Implement document upload, registration, and source immutability.
   - Done when presign/registration routes enforce size/expiry/content limits, verify S3 object metadata and identity, create one `Document` plus canonical `SOURCE_PDF` `Artifact`, reject arbitrary keys/conflicts/non-PDF-looking objects, isolate unregistered staging uploads, serve private reads against registered object identity where needed, and support idempotent retries.

8. Implement placeholder inspection and document-state gates.
   - Done when only controlled-fixture/allowlisted documents can move honestly to `READY`, unsupported/failed paths are represented for unknown PDFs, repeated inspections are stable, and jobs/runs are blocked until `READY`.

9. Implement persistent job, run-placeholder, economics, and read routes.
   - Done when only V1 jobs are created, V2/V3 requests are deferred without writes, jobs snapshot validated price/value configuration, run creation writes a placeholder without AgentCore invocation or misleading `RUNNING` state, read/list routes return persisted records with bounded pagination/ordering, and economics roll up only from ledger rows.

10. Implement artifact private-read access and destructive-route guards.
    - Done when authorized artifact-ID access returns short-lived private access, unauthorized/cross-workspace access fails, and representative destructive routes remain unavailable.

11. Keep route surfaces synchronized.
    - Done when app router, CDK route definitions, infrastructure tests, API reference, CI smoke tooling, and deployed verification expectations all include the same PR-010 route set.

12. Update CI smoke, deploy artifact, and workflow validation for persistent protected API behavior.
    - Done when post-merge CI no longer relies on unauthenticated placeholder access, smokes a protected persistent route, records persistent API access mode, runtime/log/query identifiers, throttling/access settings, and data-resource output names in the deploy artifact, and validates the workflow contract accordingly.

13. Add controlled MVP PDF fixture or generator for deployed validation.
    - Done when the validation input is reproducible from the repository and documented without seeding product-facing history.

14. Run deterministic checks and fix failures.
    - Done when required commands and behavior checks pass locally and in PR CI.

15. Merge through normal review and wait for post-merge deployment.
    - Done when the PR is merged to `main`, the normal CI deployment succeeds, and a deploy artifact exists for the merged SHA.

16. Perform direct deployed verification and telemetry verification.
    - Done when Codex exercises the deployed API path above, records sanitized evidence in `PLAN.md`, and records telemetry proof or a precise telemetry blocker.

17. Completion review.
    - Done when requirements, deterministic evidence, deployed evidence, telemetry status, forbidden outcomes, and residual risks are reviewed against PR-010 and all blockers are resolved or precisely reported.

## Risks and constraints

- Exposing persistent product data without token protection would turn the PR-009 placeholder exception into an auth regression.
- Leaving the current IAM authorizer in place while implementing Lambda-layer token checks would block CI/Codex traffic before it reaches the real API and make deployed verification fail for the wrong reason.
- Storing the token value in a Lambda environment variable or CloudFormation template would leak the secret through infrastructure metadata or template artifacts.
- Leaving token creation as an undocumented manual console step would make PR-010 unreproducible and could block CI smoke or Codex direct verification after merge.
- Permissive token parsing could accept malformed duplicate headers or leak token comparison timing; auth logic must fail closed.
- Token secret retrieval can fail through missing KMS permissions, throttling, stale cache, or rotation drift; these must not become open access, misleading 5xx completion evidence, or unrecoverable CI smoke failures.
- A future CloudFront origin-proof header can be forged by direct API Gateway callers unless it is backed by an unguessable secret or equivalent proof.
- Broad CORS or permissive `OPTIONS` handling could weaken the intended dev access model before PR-010A.
- Unsupported HTTP methods can bypass tests if the adapter assumes only internal `GET`/`POST`/`PUT` values.
- Collapsing auth, forbidden access, idempotency conflicts, payload-too-large, and config failures into generic validation/internal errors would make clients and CI verify the wrong behavior.
- Client-supplied workspace override currently exists and would break workspace isolation if left in place.
- Invoking AgentCore from PR-010 run creation would violate the build order and create unverified workflow behavior.
- Idempotency implemented only in tests or only by client convention would not protect retries in deployed usage.
- Relying on GSI list reads for idempotency or immediate deployed verification would create flakiness and duplicate-write risk because GSI reads are eventually consistent.
- Unbounded list routes can time out or exhaust Lambda memory as dev data accumulates.
- Multi-record writes can leave misleading records if partial failures are not transactional or recoverably staged.
- S3 presigned URLs can leak credentials-like access if full URLs or signed query strings enter logs, artifacts, screenshots, or `PLAN.md`.
- Presigned upload URLs can be used to upload oversized or non-PDF objects unless size, content, expiry, and registration checks are explicit.
- Abandoned presigned uploads can accumulate cost, but lifecycle cleanup must not touch registered artifact/economics evidence.
- Registering arbitrary S3 keys would let callers point documents at data outside the intended workspace/document context.
- Repointing a source artifact would corrupt document lineage and economics auditability.
- Mutating an existing `PriceBook` version can silently reprice historical jobs or ledger rows.
- A zero human-review hourly rate in either the job value model or active price book can make human review appear free even if reviewer seconds are positive.
- Extremely large or over-precise money inputs can make persisted economics and UI displays misleading despite passing generic finite-number validation.
- Accepting V2/V3 job creation in PR-010 would create product behavior before those dedicated workflow slices exist and could pollute comparison evidence.
- Treating logs/telemetry as economics truth would violate the product model; they are only correlation/debug evidence.
- A placeholder inspection label that sounds like real PDF analysis would overstate product capability before PR-013.
- A placeholder inspection path that marks arbitrary uploaded PDFs `READY` would make PR-010 behave like a generic PDF translator intake instead of the controlled MVP fixture path.
- A run placeholder that looks like a completed translation could be mistaken for a real V1 workflow.
- Fake placeholder timelines, evaluations, translated artifacts, or ledger rows would make PR-010 look like workflow execution happened and could pollute PR-011/PR-013 acceptance evidence.
- Moving placeholder jobs/runs to `RUNNING` without execution would pollute job state and make PR-011 sequencing ambiguous.
- Missing repository-controlled fixture would make deployed verification dependent on an ad hoc local file.
- Leaving PR-009 smoke/deploy-artifact scripts unchanged would make post-merge deployment either fail after merge or produce evidence that still describes an unauthenticated placeholder instead of the protected persistent API.
- A dev-token design that only works for command-line API calls could block PR-010A or tempt exposing the token in browser JavaScript; PR-010 must deliberately leave a CloudFront origin-proof path.
- S3 bucket/key-only artifact identity is not enough for source immutability if a key can be overwritten; the implementation must persist and use object identity evidence.
- Product-facing fault injection would become an unplanned mode; partial-failure verification must use deterministic tests or non-product test doubles/harnesses only, and deployed verification must not require runtime fault triggers.
- Over-broad Lambda permissions or public bucket access would create unnecessary security risk.
- Missing API throttling or too-loose Lambda concurrency can turn auth failures, client retry loops, or presign abuse into unnecessary AWS cost and noisy telemetry.
- Lambda timeout/memory settings copied from the placeholder can make the real persistent API flaky once it performs secret, S3, and DynamoDB calls.
- Missing structured logs, log retention, or deploy-artifact log identifiers can make post-merge telemetry verification impossible even when the API works.
- CloudFormation changes that replace retained data-bearing tables or the artifact bucket would destroy or orphan product/economics evidence; data-resource replacement must be rejected before merge.
- Letting the plan become stricter than the PR-010 story contract creates a split-brain acceptance source; the story contract must be reconciled before implementation starts.
- Evidence-only updates after post-merge verification can retrigger deployment loops. Final evidence handling must avoid pretending a docs-only redeploy is new product acceptance.

## Progress, blockers, and evidence

- Used the `plan-next-phase`, `planning`, `specification`, and `testing` skills to prepare this next-phase plan.
- Used the `review-plan` skill to challenge and strengthen the PR-010 plan before implementation.
- Used the `review-plan-adversarial` skill for an additional assumption-by-assumption review.
- Confirmed PR-009 is complete and PR-010 is the next uncompleted story from repository-local `AGENTS.md`.
- Read PR-010 contract, PR-011 boundary contract, current Control API routes/handlers/types/context, DynamoDB repositories, S3 artifact store, CDK Control API stack, config, and relevant tests.
- Current code observations for PR-010:
  - `apps/control-api/src/router.ts` currently lets `request.workspaceId` override server context; PR-010 must remove this.
  - `apps/control-api/src/handlers.ts` still defers presign, document creation, and inspection.
  - `apps/control-api/src/handlers.ts` currently invokes an agent runtime when starting a run; PR-010 must replace this with a placeholder-only persistent run path.
  - `infra/src/stacks/control-api-stack.ts` deploys inline placeholder Lambda code; PR-010 must deploy the real Control API package.
  - `infra/src/stacks/control-api-stack.ts` currently falls back to `HttpIamAuthorizer` when unauthenticated placeholder mode is disabled; PR-010 must avoid an auth layer that blocks the documented dev-token path before Lambda can validate it.
  - The CDK route definitions and infrastructure tests currently omit `GET /api/artifacts/{artifactId}/download-url`; PR-010 must keep app routes, infrastructure routes, docs, smoke tests, and deployed verification in sync.
  - `packages/data/src/repositories.ts` exposes simple repository interfaces; PR-010 must add or layer conditional/idempotent/transactional behavior where needed.
  - `ReviewRunRequestSchema` currently permits `reviewerSeconds: 0`; PR-010 must tighten schema/handler validation so future review decisions cannot create free human-review economics.
  - `.github/workflows/ci.yml`, `scripts/ci/smoke-control-api.mjs`, and `scripts/ci/create-deploy-artifact.mjs` still describe PR-009 unauthenticated placeholder smoke behavior; PR-010 must update them for protected persistent API evidence.
  - `Document`/`Artifact` schemas currently carry bucket/key and optional checksum, but no explicit S3 version ID; PR-010 must extend or otherwise preserve object identity before claiming immutable source artifacts.
  - The deployed API currently has no API Gateway/Lambda adapter for the internal router, so adapter behavior and packaging cannot be assumed from in-memory tests.
  - `infra` currently deploys `Code.fromInline` placeholder code and has no explicit real Lambda bundling path for workspace TypeScript packages.
  - `ApiRequest` currently models only `GET`, `POST`, and `PUT`; PR-010's deployed adapter must handle or reject every method API Gateway can deliver rather than assuming the internal union is exhaustive.
  - Current list repository APIs return full arrays and DynamoDB helpers can query all matching pages; PR-010 must define bounded collection-route contracts before those become deployed API behavior.
  - Current API error codes do not explicitly distinguish auth failures, forbidden/cross-workspace access, idempotency conflicts, payload-too-large, unsupported methods, or secret/config failures.
  - `ControlApiStack` currently sets placeholder Lambda memory/timeout but has no real API runtime sizing, throttling, structured log, or log-retention contract.
  - `ControlApiStack` currently relies on default HTTP API stage behavior; PR-010 must make access, throttling, and logging choices explicit where CDK supports them.
  - No repository-controlled PDF fixture currently appears under `demo-data`, `fixtures`, or as a PDF file; PR-010 likely needs to add a deterministic fixture/generator.
- Step 1 implementation decisions:
  - Authorization strategy: remove the stale default API Gateway IAM authorizer for PR-010 product routes and enforce dev access in the Lambda adapter with a server-side token. The adapter accepts either `x-dev-access-token` or a future `x-origin-proof-token`; the origin-proof path is inactive unless a separate secret ARN is configured by PR-010A or later.
  - Token lifecycle: create a Secrets Manager secret through CDK with a generated token value and pass only secret ARNs/names to Lambda and deploy artifacts. CI smoke reads the secret value through the post-merge AWS role; Codex direct verification reads the same secret through AWS credentials available for validation. Missing secret, KMS/decrypt denial, or retrieval failure is fail-closed.
  - Token comparison: normalize a single header value and reject missing, duplicated, empty, or whitespace-padded values; compare configured token bytes with a timing-safe path and never log supplied values.
  - Runtime controls: package the real Control API Lambda from `apps/control-api/src/lambda.ts` with workspace dependencies, use Node.js 24, explicit timeout/memory/log retention, least-privilege DynamoDB/S3/secret permissions, and HTTP API throttling that supports validation but bounds retry/brute-force volume.
  - Upload limits: use `PutObject` presigned URLs for the first slice with defense-in-depth registration checks. PR-010 accepts `application/pdf`, a 10 MiB maximum upload size, 10 minute upload expiry, and source keys generated by `sourcePdfKey`.
  - Source object identity: registration checks S3 `HeadObject` plus a bounded range read for `%PDF-` plausibility, computes a server-observed SHA-256 from the object bytes within the size cap, records bucket/key/size/content type/sha256, and stores S3 version ID when available. Private source reads use the registered key and may include the version ID once the schema carries it.
  - Placeholder readiness: `POST /api/documents/{documentId}/inspect` marks `READY` only when the uploaded source SHA-256 matches the repository-controlled MVP fixture allowlist. Other PDFs become `UNSUPPORTED` with an honest placeholder warning.
  - Variant scope: PR-010 creates only `V1_TEXT_ONLY` jobs. V2/V3 requests return deterministic deferred errors and create no product records.
  - Value-model and money bounds: USD inputs use finite nonnegative decimal values with at most 4 decimal places and a 1,000,000 USD dev cap. Human-review hourly rates in job value models and active price books must be positive.
  - Idempotency scope: document registration uses generated source key/document identity as the stable retry key; job and run retries use `Idempotency-Key` when present and otherwise stable document/job intent where safe. Conflicting repeats fail without duplicate rows. Full transactional/idempotency infrastructure is implemented only as far as this PR's routes require.
  - Collection bounds: list routes are capped to deterministic small-dev limits with stable ordering in responses; direct deployed verification proves fresh writes by primary-key reads and uses bounded polling only where GSI-backed list visibility can lag.
  - PriceBook activation: `PUT /api/price-books/current` remains supported only for append-only activation/selecting an active version when it passes validation; seeded dev price book is created idempotently by runtime bootstrap if absent.
  - Fault injection boundary: partial-write failure behavior is proven through deterministic tests and non-product test doubles only; no deployed fault-injection/debug/test route or API-selectable failure trigger is added.
  - CI smoke and deploy artifact: post-merge smoke calls protected `GET /api/price-books/current`, retrieves the generated token from Secrets Manager without logging it, and records persistent API fields, secret identifiers, log group, table names, artifact bucket, and access mode in the deploy artifact.
- Implementation progress:
  - Added document presign, registration, placeholder inspection, V1-only job creation, non-executing run placeholder creation, bounded list responses, private artifact download URLs, stricter review-time validation, S3 version ID fields, and business-money validation.
  - Removed the router `workspaceId` override and replaced method mismatches with deterministic `METHOD_NOT_ALLOWED` responses.
  - Replaced the inline placeholder Lambda with a bundled Node.js 24 Control API Lambda, generated Secrets Manager dev token, Lambda-layer timing-safe token check, DynamoDB/S3/secret permissions, explicit timeout/memory/concurrency, HTTP API throttling, and one-week log retention.
  - Added `demo-data/controlled-spanish-source.pdf` as the repository-controlled PR-010 fixture basis.
  - Updated CI smoke/deploy artifact workflow from unauthenticated placeholder 501 checks to protected `GET /api/price-books/current` checks using the generated secret.
  - Deleted the obsolete inline placeholder Lambda source.
- Security pass:
  - Boundary reviewed: dev API token auth, Secrets Manager read path, API Gateway/Lambda boundary, source PDF upload registration, S3 presigned URLs, workspace-scoped reads/writes, CI smoke secret retrieval, and deploy artifact redaction.
  - Fix made: duplicate case-insensitive `x-dev-access-token` headers are rejected before secret retrieval; missing, duplicated, and whitespace-padded token attempts are covered by Lambda auth tests.
  - No token value is synthesized into CloudFormation, stored in Lambda environment variables, printed by CI smoke, or written into the deploy artifact. The deploy artifact records only the secret ARN.
- Deterministic evidence captured locally:
  - `pnpm --filter @agentcore-pdf-translator/control-api typecheck` passed.
  - `pnpm --filter @agentcore-pdf-translator/control-api test` passed.
  - `pnpm --filter @agentcore-pdf-translator/infra typecheck` passed.
  - `pnpm --filter @agentcore-pdf-translator/infra test` passed.
  - `pnpm ci:validate-workflow` passed.
  - `pnpm typecheck` passed.
  - `pnpm test` passed, including 13 Control API tests, 7 infrastructure tests, and the existing package/web suites. Local Node 20 emitted an AWS SDK advisory warning during the Lambda auth test; CI selects Node 24.
  - `pnpm lint` passed.
  - Refactoring assessment after green checks: moved seeded human-review price from a stack literal into required CDK/CI configuration; left larger persistence transaction abstractions deferred because adding them now would widen PR-010 without a stronger oracle than the current route-level tests.
  - `pnpm cdk synth AgentCorePdfTranslator-dev-StorageStack AgentCorePdfTranslator-dev-DatabaseStack AgentCorePdfTranslator-dev-ControlApiStack -c stage=dev -c workspaceId=ci_dev -c activePriceBookVersion=ci_dev -c priceBookHumanReviewHourlyRateUsd=90 --output ../.ci/local-pr-010/cdk.out` passed.
  - `CDK_ASSEMBLY_DIR=.ci/local-pr-010/cdk.out DATA_PROTECTION_SUMMARY_PATH=.ci/local-pr-010/data-protection-summary.json node scripts/ci/validate-data-protection.mjs` passed.
- Post-merge deployment evidence:
  - PR #31 (`codex/pr-010-persistent-control-api`) passed PR verification and was squash-merged to `main` as merged SHA `5015b6321dfcdd673ef86bc0c1c87430e527f935`.
  - The first post-merge deploy run failed during the Control API CloudFormation update because PR-010 renamed the Lambda construct from the existing placeholder logical ID while keeping the same physical `FunctionName`, and it also tried to create a managed log group with an already-existing physical name.
  - Follow-up branch `codex/pr-010-deploy-fix` preserves the existing Control API Lambda construct ID (`ControlApiPlaceholderLambda`) so the physical function updates in place, removes the conflicting managed log-group resource, uses CDK Lambda `logRetention` to configure the existing log group, and updates infrastructure assertions to target the product Lambda by physical name while allowing CDK's log-retention custom-resource Lambda.
  - Follow-up deterministic checks passed: `pnpm --filter @agentcore-pdf-translator/infra typecheck`, `pnpm --filter @agentcore-pdf-translator/infra test`, `pnpm lint`, `pnpm ci:validate-workflow`, `pnpm test`, `pnpm cdk synth AgentCorePdfTranslator-dev-StorageStack AgentCorePdfTranslator-dev-DatabaseStack AgentCorePdfTranslator-dev-ControlApiStack -c stage=dev -c workspaceId=ci_dev -c activePriceBookVersion=ci_dev -c priceBookHumanReviewHourlyRateUsd=90 --output ../.ci/local-pr-010-deploy-fix/cdk.out`, and `CDK_ASSEMBLY_DIR=.ci/local-pr-010-deploy-fix/cdk.out DATA_PROTECTION_SUMMARY_PATH=.ci/local-pr-010-deploy-fix/data-protection-summary.json node scripts/ci/validate-data-protection.mjs`.
- Adversarial review pass 1:
  - Not satisfied. The plan still depended on many implicit assumptions: deployment health, secure token availability, Lambda bundling, API Gateway event adaptation, S3 object identity, existing dev data shape, idempotency storage, PriceBook seeding, non-mutating CI smoke, deploy artifact evolution, and failure recovery.
  - Fixed by adding the adversarial assumption register and turning the main failure modes into explicit scope, checks, deployed verification, telemetry, implementation steps, and risks.
- Adversarial review pass 2:
  - Remaining risks are now either implementation decisions with step-1 blockers or explicitly verified outcomes.
  - The plan is stronger because it no longer lets "typecheck + synth + placeholder smoke" masquerade as proof of a protected persistent API.
- Adversarial review pass 3:
  - Not satisfied at the start of the pass. The plan still left room for an API Gateway IAM authorizer to block the documented dev-token path, for the artifact private-read route to exist in app code but not in deployed infrastructure, for run placeholders to be marked `RUNNING` without execution, for token values to leak through templates/environment/evidence, and for zero-second review payloads to preserve a free-review path.
  - Fixed by adding explicit auth-layer selection requirements, route-surface parity requirements, exact non-executing run-placeholder state semantics, token secret-hygiene and timing-safe parser checks, and schema/handler validation requirements for positive review time.
- Adversarial review pass 4:
  - Not satisfied at the start of the pass. The plan still assumed small data volumes, immediate GSI-backed read visibility, harmless CORS/unsupported-method behavior, adequate generic error codes, reliable secret retrieval/rotation, safe future origin-proof headers, safe upload sizes/content, and harmless abandoned presigned uploads.
  - Fixed by adding list pagination/limit and GSI-consistency requirements, method/preflight handling, explicit API error-code coverage, secret lifecycle/KMS/rotation requirements, anti-forgery requirements for future CloudFront origin proof, request/upload size and PDF-plausibility limits, and staging-versus-registered artifact cleanup boundaries.
- Adversarial review pass 5:
  - Not satisfied at the start of the pass. The plan still under-specified operational controls: dev throttling/rate limits, Lambda timeout/memory/concurrency, structured log retention/query targets, presigned upload constraints before registration, and CloudFormation replacement safety for retained data resources.
  - Fixed by adding explicit runtime/throttling/logging requirements, deploy artifact log/query/resource outputs, presigned upload constraint requirements, latency/error budget telemetry checks, and CDK replacement-safety checks for retained S3/DynamoDB resources.
- Review-plan pass 1:
  - Not 100% satisfied. The plan did not explicitly update PR-009 CI smoke/deploy artifact semantics, did not make Codex's protected deployed-verification access path a merge blocker, and did not account for S3 object overwrite/version identity.
  - Fixed by adding CI smoke/deploy artifact requirements, secure direct-verification credential requirements, PR-010A auth compatibility, object identity requirements, and test-only partial-failure guardrails.
- Review-plan pass 2:
  - The plan now addresses the main second-order risks from moving from unauthenticated placeholder deployment to protected persistent API deployment.
  - Remaining implementation choices are intentionally isolated to step 1 and have explicit done conditions.
- Review-plan pass 3:
  - Not 100% satisfied at the start of the pass. The plan still left token provisioning as a possible manual prerequisite, allowed source checksum evidence to be copied from client-supplied metadata if implemented poorly, and did not explicitly forbid placeholder-created workflow-looking StageEvents, evaluations, translated artifacts, or ledger rows.
  - Fixed by adding CI/IaC-controlled token provisioning and preflight requirements, server-observed or S3-validated checksum requirements, and explicit placeholder evidence constraints across scope, expected outcomes, checks, deployed verification, telemetry, and risks.
- Adversarial review pass 6:
  - Not satisfied at the start of the pass. The plan had become stricter than `docs/codex/PR-010-PERSISTENT-CONTROL-API.md`, while repository-local `AGENTS.md` says dedicated story contracts are the acceptance source.
  - Fixed by making story-contract reconciliation a step-1 blocker, adding an explicit assumption/risk, and promoting the current key plan-only acceptance constraints into `docs/codex/PR-010-PERSISTENT-CONTROL-API.md`.
- Adversarial review pass 7:
  - Not satisfied at the start of the pass. The story contract still required deployed partial-write or fault-injection verification, while the plan also warned that product-facing fault injection would become an unplanned mode.
  - Fixed by making partial-write fault evidence deterministic-test-only for PR-010, allowing deployed verification only for ordinary invalid/conflicting requests, and explicitly forbidding deployed fault-injection routes, debug modes, test modes, and API-selectable failure triggers.
- Review-plan pass 4:
  - Not 100% satisfied at the start of the pass. The plan still allowed human review to appear free through zero hourly rates, did not bound monetary input precision/caps, did not explicitly keep PR-010 job creation to V1 only, and left room for placeholder inspection to mark arbitrary PDFs `READY`.
  - Fixed by adding positive human-review rate and bounded-money validation, V1-only PR-010 job creation with V2/V3 deferred errors, controlled-fixture-only placeholder readiness, and matching checks/deployed verification/story-contract requirements.
- Plan review gate, pass 1:
  - The first draft was too likely to let `PUT /api/price-books/current` sprawl and did not make the current `workspaceId` override and AgentCore invocation concrete enough.
  - Fixed by making price-book activation explicitly optional/deferred unless small, and by naming both current-code contradictions as implementation requirements.
- Plan review gate, pass 2:
  - Scope is specific, product-aligned, and bounded to PR-010.
  - Verification covers deterministic checks, post-merge deployed use, telemetry selectors, forbidden signals, and evidence redaction.
  - Failure modes cover auth, workspace scoping, idempotency, partial writes, artifact privacy, source immutability, pricing/value-model integrity, V1-only scope, controlled-fixture readiness, and placeholder honesty.
  - Confidence: HECK YES for using this as the PR-010 implementation plan, subject to resolving the listed open questions during step 1 before implementation edits and promoting any remaining acceptance-source diffs into the PR-010 story contract.
