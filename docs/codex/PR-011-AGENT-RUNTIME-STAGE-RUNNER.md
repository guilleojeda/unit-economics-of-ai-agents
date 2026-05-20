# PR-011 - Agent Runtime Stage Runner Without Real Gateway

PR-011 starts only after PR-010A is deployed and directly verified. It proves the workflow execution shape before AgentCore Runtime and Gateway are introduced.

## Objective

Implement the stage-plan and stage-runner logic as plain TypeScript so a real persisted run can move through the documented workflow shape and produce StageEvents, Artifacts, LedgerItems, EvaluationResult, and job economics without real Gateway or Bedrock dependencies.

## Scope

In scope:

- Stage-plan builder for V1, V2, and V3.
- Stage runner that creates and updates `StageEvent` records.
- Tool request/response contracts and Zod validation.
- Deterministic development tool implementations used only to prove contracts before Gateway exists.
- Artifact and ledger draft persistence through repository interfaces.
- Development tool LedgerItems may record explicit tool/runtime/review estimates, but must not create `MODEL_INFERENCE` rows unless a real model is actually invoked.
- Run status transitions ending in `AWAITING_REVIEW` or `FAILED`.
- Review flow for `AWAITING_REVIEW` runs, including accept, reject, and escalate decisions, `ReviewDecision` records, `HUMAN_REVIEW` ledger rows, and job economics recalculation.

## Non-Goals

- No AgentCore Runtime deployment.
- No AgentCore Gateway deployment.
- No Bedrock calls.
- No fake model inference costs.
- No real PDF translation quality claim.
- No product mode switch for replay, synthetic runs, live capture, recording, or presentation.
- No branch preview deployment.
- No V2 or V3 quality optimization claims.

## Deterministic Checks

- Unit tests for stage-plan generation by workflow variant.
- Stage-runner tests proving each stage creates exactly one running event and one terminal event.
- Tool response validation tests for success and failure responses.
- Ledger tests proving tool/runtime/retry/review rows roll up correctly and no deployed `MODEL_INFERENCE` rows are created without real model calls.
- State-transition tests for `RUNNING -> EVALUATING -> AWAITING_REVIEW`, failure paths, and accept/reject/escalate review decisions.
- API or integration tests proving `POST /api/jobs/{jobId}/runs` starts the runner and read endpoints expose persisted results.
- `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm cdk synth`.

## Deployed Verification

After merge, CI must deploy the merged SHA and produce the deploy artifact.

Because PR-010A has deployed the rendered app, Codex must use the deployed app for user-facing workflow steps and may use API calls only as supporting evidence:

1. Create or reuse a controlled document and job through the deployed app.
2. Start a run through the deployed app.
3. Poll or refresh the deployed app/API until the run reaches `AWAITING_REVIEW` or `FAILED`.
4. Verify the timeline has the expected stage sequence for the selected variant.
5. Verify artifacts and ledger rows were persisted from tool response drafts.
6. Verify the run evaluation is visible through the app and persisted through the API.
7. Accept one run through the deployed app with reviewer seconds.
8. Verify the accepted job creates a `ReviewDecision`, creates a `HUMAN_REVIEW` ledger row, and shows cost per verified outcome plus unit margin.
9. Reject or escalate a separate `AWAITING_REVIEW` run through the deployed app.
10. Verify the non-accepted decision creates a `ReviewDecision` and `HUMAN_REVIEW` ledger row, keeps consumed cost visible, and shows no verified outcome or unit margin.
11. Verify no `MODEL_INFERENCE` LedgerItem is created for the validation runs unless a real model call occurred.

The direct verification must label the execution backend honestly as a pre-Gateway development implementation path. It must not expose a user-selectable synthetic product mode.

## Telemetry Verification

Use merged SHA, deploy run ID, `validationRunId`, `runId`, and `jobId` as selectors.

Required when telemetry is queryable:

- Control API route signals for job/run/review requests.
- Stage-runner execution signal for the validation `runId`.
- No `MODEL_INFERENCE` ledger row without a corresponding model invocation signal.
- No unhandled runner exceptions.
- No duplicate terminal `StageEvent` records for a stage.

If telemetry is not queryable, record the blocker in `PLAN.md`.

## Acceptance Criteria

- PR is merged to `main`.
- Post-merge deployment succeeds and produces a deploy artifact.
- A deployed run reaches `AWAITING_REVIEW` through the stage runner.
- StageEvents, Artifacts, LedgerItems, and EvaluationResult are persisted and visible through API reads.
- Reviewer accept and non-accepted decisions create `ReviewDecision` and `HUMAN_REVIEW` ledger evidence.
- Non-accepted runs show consumed cost but no verified outcome or unit margin.
- Economics remain ledger-derived.
- Economics do not include fake model inference costs.
- The implementation introduces no replay, synthetic-run, live-capture, recording, or presentation mode.

## Review Traps

Reject or revise if the change:

- Adds a product-facing mode selector for fake execution.
- Lets tools mutate `Run` directly instead of the stage runner owning transitions.
- Hides failed stages or failed attempts from costs.
- Allows acceptance before `AWAITING_REVIEW`.
- Creates ledger rows from logs instead of explicit tool/review outputs.
- Creates `MODEL_INFERENCE` rows from development tool proof data.
- Leaves reject/escalate behavior unverified.
- Hard-codes prices or model IDs.
