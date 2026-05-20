# PR-011 - Agent Runtime Stage Runner Without Real Gateway

PR-011 starts only after PR-010A is deployed and directly verified. It proves the workflow execution shape before AgentCore Runtime and Gateway are introduced.

## Objective

Implement the stage-plan and stage-runner logic as plain TypeScript so a real persisted run can move through the documented workflow shape and produce StageEvents, Artifacts, LedgerItems, EvaluationResult, and job economics without real Gateway or Bedrock dependencies.

## Scope

In scope:

- Stage-plan builder for the V1 pre-Gateway proof path.
- V2/V3 stage-plan definitions may exist only as shared schema/contract scaffolding if useful, but deployed product behavior must not allow starting V2 or V3 runs before their owning stories.
- Stage runner that creates and updates `StageEvent` records.
- Tool request/response contracts and Zod validation.
- Deterministic development tool implementations used only to prove contracts before Gateway exists.
- Artifact and ledger draft persistence through repository interfaces.
- Development tool LedgerItems may record explicit tool/runtime/review estimates, but must not create `MODEL_INFERENCE` rows unless a real model is actually invoked.
- Run status transitions ending in `AWAITING_REVIEW` or `FAILED`.
- Idempotent runner writes for retried run starts and stage executions. A retry of the same stage execution must not create duplicate running/terminal `StageEvent` records, duplicate artifacts, or duplicate `LedgerItem` rows. Deliberate retry/remediation work must be represented as a distinct planned attempt or retry event with explicit ledger evidence.
- Review flow for `AWAITING_REVIEW` runs, including accept, reject, and escalate decisions, `ReviewDecision` records, `HUMAN_REVIEW` ledger rows, and job economics recalculation.
- Review decisions require positive reviewer seconds and create non-zero `HUMAN_REVIEW` ledger cost from the job's recorded `PriceBook` version and value model, not from whatever price book is active at review time.
- Review decisions must be transactionally guarded so a run can receive exactly one terminal reviewer decision and exactly one corresponding `HUMAN_REVIEW` ledger row.
- Honest product labeling that identifies any PR-011 run output as a pre-Gateway development proof, not evidence that the real V1 PDF workflow is complete.

## Non-Goals

- No AgentCore Runtime deployment.
- No AgentCore Gateway deployment.
- No Bedrock calls.
- No fake model inference costs.
- No real PDF translation quality claim.
- No product mode switch for replay, synthetic runs, live capture, recording, or presentation.
- No deployed V2 or V3 run execution before PR-014 and PR-015 respectively.
- No branch preview deployment.
- No V2 or V3 quality optimization claims.
- No claim that an accepted PR-011 development run is a real accepted translated PDF business outcome for V1.

## Deterministic Checks

- Unit tests for V1 stage-plan generation and any schema-only V2/V3 plan definitions that are intentionally not product-executable yet.
- Stage-runner tests proving each stage creates exactly one running event and one terminal event.
- Idempotency tests proving repeated run-start, stage-retry, and tool-result persistence attempts do not duplicate StageEvents, Artifacts, or LedgerItems for the same stage execution.
- Tool response validation tests for success and failure responses.
- Ledger tests proving tool/runtime/retry/review rows roll up correctly and no deployed `MODEL_INFERENCE` rows are created without real model calls.
- State-transition tests for `RUNNING -> EVALUATING -> AWAITING_REVIEW`, failure paths, and accept/reject/escalate review decisions.
- Review validation tests proving accept, reject, and escalate reject zero/missing reviewer seconds and create non-zero `HUMAN_REVIEW` cost when reviewer seconds are valid.
- Review price-book tests proving a price-book change between job creation and review does not reprice the review ledger row or job economics away from the job's recorded `priceBookVersion` and value model.
- Review concurrency/idempotency tests proving duplicate accept/reject/escalate submissions cannot create more than one `ReviewDecision`, more than one `HUMAN_REVIEW` ledger row, or contradictory terminal run/job states.
- API or integration tests proving `POST /api/jobs/{jobId}/runs` starts the runner and read endpoints expose persisted results.
- Variant gating tests proving deployed product/API behavior rejects or disables V2/V3 run starts until their owning stories implement them.
- UI/API tests proving PR-011 run outputs are labeled as pre-Gateway development proof and are not presented as real V1 PDF translation quality evidence.
- `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm cdk synth`.

## Deployed Verification

After merge, CI must deploy the merged SHA and produce the deploy artifact.

Because PR-010A has deployed the rendered app, Codex must use the deployed app for user-facing workflow steps and may use API calls only as supporting evidence:

1. Create or reuse a controlled document and job through the deployed app.
2. Start a V1 pre-Gateway proof run through the deployed app.
3. Poll or refresh the deployed app/API until the run reaches `AWAITING_REVIEW` or `FAILED`.
4. Verify the timeline has the expected V1 pre-Gateway stage sequence.
5. Verify artifacts and ledger rows were persisted from tool response drafts.
6. Repeat or retry the same run-start/stage persistence path in the supported validation manner and verify the repeated request does not duplicate StageEvents, Artifacts, or LedgerItems.
7. Verify the run evaluation is visible through the app and persisted through the API.
8. Verify attempts to start V2/V3 deployed runs are rejected or disabled until PR-014/PR-015.
9. Accept one V1 pre-Gateway proof run through the deployed app with positive reviewer seconds.
10. Repeat the same accept request or equivalent browser retry and verify the accepted job still has exactly one `ReviewDecision` and one non-zero `HUMAN_REVIEW` ledger row.
11. Verify the accepted job shows cost per verified outcome plus unit margin from the job's recorded price-book version and value model while labeling the execution basis as pre-Gateway development proof.
12. Reject or escalate a separate `AWAITING_REVIEW` run through the deployed app with positive reviewer seconds.
13. Verify the non-accepted decision creates a `ReviewDecision` and non-zero `HUMAN_REVIEW` ledger row, keeps consumed cost visible, and shows no verified outcome or unit margin.
14. Verify no `MODEL_INFERENCE` LedgerItem is created for the validation runs unless a real model call occurred.

The direct verification must label the execution backend honestly as a pre-Gateway development implementation path. It must not expose a user-selectable synthetic product mode.

## Telemetry Verification

Use merged SHA, deploy run ID, `validationRunId`, `runId`, and `jobId` as selectors.

Required when telemetry is queryable:

- Control API route signals for job/run/review requests.
- Stage-runner execution signal for the validation `runId`.
- No `MODEL_INFERENCE` ledger row without a corresponding model invocation signal.
- No unhandled runner exceptions.
- No duplicate terminal `StageEvent` records for a stage.
- No duplicate artifact or ledger records for a retried stage execution or duplicate review submission.

If telemetry is not queryable, record the blocker in `PLAN.md`.

## Acceptance Criteria

- PR is merged to `main`.
- Post-merge deployment succeeds and produces a deploy artifact.
- A deployed run reaches `AWAITING_REVIEW` through the stage runner.
- Deployed product/API behavior does not execute V2 or V3 runs before their owning stories.
- StageEvents, Artifacts, LedgerItems, and EvaluationResult are persisted and visible through API reads.
- Reviewer accept and non-accepted decisions create `ReviewDecision` and `HUMAN_REVIEW` ledger evidence.
- Runner retries and duplicate review submissions cannot duplicate StageEvents, Artifacts, LedgerItems, ReviewDecisions, or terminal states.
- Review decisions cannot make human review appear free through zero or missing reviewer seconds.
- Review costs use the job's recorded price-book version and value model, not the currently active price book at review time.
- Non-accepted runs show consumed cost but no verified outcome or unit margin.
- Economics remain ledger-derived.
- Economics do not include fake model inference costs.
- PR-011 output is labeled as pre-Gateway development proof and is not accepted as evidence that the real V1 PDF workflow works.
- The implementation introduces no replay, synthetic-run, live-capture, recording, or presentation mode.

## Review Traps

Reject or revise if the change:

- Adds a product-facing mode selector for fake execution.
- Allows deployed V2 or V3 run execution before PR-014 or PR-015.
- Uses an accepted PR-011 development run as proof that real V1 PDF translation works.
- Lets tools mutate `Run` directly instead of the stage runner owning transitions.
- Hides failed stages or failed attempts from costs.
- Allows acceptance before `AWAITING_REVIEW`.
- Allows accept, reject, or escalate decisions with zero or missing reviewer seconds.
- Allows duplicate reviewer submissions to create multiple terminal decisions or multiple `HUMAN_REVIEW` ledger rows.
- Reprices review or job economics with the current price book instead of the job's recorded `priceBookVersion`.
- Lets retried stage execution double-count artifact or ledger output for the same stage attempt.
- Creates ledger rows from logs instead of explicit tool/review outputs.
- Creates `MODEL_INFERENCE` rows from development tool proof data.
- Leaves reject/escalate behavior unverified.
- Hard-codes prices or model IDs.
