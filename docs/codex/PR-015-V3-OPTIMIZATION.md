# PR-015 - V3 Optimization

PR-015 starts only after V2 image annotation is deployed and directly verified. It adds an optimized route that selectively avoids unnecessary image work while preserving accepted output quality.

## Objective

Implement `V3_OPTIMIZED` so the workflow can skip low-materiality image work, reduce unnecessary tool/model operations versus V2, and show the cost and margin effect in the comparison view.

## Scope

In scope:

- V3 route planning for controlled PDFs.
- Materiality-based image selection.
- Selective image extraction and translation behavior.
- Batch or optimized text translation where it preserves alignment and schema validation.
- Shared schema/contract coverage for V3-specific route, selective extraction, batch translation, selective image translation, and skipped-stage evidence. If a V3 step is internal rather than a Gateway tool, document that boundary explicitly.
- Use the same repository-controlled MVP PDF fixture and comparison group lineage proven by V1/V2; do not substitute a different document to make V3 look cheaper.
- Use the same `PriceBook` version and business value assumptions as the accepted V1/V2 comparison jobs for deployed comparison evidence, or explicitly block the comparison as not apples-to-apples.
- V3 evaluation semantics.
- Ledger evidence for skipped stages, executed stages, model/tool costs, and review cost.
- Comparison view updates showing V1, V2, and V3 economics side by side.

## Non-Goals

- No new model-selection product mode.
- No broad auto-optimizer that changes business rules dynamically.
- No production billing reconciliation.
- No AgentCore Memory.
- No scanned-PDF OCR or image inpainting.
- No replay, synthetic-run, live-capture, recording, or presentation mode.

## Deterministic Checks

- Route planner tests proving decorative/low-materiality images are skipped and material images are processed.
- Contract/schema tests for V3 route outputs, selective image manifests, batch translation responses, selective image translation responses, and skipped-stage evidence.
- Stage-plan tests for V3 sequence and skipped-stage evidence.
- Cost tests proving skipped work does not create model/tool cost rows and executed work does.
- Evaluation tests proving V3 output can pass the same acceptance criteria as V2 for the controlled document.
- Comparison tests proving V3 appears with V1 and V2 using persisted jobs.
- Comparison tests proving V1/V2/V3 cost and margin comparisons use matching `PriceBook` versions and value assumptions, or clearly refuse/label mismatched comparisons.
- Review validation tests proving V3 accept/reject/escalate decisions require positive reviewer seconds and create non-zero `HUMAN_REVIEW` cost.
- `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm cdk synth`.

## Deployed Verification

After merge, CI must deploy the merged SHA and produce the deploy artifact.

Codex must use the deployed app for user-facing workflow and comparison steps, with API calls only as supporting evidence:

1. Use the same repository-controlled Spanish PDF fixture and comparison group as V1/V2, with matching `PriceBook` version and business value assumptions.
2. Create a `V3_OPTIMIZED` job.
3. Start the V3 run and wait for `AWAITING_REVIEW`.
4. Verify V3 processes material text and skips decorative/low-materiality image work.
5. Verify V3-specific route, selective, batch, and skipped-stage outputs conform to shared schemas/contracts or documented internal-stage contracts.
6. Verify skipped work is visible as StageEvent or evaluation evidence without creating fake cost rows.
7. Open the translated PDF and evaluation.
8. Accept the V3 run with positive reviewer seconds only if the output is acceptable under the product review flow.
9. Open comparison view and verify V1, V2, and V3 appear from real persisted jobs.
10. Verify V3 has fewer unnecessary image tool/model operations than V2 and lower or equal unnecessary image-handling cost for the controlled document under the same price book and value assumptions.
11. Verify the full workflow cost and unit margin comparison is shown honestly, including any routing overhead or retry cost that prevents V3 from being cheaper end to end.

## Telemetry Verification

Use merged SHA, deploy run ID, `validationRunId`, `comparisonGroupId`, `documentId`, `jobId`, `runId`, trace ID, Gateway invocation IDs, Lambda request IDs, and Bedrock request IDs when available.

Required when telemetry is queryable:

- V3 routing stage executes.
- V3 route/selective/batch outputs are correlated to the validation `runId`.
- Material image tool/model calls occur only for selected images.
- Decorative image translation call is absent.
- No unexpected 5xx or Gateway system error.

Telemetry is correlation evidence only. Economics remain sourced from `LedgerItem` rows.

## Acceptance Criteria

- PR is merged to `main`.
- Post-merge deployment succeeds and produces a deploy artifact.
- Deployed V3 run reaches `AWAITING_REVIEW`.
- V3 accepted output is reviewable and, when accepted, produces cost per verified outcome and unit margin.
- Review decisions create non-zero `HUMAN_REVIEW` ledger cost from positive reviewer seconds.
- V3 route/selective/batch behavior is covered by shared schemas/contracts or explicitly documented internal-stage contracts.
- V1/V2/V3 comparison evidence uses matching `PriceBook` version and business value assumptions, or the UI/API clearly refuses or labels the mismatch.
- Comparison view shows V1/V2/V3 economics from persisted jobs.
- V3 optimization is evidenced by skipped work and lower or equal unnecessary image-handling cost versus V2, while full workflow cost and margin are displayed honestly from ledger rows.

## Review Traps

Reject or revise if the change:

- Makes V3 a hard-coded cheaper path with no materiality evidence.
- Hides routing overhead, retries, or other full workflow costs to make V3 appear cheaper.
- Hides skipped work instead of showing it honestly.
- Implements V3 route/selective/batch behavior as ad hoc code without schema/contract coverage.
- Removes necessary image text handling just to reduce cost.
- Seeds fake V1/V2/V3 comparison data.
- Hard-codes prices or model IDs.
- Uses a different document than the accepted V1/V2 comparison input to improve V3 economics.
- Compares V1/V2/V3 margins using different price books or value assumptions without an explicit mismatch label/block.
- Allows V3 review decisions with zero or missing reviewer seconds.
