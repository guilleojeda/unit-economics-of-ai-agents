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
- Stage-plan tests for V3 sequence and skipped-stage evidence.
- Cost tests proving skipped work does not create model/tool cost rows and executed work does.
- Evaluation tests proving V3 output can pass the same acceptance criteria as V2 for the controlled document.
- Comparison tests proving V3 appears with V1 and V2 using persisted jobs.
- `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm cdk synth`.

## Deployed Verification

After merge, CI must deploy the merged SHA and produce the deploy artifact.

Codex must use the deployed app/API directly:

1. Use the same controlled document and comparison group as V1/V2.
2. Create a `V3_OPTIMIZED` job.
3. Start the V3 run and wait for `AWAITING_REVIEW`.
4. Verify V3 processes material text and skips decorative/low-materiality image work.
5. Verify skipped work is visible as StageEvent or evaluation evidence without creating fake cost rows.
6. Open the translated PDF and evaluation.
7. Accept the V3 run only if the output is acceptable under the product review flow.
8. Open comparison view and verify V1, V2, and V3 appear from real persisted jobs.
9. Verify V3 has fewer unnecessary image tool/model operations than V2 and lower or equal full workflow cost for the controlled document under the same price book, unless a documented retry/failure explains otherwise.

## Telemetry Verification

Use merged SHA, deploy run ID, `validationRunId`, `comparisonGroupId`, `documentId`, `jobId`, `runId`, trace ID, Gateway invocation IDs, Lambda request IDs, and Bedrock request IDs when available.

Required when telemetry is queryable:

- V3 routing stage executes.
- Material image tool/model calls occur only for selected images.
- Decorative image translation call is absent.
- No unexpected 5xx or Gateway system error.

Telemetry is correlation evidence only. Economics remain sourced from `LedgerItem` rows.

## Acceptance Criteria

- PR is merged to `main`.
- Post-merge deployment succeeds and produces a deploy artifact.
- Deployed V3 run reaches `AWAITING_REVIEW`.
- V3 accepted output is reviewable and, when accepted, produces cost per verified outcome and unit margin.
- Comparison view shows V1/V2/V3 economics from persisted jobs.
- V3 optimization is evidenced by skipped work and lower or equal unnecessary image cost versus V2.

## Review Traps

Reject or revise if the change:

- Makes V3 a hard-coded cheaper path with no materiality evidence.
- Hides skipped work instead of showing it honestly.
- Removes necessary image text handling just to reduce cost.
- Seeds fake V1/V2/V3 comparison data.
- Hard-codes prices or model IDs.
