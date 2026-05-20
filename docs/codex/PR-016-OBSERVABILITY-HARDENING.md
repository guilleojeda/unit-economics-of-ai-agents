# PR-016 - Observability And Hardening

PR-016 starts only after V1, V2, and V3 are deployed and directly verified. It hardens telemetry, trace correlation, cost-basis labeling, and final product acceptance evidence.

## Objective

Make the deployed product auditable end to end by correlating workflow records, telemetry, logs, deploy artifacts, and cost-basis labels without treating logs as the economics source of truth.

## Scope

In scope:

- Trace/correlation IDs on `Run`, `StageEvent`, `Artifact`, `LedgerItem`, `EvaluationResult`, and relevant API responses.
- CloudWatch and AgentCore Observability queries or dashboards for validation runs.
- Runtime, Gateway, tool Lambda, Bedrock wrapper, Control API, and review-flow telemetry correlation.
- Cost-basis labeling for estimates, telemetry-derived rows, mixed rows, and AWS-bill-reconciled rows only if reconciliation exists.
- Error, latency, and failure-rate budgets for the controlled demo workflow.
- Final hardening pass for V1/V2/V3 direct product use.
- Final verification must use the same repository-controlled MVP PDF fixture, immutable source artifact identity/checksum, and comparison-group lineage used for V1/V2/V3 acceptance.
- Final comparison verification must either use matching `PriceBook` versions and business value assumptions across V1/V2/V3 or explicitly show that mismatched comparisons are blocked or labeled.
- Final comparison verification must also prove matching translation/evaluator model configuration and prompt/configuration versions or labels across V1/V2/V3 when making variant economics or quality claims, or explicitly show that mismatches are blocked or labeled.
- Final comparison verification must prove compatible workflow implementation provenance across V1/V2/V3 claims, including deployed commit/build and runtime/tool versions where available, or explicitly show that stale/build-mismatched comparisons are blocked or labeled.
- Final comparison verification must prove matching workspace/environment and validation evidence across V1/V2/V3 claims, including stage, region, AWS account ID, deploy artifact identity, resolved workspace, and validation selector when applicable, or explicitly show that wrong-environment comparisons are blocked or labeled.
- Final idempotency and artifact-integrity audit across V1, V2, and V3, proving duplicate delivery and reviewer retries cannot corrupt ledger-derived economics or reviewer-visible artifacts.
- Final private artifact-access audit across source, translated PDF, preview, evaluation, image, route, and skipped-stage artifacts, proving reviewer-visible artifacts are opened through authorized short-lived Control API access and not public S3 or raw API bytes.
- Final tool-contract audit across V1, V2, and V3, proving file-bearing Runtime/Gateway/tool calls use explicit artifact IDs/S3 keys and not raw bytes, local paths, arbitrary keys, or bare documentId-only file inference.
- Final evidence-hygiene audit across CI artifacts, deploy artifacts, job summaries, logs, telemetry, browser evidence, validation records, and `PLAN.md`, proving they preserve useful selectors and summaries without persisting credentials, auth headers, cookies, full presigned URLs, signed query strings, raw artifact bytes, full Bedrock prompts, raw model responses, or unnecessary full extracted/translated document text.
- Documentation of known telemetry gaps.

## Non-Goals

- No production billing reconciliation unless fully implemented and verified.
- No AWS Cost Explorer integration unless explicitly added as a separate scoped task.
- No complex enterprise auth.
- No VPC networking unless a concrete private dependency requires it.
- No new workflow variant.
- No replay, synthetic-run, live-capture, recording, or presentation mode.

## Deterministic Checks

- Tests proving trace IDs propagate into persisted records.
- Tests proving ledger economics still derive from `LedgerItem` rows, not logs.
- Tests proving cost-basis labels are honest and do not claim reconciliation without reconciliation evidence.
- Tests for error paths and failure-state visibility.
- Dashboard/query definition validation if stored as code.
- End-to-end checks for V1, V2, and V3 happy paths and key failure paths.
- End-to-end checks proving accepted, rejected, and escalated review decisions require positive reviewer seconds and create non-zero `HUMAN_REVIEW` ledger costs.
- End-to-end checks proving duplicate run starts, tool deliveries, stage retries, and review submissions do not duplicate StageEvents, Artifacts, ReviewDecisions, EvaluationResults, or LedgerItems.
- Artifact-integrity checks proving reviewer-visible source and translated PDFs resolve to persisted S3 artifacts with expected metadata rather than raw API payload bytes or local files.
- Artifact-access checks proving private artifact links enforce workspace/resource authorization, expire quickly, reject cross-workspace/arbitrary-key requests, and never require public S3 objects.
- Tool-contract checks proving file-bearing V1/V2/V3 stages pass explicit artifact references and cannot silently switch to raw payload bytes, local files, arbitrary keys, or documentId-only inference.
- Comparison checks proving mismatched price books or value assumptions cannot be silently compared as apples-to-apples margins.
- Comparison checks proving mismatched model IDs or prompt/configuration versions cannot be silently compared as apples-to-apples quality, cost, or optimization evidence.
- Comparison/source-lineage checks proving mismatched canonical source artifact identity/checksum cannot be silently compared as apples-to-apples V1/V2/V3 workflow evidence.
- Comparison/implementation-provenance checks proving stale or incompatible deployed build/runtime/tool versions cannot be silently compared as apples-to-apples V1/V2/V3 workflow evidence.
- Comparison/environment checks proving wrong-stage, wrong-account, wrong-workspace, or uncorrelated validation evidence cannot be silently compared as apples-to-apples V1/V2/V3 workflow evidence.
- Evidence-hygiene checks proving CI artifacts, deploy artifacts, job summaries, logs, telemetry, browser evidence, validation records, and `PLAN.md` preserve useful selectors and summaries without persisting credentials, auth headers, cookies, full presigned URLs, signed query strings, raw artifact bytes, full Bedrock prompts, raw model responses, or unnecessary full extracted/translated document text.
- `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm cdk synth`.

## Deployed Verification

After merge, CI must deploy the merged SHA and produce the deploy artifact.

Codex must use the deployed app for the final product pass, with API calls only as supporting evidence. Validation must use the current deploy artifact's frontend/API/Runtime/Gateway outputs, AWS account, region, stage, resolved workspace, and a stable `validationRunId` or equivalent selector:

1. Upload the repository-controlled Spanish PDF fixture.
2. Run V1, V2, and V3 jobs for the same comparison group with matching canonical source artifact identity/checksum, `PriceBook` version, business value assumptions, translation/evaluator configuration, compatible implementation provenance, and matching environment/workspace evidence.
3. Review at least one run to `ACCEPTED`, at least one run to `REJECTED`, and at least one run to `ESCALATED`, each with positive reviewer seconds.
4. Open document, job, run detail, result, evaluation, ledger, comparison, and economics settings views.
5. Verify all major screens are navigable and show persisted data, not fixture histories.
6. Verify each accepted job shows cost per verified outcome and unit margin.
7. Verify rejected or failed work remains visible with consumed cost, including non-zero human review cost where review happened, and no verified outcome.
8. Verify cost-basis labels do not claim AWS bill reconciliation unless it is actually implemented.
9. Verify each run exposes model/configuration evidence sufficient to support or block V1/V2/V3 comparison claims.
10. Verify each compared run exposes source-lineage evidence proving the same immutable canonical source artifact identity/checksum.
11. Verify each compared run exposes implementation-provenance evidence proving compatible deployed commit/build and runtime/tool versions, or that mismatches are explicitly blocked/labeled.
12. Verify each compared run exposes environment/workspace evidence proving the same deployed account, stage, resolved workspace, deploy artifact, and validation selector where applicable, or that mismatches are explicitly blocked/labeled.
13. Verify trace IDs in UI/API records can be used to find telemetry for the validation run.
14. Verify the product can be used normally while an external screen recording is running, without adding recording, replay, synthetic-run, live-capture, or presentation behavior to the app.
15. Exercise or inspect a controlled technical failure path and verify it leaves visible StageEvent/Run failure evidence and consumed cost, or record why a safe failure injection is not available.
16. Exercise supported duplicate-submit or retry paths for run start, at least one tool/stage delivery, and review submission, then verify the persisted records and economics remain single-counted for each invocation identity.
17. Verify source, translated PDF, preview if used, evaluation, image, route, and skipped-stage artifact links resolve through private Control API artifact access to persisted S3 artifacts with expected metadata for the validation run.
18. Verify file-bearing V1/V2/V3 Runtime/Gateway/tool evidence uses explicit artifact IDs/S3 keys and not raw bytes, local paths, arbitrary keys, or documentId-only file inference.
19. Verify CI artifacts, deploy artifacts, job summaries, logs, telemetry, browser evidence, validation records, and `PLAN.md` preserve useful selectors and summaries without persisting credentials, auth headers, cookies, full presigned URLs, signed query strings, raw artifact bytes, full Bedrock prompts, raw model responses, or unnecessary full extracted/translated document text.
20. Attempt unauthorized, cross-workspace, wrong-environment, and arbitrary-key artifact access and verify it is denied without exposing object bytes or signed URLs.

## Telemetry Verification

Use merged SHA, deploy run ID, `validationRunId`, comparison group ID, document ID, job IDs, run IDs, trace IDs, Runtime session IDs, Gateway invocation IDs, Lambda request IDs, and Bedrock request IDs when available.

Required:

- Control API spans or logs for all validation routes.
- Runtime execution telemetry for each run.
- Gateway invocation telemetry for tool calls.
- Tool Lambda telemetry for each invoked tool group.
- Bedrock wrapper telemetry for model calls.
- Persisted model/configuration identifiers for each compared run match the comparison claim or are explicitly surfaced as mismatched.
- Persisted source-lineage evidence for each compared run matches the same immutable canonical source artifact identity/checksum, or is explicitly surfaced as mismatched.
- Persisted implementation-provenance evidence for each compared run shows compatible deployed commit/build and runtime/tool versions, or is explicitly surfaced as mismatched.
- Persisted environment/workspace evidence for each compared run shows matching stage, region, AWS account, deploy artifact, resolved workspace, and validation selector where applicable, or is explicitly surfaced as mismatched.
- Artifact-access route telemetry for every reviewer-visible artifact opened during validation, plus denied telemetry for unauthorized/cross-workspace artifact attempts.
- Runtime/Gateway/tool telemetry or request evidence showing explicit artifact references for file-bearing stages.
- Sanitized telemetry and durable evidence preserve correlation selectors, artifact IDs/S3 keys, hashes/checksums, model IDs, token usage, latency, cost totals, status codes, and summaries without credentials, auth headers, cookies, full presigned URLs, signed query strings, raw artifact bytes, full Bedrock prompts, raw model responses, or unnecessary full extracted/translated document text.
- No unhandled 5xx response during the validation path.
- No duplicate persisted StageEvent, Artifact, EvaluationResult, ReviewDecision, or LedgerItem rows for repeated delivery of the same validation invocation identity.
- Latency and error budgets recorded in `PLAN.md`.
- Explicit statement for any telemetry surface that cannot be queried.

Forbidden:

- Claiming telemetry verification from screenshots only.
- Claiming AWS bill reconciliation without implemented reconciliation.
- Using logs as the source of economics truth.

## Acceptance Criteria

- PR is merged to `main`.
- Post-merge deployment succeeds and produces a deploy artifact.
- V1, V2, and V3 complete through deployed product paths.
- Major app/API views are directly exercised by Codex.
- Accepted, rejected, escalated, and failed/technical-failure outcomes are verified or precisely documented if a safe failure injection is unavailable.
- Accepted, rejected, and escalated review decisions create non-zero `HUMAN_REVIEW` ledger cost from positive reviewer seconds.
- Duplicate delivery/retry paths cannot corrupt persisted workflow records or ledger-derived economics.
- Reviewer-visible source and translated PDFs are verified persisted artifacts with integrity metadata.
- Reviewer-visible artifacts are private, authorized, short-lived, artifact-ID based, and never made public as a shortcut.
- File-bearing Runtime/Gateway/tool calls use explicit artifact references and never raw bytes, local paths, arbitrary keys, or bare documentId-only file inference.
- CI artifacts, deploy artifacts, job summaries, logs, telemetry, browser evidence, validation records, and `PLAN.md` preserve useful selectors and summaries without persisting credentials, auth headers, cookies, full presigned URLs, signed query strings, raw artifact bytes, full Bedrock prompts, raw model responses, or unnecessary full extracted/translated document text.
- V1/V2/V3 comparison evidence does not silently mix different canonical source artifact identities/checksums, price books, value assumptions, model IDs, prompt/configuration versions, incompatible workflow implementation provenance, or wrong environment/workspace evidence.
- The product remains a normal app under external recording and does not add product recording or presentation modes.
- Telemetry can be correlated to persisted workflow records, or blockers are precisely recorded.
- Cost-basis labels are honest.
- Ledger-derived economics remain authoritative.
- `PLAN.md` includes deterministic, deployed, telemetry, and residual-risk evidence.

## Review Traps

Reject or revise if the change:

- Treats observability data as the source of cost truth.
- Hides telemetry gaps.
- Leaves reject, escalate, or failure economics unverified without documenting a concrete blocker.
- Leaves final acceptance based only on logs, screenshots, or CI checks.
- Claims production readiness for auth, billing reconciliation, or scanned PDFs without implementing them.
- Adds presentation or recording behavior to the product.
- Hard-codes prices or model IDs.
- Leaves duplicate delivery or reviewer retry behavior untested for the final V1/V2/V3 product paths.
- Leaves reviewer-visible artifact integrity unverified.
- Leaves reviewer-visible artifact access public, unscoped, unexpired, or untested.
- Leaves file-bearing tool requests able to use raw bytes, local files, arbitrary keys, or documentId-only file inference.
- Leaves credentials, auth headers, cookies, full presigned URLs, signed query strings, raw artifact bytes, full Bedrock prompts, raw model responses, or unnecessary full extracted/translated document text in CI artifacts, deploy artifacts, job summaries, logs, telemetry, browser evidence, validation records, or `PLAN.md`.
- Substitutes a different validation document that breaks comparison continuity with V1/V2/V3 acceptance evidence.
- Compares runs whose source artifact identity/checksum differs while presenting them as the same controlled workflow.
- Compares runs whose deployed build/runtime/tool provenance is stale or incompatible while presenting them as apples-to-apples architecture-variant evidence.
- Compares runs whose stage, AWS account, resolved workspace, deploy artifact, or validation selector is mismatched while presenting them as apples-to-apples architecture-variant evidence.
- Allows review decisions with zero or missing reviewer seconds.
- Shows V1/V2/V3 margin, quality, or optimization comparisons across mismatched price books, value assumptions, model IDs, or prompt/configuration versions without blocking or labeling the mismatch.
