# PR-012 - AgentCore Runtime And Gateway Infrastructure

PR-012 starts only after PR-011 is deployed and directly verified. It moves workflow execution from the pre-Gateway runner path into AgentCore Runtime and AgentCore Gateway infrastructure.

## Objective

Deploy AgentCore Runtime, AgentCore Gateway, Gateway targets, and tool Lambda wrappers in `us-east-1`, then prove the deployed Control API can invoke AgentCore Runtime and persist tool results returned through Gateway.

## Scope

In scope:

- Agent runtime container build and deployment.
- TypeScript Strands agent layer deployed to AgentCore Runtime, with the existing plain TypeScript stage-runner logic reused behind the Strands-compatible entrypoint.
- Persist AgentCore execution provenance on runs and stage outputs, including deployed commit SHA/build ID, runtime image tag/digest, Strands agent implementation label/version, Gateway target version, and tool Lambda version/alias when available.
- Persist or propagate deployed environment and validation evidence for Runtime/Gateway proof runs, including stage, region, AWS account ID, deploy artifact identity, and `validationRunId` when supplied. This evidence is only for correlation and must not create a product-facing execution mode.
- AgentCore Runtime and Runtime Endpoint infrastructure.
- AgentCore Gateway infrastructure.
- Lambda-backed Gateway targets for PDF pipeline, translation, and evaluation tool groups.
- Gateway client wrapper and tool-name normalization.
- Control API invocation of AgentCore Runtime for run execution.
- Minimal real Gateway tool path sufficient to prove Runtime -> Gateway -> Lambda -> persistence.
- Gateway tool requests that operate on files must pass explicit input artifact IDs and S3 keys, including source artifact identity/checksum when relevant. They must not rely only on a bare `documentId`, local file path, mutable display name, or raw PDF bytes to identify file inputs.
- Gateway proof LedgerItems may record real Gateway/tool/runtime estimates from explicit tool outputs, but must not create `MODEL_INFERENCE` rows unless a model is actually invoked.
- Idempotency and correlation for Runtime starts, Gateway calls, and Lambda target persistence. A Control API retry, Runtime retry, Gateway retry, or Lambda retry for the same `runId` and tool invocation identity must not create duplicate StageEvents, Artifacts, LedgerItems, or duplicate Runtime executions counted as separate product attempts unless a new `Run` was explicitly created.
- IAM permissions needed for Control API, runtime, Gateway, tool Lambdas, DynamoDB, S3, and logs.

## Non-Goals

- No real Bedrock translation calls.
- No fake model inference costs.
- No full V1 PDF workflow.
- No irreversible PDF tool runtime choice that prevents PR-013 from selecting Python container Lambda or TypeScript Lambda based on real PDF tooling needs.
- No V2 or V3 behavior.
- No AgentCore Memory.
- No broad AgentCore Policy behavior unless required as a minimal infrastructure hook.
- No deployed product fallback to the pre-Gateway runner path after Control API run execution is migrated to AgentCore Runtime. Local tests and development-only scaffolding may still use test doubles if they cannot be selected in deployed product behavior.
- No production deployment.
- No manual AWS resource changes.
- No replay mode, synthetic-run mode, live-capture mode, recording mode, or presentation mode.

## Deterministic Checks

- CDK assertions for Runtime, Runtime Endpoint, Gateway, Gateway targets, Lambda targets, IAM permissions, and stack outputs.
- Runtime packaging tests or build checks proving the deployed agent image contains the TypeScript Strands runtime entrypoint.
- Provenance tests proving Runtime/Gateway/Lambda execution records expose deployed commit/build, runtime image tag/digest, agent implementation label/version, Gateway target version, and tool Lambda version/alias when available.
- Environment/validation scoping tests proving Runtime/Gateway validation evidence cannot be satisfied by wrong-stage, wrong-account, wrong-workspace, or stale records.
- Contract tests for Gateway request/response validation.
- Contract tests proving file-bearing Gateway requests require explicit input artifact references and reject raw PDF bytes, local paths, arbitrary S3 keys, and documentId-only file input.
- Unit tests for tool-name prefix stripping and Gateway client errors.
- Integration tests for Control API run-start behavior using mocked runtime client.
- Idempotency tests proving repeated Control API run-start calls and repeated Gateway/Lambda tool invocation deliveries for the same invocation identity do not duplicate persisted workflow or economics records.
- `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm cdk synth`.

## Deployed Verification

After merge, CI must deploy the merged SHA and produce the deploy artifact.

Codex must use the deployed app for user-facing workflow steps and may use API calls for infrastructure evidence. Validation must use the current deploy artifact's frontend/API/Runtime/Gateway outputs, AWS account, region, stage, and a stable `validationRunId` or equivalent selector:

1. Read deploy artifact and confirm Runtime, Gateway, and tool target outputs are present.
2. Create or reuse a controlled document and job through the deployed app.
3. Start a run through the deployed app.
4. Verify the Control API invokes AgentCore Runtime, not the pre-Gateway runner path.
5. Verify the deployed runtime identifies the TypeScript Strands agent entrypoint and loads the persisted document, job, run, and price book.
6. Verify there is no deployed product flag, fallback, or error path that can silently route the validation run back to the pre-Gateway runner.
7. Verify AgentCore Runtime invokes at least one Gateway tool target.
8. Verify the tool target Lambda returns a schema-valid response.
9. Verify run, stage, artifact, and ledger records expose deployed commit/build, runtime image tag/digest, agent implementation label/version, Gateway target version, and tool Lambda version/alias when available.
10. Verify the Gateway request/response evidence for file-bearing tools includes explicit artifact IDs/S3 keys and does not pass raw bytes or infer inputs from a bare `documentId`.
11. Verify StageEvents, Artifacts, and LedgerItems from the Gateway path are persisted.
12. Retry or repeat the run-start/tool-delivery path in the supported validation manner and verify the same `runId` and invocation identity do not create duplicate StageEvents, Artifacts, LedgerItems, or product attempts.
13. Verify no `MODEL_INFERENCE` LedgerItem is created for the validation run unless a real model call occurred.
14. Verify CloudWatch logs exist for Control API, Runtime, Gateway, and invoked tool Lambda for the validation `runId`.

## Telemetry Verification

Use merged SHA, deploy run ID, `validationRunId`, `runId`, Runtime session/request ID, Gateway invocation ID, Lambda request ID, and trace ID when available.

Required when telemetry is queryable:

- Control API invocation of AgentCore Runtime.
- Environment/workspace evidence showing the validation run was produced in the deploy artifact's account, region, stage, and resolved workspace.
- AgentCore Runtime execution for the validation `runId`.
- Runtime signal identifying the Strands agent entrypoint or equivalent runtime build/version metadata for the validation run.
- Persisted implementation provenance for the validation `runId`, including deployed commit/build, runtime image tag/digest, agent implementation label/version, Gateway target version, and tool Lambda version/alias when available.
- Gateway invocation for the validation `runId`.
- Tool Lambda invocation for the validation `runId`.
- Gateway request validation evidence that file-bearing tool calls used explicit artifact references.
- No `MODEL_INFERENCE` ledger row without a corresponding model invocation signal.
- No 5xx Control API response.
- No Gateway system error for the validation run.
- No duplicate persisted records for repeated Runtime/Gateway/Lambda delivery of the same validation invocation identity.

If any AgentCore telemetry surface is not queryable yet, record the exact blocker in `PLAN.md`.

## Acceptance Criteria

- PR is merged to `main`.
- Post-merge CI deployment succeeds and produces a deploy artifact.
- AgentCore Runtime and Gateway resources exist in `us-east-1`.
- A deployed run exercises Control API -> AgentCore Runtime -> Gateway -> Lambda.
- The deployed runtime uses the TypeScript Strands agent layer.
- Deployed product behavior cannot silently fall back to the pre-Gateway runner path.
- Runtime/Gateway/Lambda execution provenance is persisted for the validation run.
- Runtime/Gateway validation evidence is tied to the current deployed account, stage, workspace, deploy artifact, and validation selector.
- File-bearing Gateway calls use explicit artifact IDs/S3 keys and never raw PDF bytes or documentId-only file inference.
- Persisted StageEvents, Artifacts, and LedgerItems prove the Gateway path was used.
- Runtime/Gateway/Lambda retries are idempotent for the same run and tool invocation identity.
- Economics do not include fake model inference costs.
- Runtime/Gateway identifiers and relevant log links or query evidence are recorded in `PLAN.md`.

## Review Traps

Reject or revise if the change:

- Leaves Control API using the pre-Gateway runner path for acceptance evidence.
- Leaves a deployed fallback path that can bypass AgentCore Runtime or Gateway for product runs.
- Implements the deployed agent runtime without the TypeScript Strands layer required by the ADRs.
- Omits deployed build, runtime image, Gateway target, or tool Lambda provenance from persisted run evidence.
- Lets wrong-stage, wrong-account, wrong-workspace, stale, or uncorrelated Runtime/Gateway records satisfy deployed verification.
- Passes raw PDFs through AgentCore Runtime or Gateway requests.
- Lets Gateway tools infer source or generated files from a bare `documentId`, display name, mutable object path, local path, or arbitrary S3 key instead of explicit authorized artifact references.
- Uses hard-coded model IDs or prices.
- Creates `MODEL_INFERENCE` rows from placeholder Gateway proof data.
- Double-counts Gateway, Lambda, artifact, or ledger output when Runtime or Gateway retries an invocation.
- Treats a duplicate Runtime start for the same `runId` as a separate business attempt instead of requiring a new explicit `Run`.
- Uses manual AWS console setup.
- Locks PDF tooling into an implementation that contradicts the PR-013 PDF library/tool-runtime decision.
- Claims AgentCore telemetry success without queryable evidence.
- Treats logs as the source of truth for economics.
