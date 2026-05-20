# PR-009 - CI-Backed AWS Dev Deployment Pipeline

This is the next implementation task.

No Persistent Control API, AgentCore Runtime, AgentCore Gateway, Bedrock call, PDF processing, frontend hosting, or additional product behavior may be accepted before this task is merged, deployed from `main`, and directly verified.

## Objective

Create the first CI-owned AWS dev deployment path for this repository so every later accepted delivery slice can be accepted only after its merged `main` SHA deploys to `us-east-1` and Codex directly uses the deployed app or API according to that slice's own requirements.

## Scope

PR-009 implements deployment plumbing, not product workflow behavior.

In scope:

- GitHub Actions or the repository's normal CI/CD system deploys accepted changes after they are merged to `main`.
- Deployment uses AWS CDK TypeScript and infrastructure as code.
- PR-009 proves post-merge dev deployment only. It does not create per-PR branch preview environments.
- The pipeline deploys the current dev stacks:
  - `AgentCorePdfTranslator-dev-StorageStack`
  - `AgentCorePdfTranslator-dev-DatabaseStack`
  - `AgentCorePdfTranslator-dev-ControlApiStack`
- The pipeline captures stack outputs needed for direct verification, including `ControlApiUrl`, `ControlApiLambdaName`, table names, and artifact bucket name.
- The pipeline produces a deploy artifact for the merged SHA.
- The deploy artifact records the exact AWS account ID, region, stage, and CI role/session identity used for deployment so later validation cannot accidentally use a wrong-account or wrong-environment stack.
- The deploy artifact, job summary, and `PLAN.md` evidence must be sanitized: no AWS credentials, OIDC tokens, auth headers, session cookies, secret values, full signed requests, or presigned URLs.
- The deployment foundation must preserve data-bearing resources. The artifact bucket and DynamoDB tables must retain product evidence across stack deletion/replacement where supported, and the deployment path must not introduce S3 object auto-delete, product-record TTL, or destructive cleanup behavior for documents, jobs, runs, StageEvents, Artifacts, LedgerItems, EvaluationResults, ReviewDecisions, PriceBooks, or AppSettings.
- The pipeline performs a post-deploy smoke check against the deployed Control API surface.
- Codex performs direct deployed verification after the PR is merged and the normal post-merge deployment is green.
- `PLAN.md` records deployment run URL, merged SHA, stack outputs used for verification, direct API/app evidence, telemetry status, and any blockers.
- If a post-merge deployment partially fails after changing AWS resources, `PLAN.md` records the failed run URL, failed stack/resource, observed AWS state, rollback or retry action taken through CI/IaC, and the final recovery evidence.

Out of scope:

- No Persistent Control API implementation.
- No product-facing fake data, fake run history, replay mode, synthetic-run mode, live-capture mode, recording mode, or presentation mode.
- No AgentCore Runtime or Gateway deployment.
- No Bedrock model invocation.
- No PDF extraction, translation, evaluation, or recomposition.
- No frontend hosting. Direct deployed verification uses the API until `PR-010A - Deployed frontend and dev access` exists.
- No per-PR branch preview deployments.
- No reusable deployed-validation framework or verifier script.
- No future slice-specific acceptance checks.
- No production deployment.

## Non-Negotiable Deployment Rules

- Deploy only through CI/CD and CDK/IaC.
- Do not run local `cdk deploy`.
- Do not manually trigger deployment workflows as the acceptance path.
- Do not manually modify AWS resources in the console or with ad hoc AWS CLI commands.
- Do not treat `pnpm cdk synth`, tests, logs, screenshots, or CloudFormation plans as deployed verification.
- Deploy the merged SHA from `main`; do not accept a branch-only deployment as the completion signal.
- Use `us-east-1`.
- Keep model IDs configurable. Do not introduce hard-coded model IDs.
- Use `PriceBook` configuration for cost assumptions. Do not introduce hard-coded prices.
- Do not use logs as the source of truth for product economics.

## Required CI Behavior

Pull request CI must continue to run deterministic verification:

```text
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm lint
pnpm cdk synth
```

Deployment must run only from the normal post-merge path for `main`.

The deploy job must:

1. Check out the merged SHA.
2. Install dependencies with the locked package manager.
3. Run typecheck, tests, lint, and CDK synth before deployment.
4. Configure AWS credentials through GitHub OIDC or the repository's approved CI identity.
5. Use GitHub Actions versions and Node.js runtime configuration that do not rely on the known deprecated Node.js 20 JavaScript-action runtime path. PR-009 must leave the deployment workflow without a current GitHub Actions runtime deprecation warning for the chosen action/runtime versions.
6. Deploy the dev stacks with CDK in dependency order or with an equivalent `--all` deployment that preserves dependencies.
7. Use explicit stage/config context for dev, including `stage=dev`.
8. Capture CloudFormation/CDK outputs as CI artifacts or job summary output.
9. Produce a deploy artifact for the merged SHA.
10. Run a post-deploy smoke check against the deployed Control API.
11. Fail the workflow if the synthesized data-bearing resources use destructive removal policy, S3 object auto-delete, product-record TTL, or another cleanup setting that could erase economics or artifact evidence without an explicit migration/retention story.
12. Fail the workflow if deployment, artifact generation, smoke verification, or deployment-runtime deprecation checks fail.
13. Expose enough failure output to identify which stack or smoke step failed without using the AWS console as the delivery path.

The deploy workflow must not rely on local scripts unless those scripts are invoked by CI. If a `scripts/ci-deploy-dev.sh` or equivalent script is added, its header must state that it is CI-invoked only and not a local delivery path.

## Required Deploy Artifact

PR-009 must produce a durable deploy artifact for the dev deployment. Prefer a machine-readable `deploy-artifact-dev.json` file uploaded as a GitHub Actions artifact; the same data may also be copied into the job summary for readability.

The deploy artifact must include at least:

- schema version
- repository
- environment or stage, with value `dev`
- AWS region, with value `us-east-1`
- AWS account ID
- CI deploy role ARN or assumed-role session identity, without secrets
- deployed commit SHA
- GitHub Actions run URL or equivalent CI run URL
- deployed stack names
- stack outputs used for verification, including `ControlApiUrl`
- post-deploy smoke check target
- post-deploy smoke check result
- deployment workflow/runtime versions relevant to future CI reproducibility, including Node.js/action runtime basis when available
- data-bearing resource retention/protection summary for the artifact bucket and DynamoDB tables
- artifact creation timestamp

The artifact is evidence for what CI deployed. It does not replace direct deployed use by Codex.

The deploy artifact and job summary must not contain secrets or transient access credentials. Role ARNs, account IDs, stack names, output names, endpoint URLs without credentials, request IDs, and status codes are acceptable; secret values, auth headers, OIDC tokens, cookies, AWS session credentials, full signed requests, and presigned URLs are not.

The deploy artifact identity and deployed commit SHA are also the provenance anchor for later persisted runs. PR-009 does not need to persist product runs, but the artifact shape must remain machine-readable enough for PR-011 and later stories to record which deployed build produced a run, stage, artifact, ledger row, or evaluation.

## AWS Prerequisites

PR-009 must either configure or clearly document these prerequisites:

- GitHub OIDC trust or equivalent CI identity for the repository.
- A CI deploy role for dev, such as the existing `PIPELINE_EXECUTION_ROLE` secret.
- If configured, the existing `CLOUDFORMATION_EXECUTION_ROLE` secret is used as the effective CDK deployment role after the OIDC pipeline role is assumed. This role must be assumable from the pipeline role and must have the CDK bootstrap/version, CloudFormation, asset publishing, stack output, smoke-check, and deploy-artifact upload permissions needed by the PR-009 workflow.
- A non-secret repository variable named `DEV_AWS_ACCOUNT_ID` containing the expected 12-digit AWS dev account ID. A repository secret with the same name is an accepted fallback when already configured, but the value is still treated as an account guard, not a credential. The deploy job must fail before CDK deployment if neither value is present or if the configured value does not match STS caller identity.
- A repository secret named `ARTIFACTS_BUCKET_NAME` identifying the S3 bucket where the sanitized deploy artifact is written. CI must not print this secret value.
- Role trust restricted to this repository and the intended branch/environment.
- AWS region fixed to `us-east-1`.
- CDK bootstrap status for the target account and region.
- Least-privilege deploy permissions where practical; any temporary broad permissions must be documented as temporary and reduced before production deployment.

If any prerequisite is missing, PR-009 is blocked. Do not mark it complete with a pretend deployment.

If deployment fails after mutating dev resources, the task remains blocked until the environment is recovered through CI/CD and CDK/IaC. Do not manually repair AWS resources as the completion path.

## Deployed Verification Surface

Before PR-010A frontend hosting exists, direct deployed verification may use the deployed Control API and stack outputs.

The current Control API is a placeholder. PR-009 must make that placeholder safely smoke-testable in dev by choosing one explicit path:

- Prefer an authenticated smoke request using AWS-signed CI or Codex credentials; or
- Use the existing dev-only `allowUnauthenticatedPlaceholderApi=true` context only while the API returns no product or customer data, and document that PR-010 must not expose real API behavior unauthenticated.

The smoke check should prove:

- The `ControlApiUrl` output exists.
- A deployed API route responds from AWS.
- The response identifies the API as not yet implemented and defers Persistent Control API behavior to `PR-010`.
- The response does not seed or expose fake product-facing runs, jobs, ledgers, or review decisions.

Once PR-010A frontend hosting exists, future deployed verification must include direct use of the rendered app for user-facing flows, not only API calls.

## Acceptance Criteria

PR-009 is accepted only when all of these are true:

- The PR is merged into `main`.
- The normal post-merge CI deployment for the merged SHA succeeds.
- A deploy artifact exists for the merged SHA and includes the required fields.
- The deploy artifact is machine-readable and contains a stable deployed-build identity that later run records can persist as implementation provenance.
- The deploy artifact identifies the deployed AWS account, region, stage, and CI role/session used for deployment.
- Deploy artifact, CI summary, and `PLAN.md` evidence are sanitized and do not contain secrets, credentials, auth headers, cookies, signed requests, or presigned URLs.
- The deploy workflow no longer emits the current GitHub Actions Node.js 20 deprecation warning for JavaScript actions.
- Data-bearing resource templates preserve product evidence with retained artifact bucket/table resources, S3 versioning, DynamoDB point-in-time recovery, and no product-record TTL or S3 object auto-delete for registered artifacts.
- AWS dev stacks exist in `us-east-1` and match the current CDK app.
- Stack outputs include at least:
  - `ArtifactBucketName`
  - all DynamoDB table names
  - `ControlApiUrl`
  - `ControlApiLambdaName`
- A post-deploy smoke check exercises the deployed Control API.
- Codex directly exercises the deployed API or app after the CI deployment and records the observed response/status.
- `PLAN.md` records:
  - PR URL
  - merged SHA
  - CI deployment run URL
  - deploy artifact location
  - deployed stack names
  - stack outputs used for verification
  - direct deployed verification command/action and observed result
  - telemetry verification status
  - rollback/retry evidence for any failed or partially failed deployment attempt
  - any unresolved blocker
- Persistent Control API work remains deferred to `PR-010`.

## Telemetry Requirements

PR-009 does not need full product telemetry, but it must state the telemetry status honestly.

If queryable telemetry exists for the smoke request, record:

- selector: merged commit SHA or CI run ID
- selector: AWS account ID, stage, and region from the deploy artifact
- selector: API request ID or Lambda request ID
- required signal: Control API Lambda invocation for the smoke request
- forbidden signal: Lambda error for the smoke request
- budget: smoke request completes without a 5xx response

If telemetry cannot be queried yet, record that as a blocker for telemetry verification. Do not claim telemetry verification succeeded.

## Review Guidelines

Reject or revise PR-009 if it:

- Adds a manual or local deployment path as the acceptance path.
- Requires a human to manually trigger deployment after merge.
- Treats a failed or partially failed post-merge deployment as acceptable because a later retry happened without recorded evidence.
- Deploys anything other than the merged SHA for completion evidence.
- Treats synth, logs, screenshots, or CI summaries as a substitute for direct deployed API/app use.
- Leaks secrets, AWS session credentials, auth headers, cookies, signed requests, or presigned URLs into deploy artifacts, CI summaries, logs, or `PLAN.md`.
- Uses destructive removal policies, product-record TTL, S3 object auto-delete, or cleanup behavior that can erase documents, jobs, runs, StageEvents, Artifacts, LedgerItems, EvaluationResults, ReviewDecisions, PriceBooks, AppSettings, or artifact object evidence.
- Implements Persistent Control API behavior before the deployment path is proven.
- Leaves placeholder API text pointing to `PR-009` for Persistent Control API.
- Seeds fake product-facing histories or introduces replay/synthetic/presentation behavior.
- Hard-codes model IDs or prices.
- Treats logs as the economics source of truth.

## Completion Gate For Later Slices

After PR-009 is complete, every later slice that changes deployed product, API, infrastructure, or runtime behavior must use this delivery loop:

```text
PR checks pass -> PR merged -> normal CI deploys merged SHA -> deploy artifact exists -> Codex uses deployed app/API according to that slice's requirements -> evidence recorded -> slice accepted
```

If that loop cannot run, the later slice is blocked. Do not downgrade completion to local checks. Later slices are responsible for defining their own deployed product/API validation requirements; PR-009 only creates the post-merge deployment and deploy-artifact foundation.
