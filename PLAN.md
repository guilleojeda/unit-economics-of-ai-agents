# PLAN

## Objective

Implement `PR-012 - AgentCore Runtime And Gateway Infrastructure`: deployable AgentCore Runtime, Runtime Endpoint, AgentCore Gateway, Lambda-backed Gateway targets, and a Control API runtime client that starts runs through AgentCore instead of the PR-011 in-process runner.

## Current Slice

This branch implements the PR-012 proof path:

- Adds an `AgentCore` CDK stack in `us-east-1` with:
  - AgentCore Runtime backed by a TypeScript runtime container image asset.
  - AgentCore Runtime Endpoint using the `DEFAULT` qualifier.
  - AgentCore Gateway with AWS IAM authorization and MCP protocol configuration.
  - Three Lambda-backed Gateway target groups: `pdf-pipeline`, `translation`, and `evaluation`.
  - Scoped IAM for Control API -> Runtime, Runtime -> Gateway, Gateway -> Lambda, and Runtime/Lambda -> DynamoDB/S3.
- Adds `apps/agent-runtime`, a TypeScript AgentCore runtime app with a Strands-compatible agent layer and no model invocation.
- Adds `apps/gateway-tools`, a Lambda target that validates file-bearing Gateway requests, persists deterministic proof artifacts/stage events/ledger/evaluation output, and rejects raw PDF-byte inputs.
- Adds `packages/workflow` for the shared V1 stage plan, Gateway tool-name normalization, stable IDs, and deterministic proof output builders.
- Extends persisted provenance so runs, stages, artifacts, ledger rows, and evaluations can carry Runtime/Gateway/Lambda/build evidence.
- Switches deployed Control API context creation from the PR-011 pre-Gateway runner to `InvokeAgentRuntime`.
- Keeps local tests on injected/in-memory runtime clients where appropriate.
- Updates CI stack allowlists, deploy artifact content, data-protection validation, and infrastructure assertions for the new AgentCore stack.

## Non-Goals

- No Bedrock translation call.
- No real V1 PDF text extraction or recomposition quality claim.
- No fake `MODEL_INFERENCE` ledger rows.
- No V2/V3 execution.
- No AgentCore Memory or broad AgentCore Policy behavior.
- No local/manual AWS deployment.
- No product-facing fallback from deployed Control API back to the PR-011 pre-Gateway runner.

## Verification

Local verification completed on this branch:

- `pnpm install --no-frozen-lockfile`
- `pnpm typecheck`
- `pnpm test`
- `pnpm lint`
- `pnpm --filter @agentcore-pdf-translator/agent-runtime build`
- `pnpm --filter @agentcore-pdf-translator/agent-runtime deploy --legacy --prod /private/tmp/pr012-runtime-deploy`
- `pnpm ci:validate-workflow`
- `TMPDIR=/private/tmp pnpm cdk synth AgentCorePdfTranslator-dev-StorageStack AgentCorePdfTranslator-dev-DatabaseStack AgentCorePdfTranslator-dev-AgentCoreStack AgentCorePdfTranslator-dev-ControlApiStack AgentCorePdfTranslator-dev-FrontendStack -c stage=dev -c workspaceId=ci_dev -c activePriceBookVersion=ci_dev -c priceBookHumanReviewHourlyRateUsd=90 --output /private/tmp/pr012-cdk.out`
- `CDK_ASSEMBLY_DIR=/private/tmp/pr012-cdk.out node scripts/ci/validate-data-protection.mjs`

## Deployed Verification

PR-012 deployed verification is pending until this PR is merged and normal post-merge CI deploys the merged SHA.

Required post-merge checks:

1. Read the deploy artifact for the merged SHA and confirm AgentCore Runtime, Runtime Endpoint, Gateway, Gateway target, and tool Lambda outputs exist.
2. Use the protected deployed frontend to create or reuse the controlled document and V1 job.
3. Start a run through the deployed app.
4. Verify persisted run provenance shows `AGENTCORE_RUNTIME_GATEWAY`, not `PRE_GATEWAY_STAGE_RUNNER`.
5. Verify Runtime -> Gateway -> Lambda evidence exists for the validation run.
6. Verify Gateway requests use explicit artifact IDs/S3 keys and no raw PDF bytes.
7. Verify `StageEvent`, `Artifact`, `LedgerItem`, and evaluation records from the Gateway path are persisted.
8. Repeat the supported validation path for the same run/invocation identity and verify no duplicate product attempt or duplicate ledger/artifact evidence.
9. Verify no `MODEL_INFERENCE` ledger row exists unless a real model call is introduced.
10. Record sanitized Runtime, Gateway, Lambda, run, and log/query identifiers here after deployed verification.

Telemetry verification remains pending until the merged deployed environment is available and queryable with the deploy/run selectors.
