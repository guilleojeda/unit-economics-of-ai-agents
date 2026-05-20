# PR-012 - AgentCore Runtime And Gateway Infrastructure

PR-012 starts only after PR-011 is deployed and directly verified. It moves workflow execution from the pre-Gateway runner path into AgentCore Runtime and AgentCore Gateway infrastructure.

## Objective

Deploy AgentCore Runtime, AgentCore Gateway, Gateway targets, and tool Lambda wrappers in `us-east-1`, then prove the deployed Control API can invoke AgentCore Runtime and persist tool results returned through Gateway.

## Scope

In scope:

- Agent runtime container build and deployment.
- AgentCore Runtime and Runtime Endpoint infrastructure.
- AgentCore Gateway infrastructure.
- Lambda-backed Gateway targets for PDF pipeline, translation, and evaluation tool groups.
- Gateway client wrapper and tool-name normalization.
- Control API invocation of AgentCore Runtime for run execution.
- Minimal real Gateway tool path sufficient to prove Runtime -> Gateway -> Lambda -> persistence.
- IAM permissions needed for Control API, runtime, Gateway, tool Lambdas, DynamoDB, S3, and logs.

## Non-Goals

- No real Bedrock translation calls.
- No full V1 PDF workflow.
- No irreversible PDF tool runtime choice that prevents PR-013 from selecting Python container Lambda or TypeScript Lambda based on real PDF tooling needs.
- No V2 or V3 behavior.
- No AgentCore Memory.
- No broad AgentCore Policy behavior unless required as a minimal infrastructure hook.
- No production deployment.
- No manual AWS resource changes.
- No replay mode, synthetic-run mode, live-capture mode, recording mode, or presentation mode.

## Deterministic Checks

- CDK assertions for Runtime, Runtime Endpoint, Gateway, Gateway targets, Lambda targets, IAM permissions, and stack outputs.
- Contract tests for Gateway request/response validation.
- Unit tests for tool-name prefix stripping and Gateway client errors.
- Integration tests for Control API run-start behavior using mocked runtime client.
- `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm cdk synth`.

## Deployed Verification

After merge, CI must deploy the merged SHA and produce the deploy artifact.

Codex must use the deployed app for user-facing workflow steps and may use API calls for infrastructure evidence:

1. Read deploy artifact and confirm Runtime, Gateway, and tool target outputs are present.
2. Create or reuse a controlled document and job through the deployed app.
3. Start a run through the deployed app.
4. Verify the Control API invokes AgentCore Runtime, not the pre-Gateway runner path.
5. Verify AgentCore Runtime loads the persisted document, job, run, and price book.
6. Verify AgentCore Runtime invokes at least one Gateway tool target.
7. Verify the tool target Lambda returns a schema-valid response.
8. Verify StageEvents, Artifacts, and LedgerItems from the Gateway path are persisted.
9. Verify CloudWatch logs exist for Control API, Runtime, Gateway, and invoked tool Lambda for the validation `runId`.

## Telemetry Verification

Use merged SHA, deploy run ID, `validationRunId`, `runId`, Runtime session/request ID, Gateway invocation ID, Lambda request ID, and trace ID when available.

Required when telemetry is queryable:

- Control API invocation of AgentCore Runtime.
- AgentCore Runtime execution for the validation `runId`.
- Gateway invocation for the validation `runId`.
- Tool Lambda invocation for the validation `runId`.
- No 5xx Control API response.
- No Gateway system error for the validation run.

If any AgentCore telemetry surface is not queryable yet, record the exact blocker in `PLAN.md`.

## Acceptance Criteria

- PR is merged to `main`.
- Post-merge CI deployment succeeds and produces a deploy artifact.
- AgentCore Runtime and Gateway resources exist in `us-east-1`.
- A deployed run exercises Control API -> AgentCore Runtime -> Gateway -> Lambda.
- Persisted StageEvents, Artifacts, and LedgerItems prove the Gateway path was used.
- Runtime/Gateway identifiers and relevant log links or query evidence are recorded in `PLAN.md`.

## Review Traps

Reject or revise if the change:

- Leaves Control API using the pre-Gateway runner path for acceptance evidence.
- Passes raw PDFs through AgentCore Runtime or Gateway requests.
- Uses hard-coded model IDs or prices.
- Uses manual AWS console setup.
- Locks PDF tooling into an implementation that contradicts the PR-013 PDF library/tool-runtime decision.
- Claims AgentCore telemetry success without queryable evidence.
- Treats logs as the source of truth for economics.
