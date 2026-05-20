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
- Final verification must use the same repository-controlled MVP PDF fixture and comparison-group lineage used for V1/V2/V3 acceptance.
- Final comparison verification must either use matching `PriceBook` versions and business value assumptions across V1/V2/V3 or explicitly show that mismatched comparisons are blocked or labeled.
- Final comparison verification must also prove matching translation/evaluator model configuration and prompt/configuration versions or labels across V1/V2/V3 when making variant economics or quality claims, or explicitly show that mismatches are blocked or labeled.
- Final idempotency and artifact-integrity audit across V1, V2, and V3, proving duplicate delivery and reviewer retries cannot corrupt ledger-derived economics or reviewer-visible artifacts.
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
- Comparison checks proving mismatched price books or value assumptions cannot be silently compared as apples-to-apples margins.
- Comparison checks proving mismatched model IDs or prompt/configuration versions cannot be silently compared as apples-to-apples quality, cost, or optimization evidence.
- `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm cdk synth`.

## Deployed Verification

After merge, CI must deploy the merged SHA and produce the deploy artifact.

Codex must use the deployed app for the final product pass, with API calls only as supporting evidence:

1. Upload the repository-controlled Spanish PDF fixture.
2. Run V1, V2, and V3 jobs for the same comparison group with matching `PriceBook` version, business value assumptions, and translation/evaluator configuration.
3. Review at least one run to `ACCEPTED`, at least one run to `REJECTED`, and at least one run to `ESCALATED`, each with positive reviewer seconds.
4. Open document, job, run detail, result, evaluation, ledger, comparison, and economics settings views.
5. Verify all major screens are navigable and show persisted data, not fixture histories.
6. Verify each accepted job shows cost per verified outcome and unit margin.
7. Verify rejected or failed work remains visible with consumed cost, including non-zero human review cost where review happened, and no verified outcome.
8. Verify cost-basis labels do not claim AWS bill reconciliation unless it is actually implemented.
9. Verify each run exposes model/configuration evidence sufficient to support or block V1/V2/V3 comparison claims.
10. Verify trace IDs in UI/API records can be used to find telemetry for the validation run.
11. Verify the product can be used normally while an external screen recording is running, without adding recording, replay, synthetic-run, live-capture, or presentation behavior to the app.
12. Exercise or inspect a controlled technical failure path and verify it leaves visible StageEvent/Run failure evidence and consumed cost, or record why a safe failure injection is not available.
13. Exercise supported duplicate-submit or retry paths for run start, at least one tool/stage delivery, and review submission, then verify the persisted records and economics remain single-counted for each invocation identity.
14. Verify source and translated PDF artifact links resolve to persisted S3 artifacts with expected metadata for the validation run.

## Telemetry Verification

Use merged SHA, deploy run ID, `validationRunId`, comparison group ID, document ID, job IDs, run IDs, trace IDs, Runtime session IDs, Gateway invocation IDs, Lambda request IDs, and Bedrock request IDs when available.

Required:

- Control API spans or logs for all validation routes.
- Runtime execution telemetry for each run.
- Gateway invocation telemetry for tool calls.
- Tool Lambda telemetry for each invoked tool group.
- Bedrock wrapper telemetry for model calls.
- Persisted model/configuration identifiers for each compared run match the comparison claim or are explicitly surfaced as mismatched.
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
- V1/V2/V3 comparison evidence does not silently mix different price books, value assumptions, model IDs, or prompt/configuration versions.
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
- Substitutes a different validation document that breaks comparison continuity with V1/V2/V3 acceptance evidence.
- Allows review decisions with zero or missing reviewer seconds.
- Shows V1/V2/V3 margin, quality, or optimization comparisons across mismatched price books, value assumptions, model IDs, or prompt/configuration versions without blocking or labeling the mismatch.
