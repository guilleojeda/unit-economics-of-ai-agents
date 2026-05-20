# PLAN

## Objective

Implement PR-007: CDK storage/database/API basics for the unit-economics app, creating the AWS infrastructure shape for artifact storage, application tables, and a Control API HTTP surface without adding persistent application behavior yet.

## Scope and non-goals

In scope:

- Mark PR-006 complete and plan the next uncompleted build-order item.
- Keep `main` clean after the generated Next env-file fix.
- Rework `/infra` from the current empty foundation stack into a small CDK app structure that can grow into later stacks.
- Add stage-aware configuration, stage-specific stack names, and deterministic resource naming for `dev` by default, always targeting `us-east-1`.
- Validate stage names before they are used in stack names or resource names. Stage values must be lowercase, bucket-name safe, not begin or end with a hyphen, and no longer than 15 characters so the documented bucket-name pattern stays within S3's 63-character bucket-name limit.
- Add a private S3 artifact bucket stack:
  - bucket name pattern `agentcore-pdf-translator-{stage}-{accountId}-us-east-1`
  - public access blocked
  - bucket-owner-enforced object ownership
  - server-side encryption
  - HTTPS/TLS-only access enforced
  - versioning enabled
  - safe retention behavior by default
- Add separate DynamoDB tables for MVP clarity:
  - `Documents`
  - `TranslationJobs`
  - `Runs`
  - `StageEvents`
  - `Artifacts`
  - `LedgerItems`
  - `EvaluationResults`
  - `ReviewDecisions`
  - `PriceBooks`
  - `AppSettings`
- Add the documented primary keys, sort keys, and GSIs needed by the existing repository interfaces and future PR-008 DynamoDB repository implementations.
- Add one extra `PriceBooks` status index unless implementation updates the repository interface first. The existing `PriceBookRepository.getActive()` port cannot be implemented efficiently without either scanning or querying an index.
- Add a Control API Lambda infrastructure shell with environment variables for stage, workspace, bucket, and table names.
- Add API Gateway HTTP API route wiring for the documented Control API routes.
- Protect every HTTP API route with `AWS_IAM` authorization by default. Do not synthesize anonymous routes unless an explicit `allowUnauthenticatedPlaceholderApi=true` context/config value is provided for a documented local/dev-only reason.
- Model the documented routes as explicit HTTP API routes in PR-007. Do not replace them with a `$default` catch-all route unless this plan is updated with a concrete CloudFormation-size blocker and equivalent route-shape verification.
- Do not add CORS by default in PR-007. CORS belongs with a known frontend origin and real browser integration, not with a placeholder API.
- Add a placeholder Lambda handler. Prefer a self-contained inline Node.js handler for PR-007 so this slice does not introduce application bundling complexity before persistent behavior exists. The handler must return HTTP `501`, a structured JSON `NOT_IMPLEMENTED` error, `content-type: application/json`, no CORS headers, and no in-memory repositories as product behavior.
- Do not pre-grant DynamoDB/S3 data-plane permissions to the placeholder Control API Lambda just because PR-009 will need them later. PR-007 should attach only permissions required for the placeholder Lambda to run. PR-009 should add the specific table/object permissions when persistent handlers and presigned URL behavior exist. If implementation finds a concrete reason to attach any DynamoDB/S3 data-plane action in PR-007, record that reason in this plan and cover it with explicit positive and negative IAM assertions.
- Add CloudFormation outputs for resource names, table names, bucket name, API URL, and Control API Lambda name.
- Add infrastructure tests using CDK assertions to prove the synthesized template shape.
- Add the infra package test wiring needed for those assertions, including `test/**/*.ts` in TypeScript coverage like the other packages.
- Update `PLAN.md` progress/evidence during implementation.

Out of scope:

- DynamoDB repository implementations.
- S3 artifact repository implementations.
- Persistent Control API behavior.
- Real presigned upload/download URL generation.
- Document creation against DynamoDB/S3.
- PDF inspection, extraction, recomposition, or generated PDF output.
- AgentCore Runtime, AgentCore Gateway, Gateway targets, AgentCore Policy, or AgentCore Memory.
- Bedrock model calls or model configuration.
- Tool Lambdas for PDF, translation, or evaluation.
- Frontend rewiring to a deployed API.
- Seeded product data, fake documents, fake runs, fake ledgers, replay mode, synthetic-run mode, live-capture mode, recording mode, or presentation mode.
- Manual AWS console/resource edits.
- Manual deploys outside an existing CI/CD deployment workflow.

## Assumptions and open questions

- PR-006 is complete: PR #4 was merged to `main`, PR CI passed, and post-merge `main` CI passed.
- The generated Next env-file cleanup is complete: PR #5 was merged to `main`, PR CI passed, post-merge `main` CI passed, and `pnpm --filter @agentcore-pdf-translator/web build` leaves the worktree clean.
- The next uncompleted build-order item is PR-007, `CDK storage/database/API basics`, from `AGENTS.md`, `docs/codex/BUILD_ORDER.md`, and `docs/11-codex-implementation-brief-v1.0.md`.
- PR-007 should create deployable infrastructure shape, but not functioning product persistence. PR-008 owns DynamoDB/S3 repositories, and PR-009 owns persistent Control API behavior.
- The current repository has a CI-backed synth check, not a CI-backed deploy workflow. Deployed verification is therefore not available for PR-007 unless a deployment workflow is added before implementation.
- API Gateway HTTP API route authorization can protect the placeholder API without choosing production enterprise auth. AWS CloudFormation supports `AWS_IAM` as an authorization type for HTTP API routes, and local CDK exposes `HttpIamAuthorizer`.
- The API Gateway surface is internet-routable if deployed, so routes must not be anonymously callable by default even in `dev`. For PR-007, every route should use `AWS_IAM` authorization unless an explicit `allowUnauthenticatedPlaceholderApi=true` context/config value is provided for a documented local/dev-only reason. `prod` synth should fail if anonymous routes are enabled.
- PR-009 must not add persistent behavior behind an unauthenticated public API without first updating the plan and adding the chosen dev/prod access control.
- No Cognito/basic-auth/private-access decision has been made. Do not invent a production auth model in PR-007.
- The current docs mention optional bucket CORS for direct upload/download, but PR-007 has no real frontend upload/download integration. CORS should remain absent until PR-009 or later can restrict it to a known frontend origin and route behavior.
- The Control API Lambda should not call the PR-006 in-memory Control API dispatcher in a deployed environment. That would look like product behavior but lose data on cold start and violate the persistence sequence.
- The inline placeholder handler should be self-contained JavaScript compatible with Lambda inline code. It should not import workspace packages, depend on TypeScript transpilation, or rely on the repo's `"type": "module"` setting.
- DynamoDB composite GSI sort keys such as `createdAt#documentId` are physical persistence attributes, not domain schema fields. PR-008 repository mappers will populate them; PR-007 should document/assert table/index names and key attributes without changing domain schemas.
- Existing repository access patterns require table/query support for document lists, document jobs, comparison groups, status lists, job runs, run artifacts, document/job artifacts, job/run/document ledgers, run evaluations, job reviews, price books, and app settings.
- DynamoDB GSI projections must be sufficient for PR-008 repository list methods to return complete domain entities without an extra table read per row. Use `ALL` projection for PR-007 unless a narrower projection is explicitly mapped and tested.
- The existing `PriceBookRepository.getActive()` interface is still part of `/packages/data`. Because the documented `PriceBooks` table only has `priceBookVersion` as a key, PR-007 must either add a `byStatus` GSI or explicitly plan a PR-008 interface change before implementing DynamoDB repositories. Prefer adding `byStatus` now to avoid `Scan`.
- Use Lambda Node.js 24.x for the Control API shell unless implementation discovers a CDK or runtime blocker. AWS Lambda currently lists Node.js 24 as a supported runtime with a later projected deprecation date than Node.js 22, and the installed CDK package exposes `Runtime.NODEJS_24_X`.
- Do not configure `AWS_REGION` as a Lambda environment variable. Lambda defines `AWS_REGION` as a reserved runtime environment variable, so the handler should read it from the runtime environment instead of setting it in function configuration.
- `aws-cdk-lib` currently resolves to CDK v2.254.0 in the lockfile. Implementation should verify exact construct APIs locally and through official AWS CDK docs before relying on less common props.
- The current `/infra` package has no test script. PR-007 should add one so `pnpm test` includes CDK assertion tests.
- The current `/infra` `tsconfig.json` includes only `src/**/*.ts`. PR-007 must include `test/**/*.ts` or otherwise typecheck infrastructure tests, matching the existing package pattern.
- The documented API route count is small enough for explicit route resources. A `$default` catch-all route would make route coverage look present while losing route-shape proof, so do not use one in PR-007 unless this plan is updated for a concrete CloudFormation-size blocker.
- CDK synth should remain context-free for PR-007. Do not add environment lookups such as VPC or hosted-zone lookups, and do not introduce `cdk.context.json` as required state.
- PR-007 may grant the placeholder Lambda basic CloudWatch Logs permissions through the Lambda execution role because Lambda needs them to run. Do not grant DynamoDB/S3 data-plane, Bedrock, AgentCore, or tool invocation permissions.
- MVP infrastructure assumes a single default workspace (`ws_default`). Multi-workspace isolation is future scope, so PR-007 table design may carry `workspaceId` attributes and workspace list indexes without trying to solve production multi-tenant authorization.
- `PriceBooks.byStatus` makes active lookup queryable, but DynamoDB cannot enforce a single active price book through that GSI. PR-008 must define deterministic behavior for multiple active rows, such as treating it as configuration corruption or using `AppSettings.ACTIVE_PRICE_BOOK_VERSION` as the authoritative pointer.
- DynamoDB range keys that begin with numeric values must use padded numeric prefixes. Lexicographic sort order would otherwise put `10` before `2`, breaking run attempt, timeline, and ledger ordering in PR-008/009.

## Expected outcomes

- `pnpm cdk synth` produces a template containing a private encrypted versioned artifact bucket in `us-east-1`.
- The artifact bucket denies non-HTTPS requests and does not rely only on application callers to use TLS.
- The synthesized stack names and physical resource names are stage-specific, so `dev` and `prod` cannot accidentally share one CloudFormation stack identity.
- The synthesized template contains ten separate DynamoDB tables matching the documented entity boundaries, not a single-table design.
- DynamoDB tables use on-demand billing and point-in-time recovery.
- DynamoDB streams and TTL remain disabled for PR-007 business tables.
- Table keys and GSIs match the documented access patterns well enough that PR-008 can implement repositories without replacing the table design.
- `PriceBooks` supports active-price-book lookup without DynamoDB `Scan`.
- The synthesized template contains a Control API Lambda shell with environment variables for all table names, artifact bucket, `STAGE`, `WORKSPACE_ID`, and `ACTIVE_PRICE_BOOK_VERSION`. It must not attempt to configure reserved Lambda runtime variables such as `AWS_REGION`.
- The synthesized template contains an API Gateway HTTP API with the documented Control API routes wired to the Control API Lambda and protected by `AWS_IAM` by default.
- Stack outputs include at least:
  - `ArtifactBucketName`
  - all table names
  - `ControlApiUrl`
  - `ControlApiLambdaName`
- The Lambda shell returns an HTTP `501` structured `NOT_IMPLEMENTED` JSON response if invoked, instead of fake persisted data or in-memory product behavior.
- Infrastructure tests are part of the infra package test/typecheck path and root `pnpm test` execution.
- No raw PDF bytes are modeled in DynamoDB, Lambda event examples, API response examples, or outputs.
- No model IDs or prices are hard-coded.
- No economics behavior uses logs, CloudWatch, or runtime messages as the source of truth.
- No forbidden product modes are introduced.
- Existing application checks remain green.

## Product design

PR-007 is a platform-enabling slice. It should make the future deployed product possible without pretending the product workflow is already persistent.

The product model remains:

```text
Document -> TranslationJob -> Run -> StageEvents / Artifacts / LedgerItems -> EvaluationResult -> ReviewDecision -> Job economics
```

Infrastructure must preserve that model by giving each entity its own DynamoDB table for MVP clarity and by keeping artifact bytes in S3. DynamoDB stores metadata and normalized economics rows. S3 stores PDFs and generated artifact bytes. API, Lambda, AgentCore, and Gateway requests must pass artifact IDs and S3 keys, never raw PDFs.

The API surface should be present as infrastructure, but behavior should stay explicit about deferral. A deployed PR-007 Lambda may answer all routes with:

```json
{
  "error": {
    "code": "NOT_IMPLEMENTED",
    "message": "Persistent Control API behavior is deferred until PR-009",
    "details": {
      "deferredUntil": "PR-009"
    }
  }
}
```

That response is acceptable because it is honest and non-stateful. Returning in-memory documents, fake presigned URLs, or seeded product histories is not acceptable.

The HTTP API must not be anonymously callable by default. Use route-level `AWS_IAM` authorization for PR-007. This is a protective placeholder, not the final product authentication model. The later persistent API plan must revisit access control before adding stateful behavior or browser integration.

Stack structure should be simple enough to review but aligned with the documented future shape:

```text
infra/src/app.ts
infra/src/config.ts
infra/src/names.ts
infra/src/stacks/storage-stack.ts
infra/src/stacks/database-stack.ts
infra/src/stacks/control-api-stack.ts
infra/src/lambda/control-api-placeholder.ts
infra/test/infrastructure.test.ts
```

Stack names should include the stage, such as `AgentCorePdfTranslator-dev-StorageStack`, `AgentCorePdfTranslator-dev-DatabaseStack`, and `AgentCorePdfTranslator-dev-ControlApiStack`, so synthesizing another stage does not reuse the same CloudFormation stack identity.

This does not need to exactly match every future stack in `docs/07-infrastructure-cdk-spec-v0.6.md`; it should create the PR-007 resources cleanly and leave AgentCore, Gateway, tool Lambdas, and observability stacks for later slices.

The DynamoDB physical design should be explicit so PR-008 can implement repositories against it without redesign:

| Entity | Table key | Required GSIs |
| --- | --- | --- |
| `Documents` | PK `documentId` | `byWorkspace`: `workspaceId` / `createdAtDocumentId` |
| `TranslationJobs` | PK `jobId` | `byDocument`: `documentId` / `createdAtJobId`; `byComparisonGroup`: `comparisonGroupId` / `workflowVariantCreatedAtJobId`; `byStatus`: `status` / `updatedAtJobId` |
| `Runs` | PK `runId` | `byJob`: `jobId` / `attemptNumberPaddedCreatedAtRunId`; `byDocument`: `documentId` / `createdAtRunId`; `byStatus`: `status` / `updatedAtRunId` |
| `StageEvents` | PK `runId`, SK `sequencePaddedStageNameStageEventId` | none for PR-007 |
| `Artifacts` | PK `artifactId` | `byRun`: `runId` / `artifactTypeCreatedAtArtifactId`; `byDocument`: `documentId` / `artifactTypeCreatedAtArtifactId`; `byJob`: `jobId` / `createdAtArtifactId` |
| `LedgerItems` | PK `runId`, SK `stageSequencePaddedCreatedAtLedgerItemId` | `byJob`: `jobId` / `createdAtLedgerItemId`; `byDocument`: `documentId` / `createdAtLedgerItemId`; `byComponentType`: `componentType` / `createdAtLedgerItemId` |
| `EvaluationResults` | PK `runId`, SK `createdAtEvaluationResultId` | none for PR-007 |
| `ReviewDecisions` | PK `jobId`, SK `createdAtReviewDecisionId` | none for PR-007 |
| `PriceBooks` | PK `priceBookVersion` | `byStatus`: `status` / `updatedAtPriceBookVersion` |
| `AppSettings` | PK `settingKey` | none for PR-007 |

Composite attributes are persistence-layer fields. PR-007 should not add them to shared domain schemas unless PR-008 proves that shared persistence schemas are needed. Sort-key values with numeric prefixes must be zero-padded, for example `attemptNumberPadded#createdAt#runId`, `sequencePadded#stageName#stageEventId`, and `stageSequencePadded#createdAt#ledgerItemId`.

The HTTP API route list should match the documented Control API route shape:

```text
POST /api/documents/presign
POST /api/documents
GET  /api/documents
GET  /api/documents/{documentId}
POST /api/documents/{documentId}/inspect
GET  /api/documents/{documentId}/jobs
POST /api/documents/{documentId}/jobs
GET  /api/jobs
GET  /api/jobs/{jobId}
GET  /api/jobs/{jobId}/runs
GET  /api/jobs/{jobId}/ledger
GET  /api/jobs/{jobId}/economics
POST /api/jobs/{jobId}/runs
GET  /api/runs/{runId}
GET  /api/runs/{runId}/timeline
GET  /api/runs/{runId}/artifacts
GET  /api/runs/{runId}/evaluation
GET  /api/runs/{runId}/ledger
POST /api/runs/{runId}/review
GET  /api/compare
GET  /api/price-books/current
PUT  /api/price-books/current
```

## Deterministic checks

Required local checks:

- `pnpm install --frozen-lockfile`
- `pnpm --filter @agentcore-pdf-translator/infra typecheck`
- `pnpm --filter @agentcore-pdf-translator/infra test`
- `pnpm typecheck`
- `pnpm test`
- `pnpm lint`
- `pnpm cdk synth`

Targeted infrastructure assertions to add:

- The stack region is `us-east-1`.
- Stack names and physical resource names include the configured stage.
- The artifact bucket blocks public access, uses encryption, enables versioning, enforces bucket-owner object ownership, and is retained by default.
- The artifact bucket policy denies requests where `aws:SecureTransport` is `false`.
- Exactly ten application DynamoDB tables are present.
- Each table has the expected partition key and, where documented, sort key.
- Numeric-leading DynamoDB sort key attributes use padded prefixes for attempt numbers, stage-event sequences, and ledger stage sequences.
- Required GSIs are present for workspace lists, document jobs, comparison groups, statuses, job runs, document runs, artifact lookups, ledger rollups, component-type queries, evaluations, and review decisions.
- Required GSIs project all attributes unless implementation documents and tests a narrower projection that still satisfies repository list methods.
- `PriceBooks` has a status index so active lookup can avoid table scans.
- DynamoDB tables use pay-per-request billing.
- DynamoDB tables enable point-in-time recovery.
- DynamoDB tables do not enable streams or TTL in PR-007.
- DynamoDB tables use safe removal behavior, and prod table synthesis enables deletion protection.
- The Control API Lambda uses the selected supported Node.js runtime and has all required custom environment variables.
- The Control API Lambda environment does not include reserved Lambda runtime keys such as `AWS_REGION`.
- The placeholder Lambda uses self-contained inline JavaScript and does not import workspace packages or require TypeScript bundling.
- The placeholder Lambda response body is JSON-stringified and has API Gateway-compatible `statusCode`, `headers`, and `body` fields, with status `501`, JSON content type, and no CORS headers.
- The placeholder Control API Lambda has no Bedrock, AgentCore, tool Lambda, VPC, broad admin, or future data-plane permissions that it does not use. Basic CloudWatch Logs execution permissions are allowed and must not be mistaken for product telemetry or economics evidence.
- Lambda invoke permissions for API Gateway are scoped to the synthesized HTTP API execution ARN, not a broad principal without source constraints.
- IAM assertions should verify that PR-007 does not grant DynamoDB data-plane actions such as `GetItem`, `PutItem`, `UpdateItem`, `Query`, `BatchGetItem`, `Scan`, or `DeleteItem` unless implementation records a concrete reason in this plan.
- IAM assertions should verify that PR-007 does not grant S3 object data-plane actions such as `PutObject`, `GetObject`, `HeadObject`, or `DeleteObject` unless implementation records a concrete reason in this plan.
- The API Gateway HTTP API has all documented routes.
- The API Gateway HTTP API does not use a `$default` catch-all route as a substitute for the documented route list.
- The API Gateway HTTP API routes use `AWS_IAM` authorization by default and do not synthesize anonymous `NONE` authorization unless an explicit documented override is enabled. `prod` synth must fail if anonymous route authorization is enabled.
- The synthesized HTTP API has no permissive CORS configuration in PR-007.
- Stack outputs include bucket, table, Lambda, and API values needed by later application wiring.
- The synthesized template contains no AgentCore, Gateway, Bedrock, tool Lambda, VPC, Cognito, fake seed data, replay, synthetic, live-capture, recording, or presentation resources.
- The CDK app does not require AWS context lookups or a committed `cdk.context.json` to synthesize.
- The infra package test script runs CDK assertion tests, and infra TypeScript coverage includes `test/**/*.ts`.
- Running the web build after the env-file fix leaves the worktree clean if web checks are touched by CI.

Scope-control checks before commit:

- `git status --short`
- `git diff --cached --name-status`
- `git diff --cached --check`

## Deployed verification

Not available for the current PR-007 plan because the repository currently has CI for install/typecheck/test/lint/synth, not CI-backed deployment.

Do not manually deploy or manually modify AWS resources for PR-007. If a CI-backed deployment workflow is introduced before implementation, update this plan before coding and add deployed verification that directly inspects the deployed stack outputs/resources in `us-east-1`.

## Telemetry verification

Not applicable for PR-007 as planned. No deployed runtime path, AgentCore telemetry, CloudWatch application signal, or product request flow is introduced.

Do not claim telemetry verification. If implementation adds deployed Lambda execution or logs for a smoke check, record only that the logs exist for debugging; do not use logs as an economics source of truth.

## Implementation steps

1. Prepare implementation context.
   - Done when `main` is current, the worktree is clean, branch `codex/cdk-storage-database-api` exists, and the implementation skills required for infrastructure/backend TypeScript/testing/security are loaded.

2. Verify current AWS/CDK construct details.
   - Done when implementation has checked local `aws-cdk-lib` APIs and official AWS documentation for S3 bucket props, DynamoDB table/index props, Lambda Node.js runtime, Lambda function constructs, and API Gateway HTTP API Lambda integration.

3. Add infra config and naming helpers.
   - Done when stage, region, workspace ID, active price-book version placeholder, stage-specific stack names, resource prefix, stage validation, anonymous-route override guard, and output naming are centralized and covered by simple tests where useful.

4. Add storage stack.
   - Done when the artifact bucket is synthesized with the required security/storage settings and outputs.

5. Add database stack.
   - Done when all ten DynamoDB tables and required GSIs are synthesized with stable names, billing mode, PITR, safe retention settings, padded numeric sort-key attributes, and complete GSI projections, including `PriceBooks.byStatus` unless the data repository interface is revised before implementation.

6. Add Control API Lambda shell.
   - Done when the Lambda is synthesized with required custom environment variables, does not configure reserved runtime keys such as `AWS_REGION`, and has a self-contained inline placeholder handler that returns HTTP `501` structured `NOT_IMPLEMENTED` JSON without in-memory product behavior or CORS headers. Prefer inline code for this shell unless implementation finds a strong reason to introduce `NodejsFunction` now.

7. Add API Gateway HTTP API wiring.
   - Done when documented routes are explicit `AWS::ApiGatewayV2::Route` resources integrated with the Control API Lambda shell, use `AWS_IAM` authorization by default, have no `$default` catch-all substitute, have no default CORS, and fail `prod` synth if anonymous route authorization is explicitly enabled.

8. Add IAM grants and outputs.
   - Done when the Control API role has only permissions needed by the placeholder Lambda, no unused DynamoDB/S3 data-plane access, no AgentCore/Bedrock/tool permissions, API Gateway invoke permission scoped to the HTTP API, and outputs expose the values needed by later slices.

9. Add CDK assertion tests and run deterministic checks.
   - Done when infra has a `test` script, infra tests are included in TypeScript coverage, targeted infra tests pass, and the required root checks pass locally.

10. Review against product and architecture guardrails.
    - Done when the change is checked for forbidden modes, fake persistence, raw PDF payloads, hard-coded prices/model IDs, log-derived economics, overbroad IAM, unintended public prod exposure, and PR-008/009 scope creep.

11. Publish and complete through PR.
    - Done when intended files are staged, committed, pushed, a pull request is opened, PR CI is green, the PR is merged, post-merge `main` CI is green, and `PLAN.md` records final evidence and any blockers.

## Risks and constraints

- PR-007 can easily drift into PR-008/009. Avoid repository implementations, S3 object operations, presign logic, and persistent API handlers.
- A placeholder Lambda can become fake product behavior. It must return structured `NOT_IMPLEMENTED` and should not use in-memory repositories in deployed infrastructure.
- An inline Lambda can accidentally depend on the repo's TypeScript/ESM setup even though inline Lambda code is deployed as plain JavaScript. Keep the placeholder self-contained and verify the synthesized inline code shape.
- API Gateway HTTP APIs are internet-routable when deployed. Use `AWS_IAM` route authorization by default for PR-007 and do not create anonymous routes without an explicit documented local/dev-only override.
- Persistent Control API behavior must not be added behind an unauthenticated endpoint in a later PR by inertia from this slice. Treat PR-007's IAM-protected placeholder as a temporary infrastructure shell, not a final auth model.
- CORS is easy to over-permit and hard to unwind once frontend code depends on it. Do not configure CORS until a real frontend origin and real API behavior exist.
- S3 bucket privacy settings do not by themselves reject plaintext transport. Enforce HTTPS/TLS-only access with an `aws:SecureTransport` deny policy.
- DynamoDB GSI design can block PR-008 if composite keys are vague. Name physical composite attributes explicitly and leave mapper responsibility clear.
- DynamoDB GSI projection can create hidden N+1 read behavior in PR-008. Use `ALL` projection for repository-list GSIs unless a narrower projection is deliberately designed and tested.
- The documented `PriceBooks` table shape conflicts with the existing repository `getActive()` method. Add a status index now or explicitly change that interface before implementing PR-008.
- Overbroad IAM would conflict with least-privilege ADRs. In PR-007, do not grant future artifact bucket/table data-plane access to the placeholder Lambda; when PR-009 adds real handlers, grant only the specific artifact bucket/table actions those handlers need.
- Pre-granting future DynamoDB/S3 data-plane access to a placeholder Lambda creates unnecessary blast radius. PR-007 should avoid table/object data-plane actions unless there is a concrete reason recorded in this plan.
- Broad CDK helper grants can silently include actions the Control API does not need yet. Prefer no data-plane grants for the placeholder and explicit IAM policy statements when PR-009 adds real persistence behavior.
- CloudWatch Logs basic execution permissions are expected for Lambda, but they are debugging/operations permissions only. Do not classify logs as product telemetry verification or economics evidence.
- Lambda permissions that allow API Gateway to invoke the placeholder should be source-scoped to the HTTP API execution ARN. Overbroad `lambda:InvokeFunction` permissions create avoidable cross-service blast radius.
- Hard-coded bucket names can collide across accounts/stages. Include stage, account, and region in the name pattern.
- Reusing one CloudFormation stack name across stages would make `dev` and `prod` compete for the same stack identity even when physical resource names include stage. Include stage in stack IDs/names.
- Invalid or overly long stage values can produce invalid bucket names or route future environments into the wrong naming convention. Validate stage input before stack construction, including length under the full bucket-name pattern.
- CDK defaults can be unsafe or noisy. Assert public access block, encryption, retention, PITR, and route outputs explicitly.
- DynamoDB deletion protection and removal policy are separate controls. Use safe retention behavior by default and assert prod deletion protection explicitly.
- DynamoDB TTL would be dangerous for business records because it could delete the ledger/evaluation/review evidence needed for economics. Streams add downstream behavior and cost not needed in PR-007. Keep both disabled until a later plan explicitly needs them.
- DynamoDB sort keys are lexicographic. Numeric-leading composite keys must be padded or PR-008/009 list operations will produce wrong attempt, timeline, and ledger ordering after sequence 9.
- Lambda reserves `AWS_REGION` and other runtime environment keys. Do not configure reserved keys in the Lambda environment, even if docs list them as runtime variables.
- A `$default` HTTP API route can hide missing route resources. PR-007 should prove the documented route surface explicitly.
- CDK context lookups would make synth depend on account state and generated context files. PR-007 should not introduce AWS lookups or `cdk.context.json`.
- Infra tests can silently be skipped by root checks if `/infra` lacks a `test` script or excludes tests from TypeScript coverage. Add package-level test wiring.
- Node runtime choices can become stale. Use a currently supported Lambda runtime and document why.
- Adding a Lambda bundling path can alter the lockfile or require `esbuild`. Run frozen install and CI-equivalent checks.
- `cdk.out`, `.next`, and `node_modules` are generated/ignored. Do not stage them.
- No deployed verification is possible without a deploy workflow. Record that honestly instead of treating synth as deployment proof.

## Rollback and recovery notes

- If PR-007 is not deployed, rollback is a normal code revert of infra source, infra tests, lockfile/package metadata if changed, and `PLAN.md`.
- If a future deploy workflow is added before or during PR-007, verify CDK bootstrap state in the target account and `us-east-1` before deploying.
- If PR-007 is deployed and then rolled back, retained S3 buckets and DynamoDB tables may remain by design. Do not auto-delete artifact buckets or business tables in rollback automation; record retained resource names and require explicit cleanup approval.
- If the deterministic bucket name collides in an AWS account, do not loosen bucket privacy settings or switch to a random name silently. Update the naming config and outputs deliberately so PR-008/009 can still discover the bucket.
- If API Gateway exposure is deemed unacceptable even with `AWS_IAM` route authorization, remove API stages from the deployable stack and keep route-shape assertions in tests until an access-control decision exists.
- If the anonymous-placeholder override is ever used for local/dev work, record the reason, ensure it is disabled for `prod`, and remove it before adding persistent behavior.
- If stage-specific stack names are changed after deployment, treat that as a migration rather than a normal rename. Record the old stack names and retained resources before deploying the renamed stacks.

## Adversarial assumption review

| Assumption | Supporting evidence | What could make it false | What breaks if false | Plan change |
| --- | --- | --- | --- | --- |
| PR-007 is the next correct slice. | `AGENTS.md`, `BUILD_ORDER.md`, and implementation brief list PR-007 after PR-006. | Milestone 2 acceptance criteria could be interpreted as requiring full persistence now. | Scope balloons into PR-008/009 and becomes harder to verify safely. | Plan explicitly limits PR-007 to infrastructure shape and defers repositories/persistent API. |
| Infrastructure shape alone is useful. | PR-008/009 need S3, tables, API, Lambda, IAM, and outputs to exist. | If table/index/API shape is wrong, PR-008 must redesign it. | Infrastructure PR creates churn instead of a stable base. | Add exact keys, GSI names, route list, outputs, and assertion tests. |
| The existing repository interfaces are complete enough to drive table design. | `/packages/data` defines current repository ports. | `PriceBookRepository.getActive()` lacks a query path in the documented table design. | PR-008 either scans or changes tables after PR-007. | Add `PriceBooks.byStatus` unless the interface is revised first. |
| Composite key attributes can stay persistence-only. | Domain schemas should represent product entities, not DynamoDB implementation details. | Shared schemas might later be used directly for DynamoDB item validation. | Repository mappers become ambiguous or duplicate schema logic. | Plan names composite attributes and defers persistence schemas to PR-008 if needed. |
| `AWS_IAM` route authorization is an acceptable PR-007 placeholder protection. | Repo docs require dev protection but defer production-grade auth; CloudFormation supports `AWS_IAM` for HTTP API routes; local CDK exposes `HttpIamAuthorizer`. | Browser integration may later need Cognito/basic auth/private access instead. | Frontend or PR-009 persistence could be blocked or accidentally made anonymous. | Use `AWS_IAM` only for PR-007 route protection, treat it as temporary, and require PR-009 to revisit access control before persistent behavior. |
| Anonymous placeholder routes should not be the default. | `docs/07-infrastructure-cdk-spec-v0.6.md` says dev should be protected and prod should not be public without auth. | A local-only smoke test may require an unauthenticated endpoint. | An anonymous endpoint becomes a precedent for persistent API behavior. | Require explicit `allowUnauthenticatedPlaceholderApi=true` for anonymous routes and fail `prod` synth if it is enabled. |
| CORS can be omitted in PR-007. | No real browser upload/download/API integration is in scope. | A future frontend integration expects permissive CORS. | Developers add wildcard CORS now and create a bad default. | Explicitly require no default CORS in PR-007. |
| Inline Lambda is enough. | Placeholder response is tiny and avoids bundling complexity. | Inline code grows beyond CloudFormation inline limits, imports workspace packages, or depends on TypeScript/ESM behavior. | Synth/deploy fails or PR-007 sneaks in application bundling. | Prefer self-contained inline JavaScript for PR-007; only introduce `NodejsFunction` with recorded reason. |
| Node.js 24 is safe. | AWS Lambda docs list Node.js 24, local CDK exposes `Runtime.NODEJS_24_X`. | Target account/region or CDK synthesis has a runtime support issue. | Lambda deployment fails. | Verify locally and via docs before implementation; allow fallback if blocker is recorded. |
| The CI-backed workflow is synth-only. | `.github/workflows/ci.yml` runs install/typecheck/test/lint/synth, not deploy. | A hidden or new deploy workflow appears. | Plan would under-specify deployed verification. | Require plan update and deployed resource verification if deploy workflow is introduced. |
| CDK assertions can prove the slice. | PR-007 is template/resource shape only. | Important behavior depends on deployed AWS service defaults not visible in template. | False confidence from synth-only proof. | Assertions cover security settings, IAM, routes, outputs, and explicit no-deploy limitation. |
| The placeholder Lambda should not receive future data-plane permissions. | PR-007 behavior is only `NOT_IMPLEMENTED`, so DynamoDB/S3 read/write permissions are unused. | Implementation might pre-grant PR-009 permissions for convenience. | A deployed placeholder has unnecessary ability to read/write business tables or artifacts. | Do not attach DynamoDB/S3 data-plane permissions in PR-007 unless a concrete reason is recorded; add negative IAM assertions. |
| Resource retention is safe by default. | Business artifacts and tables should not be destroyed accidentally. | Dev stacks accumulate retained resources or bucket name collisions. | Rollbacks/deletes leave confusing resources. | Add rollback notes for retained resources and collision handling. |
| `AWS_REGION` can be treated as available to Lambda without configuring it. | AWS Lambda docs define `AWS_REGION` as a reserved runtime environment variable that cannot be set in function configuration. | Implementation follows the infra spec literally and sets `AWS_REGION` as a custom env var. | Lambda deployment fails on reserved environment key configuration. | Assert that custom Lambda environment excludes `AWS_REGION`; handler should read runtime-provided region. |
| `PriceBooks.byStatus` is enough for active lookup infrastructure. | It gives PR-008 a query path for `getActive()` without `Scan`. | Multiple `ACTIVE` price books exist because DynamoDB cannot enforce uniqueness on this GSI. | `getActive()` becomes nondeterministic and economics use the wrong prices. | Plan records that PR-008 must define conflict behavior or use `AppSettings.ACTIVE_PRICE_BOOK_VERSION` as the authoritative pointer. |
| Stage names can safely feed resource names after validation. | The bucket pattern is documented and includes stage/account/region. | A long or malformed stage creates an invalid S3 bucket name. | Synth or deploy fails, or future stacks use inconsistent names. | Validate lowercase, hyphen placement, bucket-safe characters, and maximum length under the full bucket pattern. |
| Stack names can stay generic while resource names include stage. | Current foundation stack has one generic stack name. | Synthesizing `dev` and `prod` with the same stack IDs makes them compete for one CloudFormation stack identity. | A deployment can update the wrong environment or force replacements under the same stack. | Include stage in stack IDs/names and treat later renames as migrations. |
| DynamoDB composite sort keys will preserve numeric order. | Documentation requires sequence-based sort keys for runs, stage events, and ledger rows. | Numeric prefixes are not zero-padded. | Lexicographic ordering puts `10` before `2`, breaking attempt lists, timelines, and ledgers. | Require padded numeric prefixes in sort-key attribute names/value formats and assertions. |
| GSI presence alone is enough for repository list methods. | The planned GSIs cover access patterns. | GSIs are created with narrow projections that do not include full entity attributes. | PR-008 has to issue N+1 base-table reads or cannot return complete domain entities. | Require `ALL` GSI projection unless a narrower projection is mapped and tested. |
| Explicit routes are not necessary if Lambda handles dispatch. | The existing Control API dispatcher can route internally. | A `$default` API route hides missing API Gateway route shape. | CDK tests pass while deployed API lacks the documented route resources and auth configuration per route. | Require explicit HTTP API routes and assert no `$default` catch-all substitute in PR-007. |
| CDK synth will stay deterministic without extra constraints. | The current infra app has no lookups. | Implementation adds VPC/hosted-zone/account lookups or commits `cdk.context.json`. | Local and CI synth depend on mutable AWS account state. | Forbid context lookups and `cdk.context.json` in PR-007. |
| Infra tests will automatically run once written. | Root `pnpm test` runs package test scripts, but `/infra` currently has no test script and excludes tests from `tsconfig`. | Tests are added but not wired into package scripts or typecheck. | Route/table/IAM regressions are not exercised in CI. | Add infra `test` script and include `test/**/*.ts` in TypeScript coverage. |
| Lambda permissions are harmless if generated by integrations. | CDK integrations often create permissions automatically. | Generated permission uses a broad source ARN or principal. | Any route/API in the account can invoke the placeholder Lambda. | Assert Lambda invoke permission is scoped to the HTTP API execution ARN. |
| CloudWatch Logs permissions can be grouped with forbidden telemetry. | Logs are not economics truth and telemetry verification is not applicable. | Tests forbid all extra IAM and accidentally block Lambda basic execution, or logs are treated as product evidence. | Lambda cannot run or completion overclaims telemetry proof. | Allow basic CloudWatch Logs execution permissions only, and keep logs classified as debugging evidence. |
| DynamoDB TTL and streams can stay at defaults without assertions. | CDK defaults are usually disabled. | A helper construct enables TTL or streams accidentally. | Business evidence can expire, or downstream behavior/cost appears before any consumer exists. | Assert TTL and streams remain disabled for PR-007 tables. |
| S3 private/encrypted settings are enough for artifact transport security. | Bucket is private, encrypted, and public access blocked. | A caller uses plaintext HTTP transport to S3. | Sensitive artifact bytes can traverse without TLS. | Add an `aws:SecureTransport=false` deny bucket policy assertion. |
| A generic not-implemented response is enough. | PR-007 behavior is intentionally deferred. | Lambda returns `200`, HTML/text, CORS headers, or an unstructured body. | Clients or tests mistake deferred behavior for success, or CORS defaults leak into later browser work. | Require HTTP `501`, JSON content type, structured `NOT_IMPLEMENTED`, and no CORS headers. |
| No raw PDFs are passed through API/Lambda. | ADR-011 requires artifact references and S3 keys. | Placeholder examples or tests include raw PDF bodies. | Later implementations copy the wrong payload pattern. | Plan asserts no raw PDF bytes in examples, responses, or Lambda payloads. |
| No hard-coded model IDs/prices are needed. | PR-007 has no Bedrock or price-book seeding behavior. | Environment placeholders tempt default model IDs/prices. | Config becomes product behavior before decisions are made. | Keep model config and prices out of PR-007. |
| No telemetry verification is applicable. | No deployed runtime or product flow is introduced. | Lambda logs are created and mistaken for proof. | Logs become falsely treated as product/economics evidence. | Plan says logs are debugging only and not economics truth. |
| No AgentCore/Gateway/tool resources belong here. | Build order reserves those for later slices. | Infra implementer follows full CDK spec instead of PR scope. | AgentCore complexity lands before storage/API basics are stable. | Add negative assertions for AgentCore, Gateway, Bedrock, tool Lambda, VPC, Cognito. |

Failure imagined after implementing the previous plan:

- PR-008 tries to implement `PriceBookRepository.getActive()` and either scans the `PriceBooks` table or has to alter the PR-007 table. Root weakness: no status index for a current repository method. Prevented by adding `PriceBooks.byStatus`.
- PR-009 adds real persistent handlers behind an anonymous API created by PR-007. Root weakness: placeholder public API was not protected even though repo docs require dev protection. Prevented by default `AWS_IAM` route authorization, anonymous override guardrails, and explicit PR-009 access-control review.
- A frontend developer later depends on wildcard CORS because PR-007 added it casually. Root weakness: CORS was treated as harmless infrastructure. Prevented by no default CORS in PR-007.
- CI passes synth, but deployment fails because retained bucket/table resources collide with prior dev stacks. Root weakness: rollback and deterministic naming collision handling were missing. Prevented by rollback notes and explicit collision handling.
- IAM grants include `Scan`, `DeleteItem`, or `DeleteObject`, and later code starts relying on broad access. Root weakness: least privilege was stated but not testable. Prevented by explicit IAM action guidance and negative assertions.
- Deployment fails because the Lambda configuration sets `AWS_REGION` as a custom environment variable. Root weakness: the plan copied runtime variables from the infra spec without checking Lambda reserved environment keys. Prevented by excluding `AWS_REGION` from custom environment and reading the runtime-provided value.
- A deployed placeholder Lambda is compromised and can read/write S3 artifacts or DynamoDB rows despite having no real behavior. Root weakness: PR-007 pre-granted PR-009 data-plane permissions too early. Prevented by no future data-plane grants in PR-007.
- PR-008 queries stage events and ledger rows for a run and the timeline shows stage 10 before stage 2. Root weakness: numeric-leading DynamoDB sort keys were not explicitly padded. Prevented by padded attempt/stage sort-key requirements and assertions.
- A PR adds infra tests, but `pnpm test` never runs them because `/infra` still lacks a test script and `tsconfig` excludes `test/**/*.ts`. Root weakness: verification assumed test files are automatically discovered. Prevented by infra package test/typecheck wiring requirements.
- A deployed API has a single `$default` route with internal Lambda dispatch, so route-level IAM/CORS/route assertions do not prove the documented API surface. Root weakness: route shape was delegated entirely to Lambda. Prevented by explicit route resources and a no-`$default` assertion.
- A prod deploy uses the same CloudFormation stack name as dev with a different stage context. Root weakness: resource names were stage-aware but stack identities were not. Prevented by stage-specific stack names and migration notes for later renames.
- Local synth works only after `cdk.context.json` is generated from account lookups. Root weakness: the plan did not forbid CDK context lookups. Prevented by requiring context-free synth for PR-007.
- A table helper enables TTL or streams by default, causing ledger or review records to expire or creating downstream processing surfaces before any consumer exists. Root weakness: table defaults were trusted without negative assertions. Prevented by explicit TTL/streams-disabled assertions.
- PR-008 implements list methods and discovers that GSI queries do not return full entity attributes, forcing N+1 reads across every list endpoint. Root weakness: the plan asserted GSI existence but not projection. Prevented by requiring `ALL` projection or a deliberately tested narrower projection.
- The placeholder Lambda returns `200 OK` with a not-implemented payload. Root weakness: the plan required a body shape but not a failure status. Prevented by requiring HTTP `501` and JSON content type.
- Artifact bytes are stored in a private encrypted bucket, but S3 requests over plaintext HTTP are not explicitly denied. Root weakness: the plan covered at-rest security but not transport enforcement. Prevented by adding an `aws:SecureTransport=false` deny policy.

## Plan Review Gate

Initial review result: not HECK YES.

The first draft of this PR-007 plan risked being too broad because the implementation backlog describes a full Milestone 2 with real presigned upload, document creation, persistent reads, and review behavior. That would collapse PR-007, PR-008, and PR-009 into one large slice. It also did not strongly enough prevent a deployed in-memory Control API from masquerading as product behavior, and it under-specified the auth/public exposure issue for API Gateway.

Fixes applied:

- Limited PR-007 to infrastructure shape: S3 bucket, DynamoDB tables, Control API Lambda shell, HTTP API routes, outputs, IAM, and CDK tests.
- Moved DynamoDB/S3 repositories, presigned URLs, persistent handlers, and real document creation to PR-008/PR-009.
- Required a structured `NOT_IMPLEMENTED` Lambda shell instead of in-memory product behavior.
- Added explicit API Gateway public-surface guardrails and no-prod-auth constraints.
- Added table/index assertion coverage and mapper guidance for composite persistence keys.
- Added IAM negative checks for AgentCore/Bedrock/tool permissions.
- Added no-deploy/no-telemetry honesty because the repo currently has synth CI, not deploy CI.

Review-plan pass result before fixes: not 100% satisfied.

Additional gaps found:

- The runtime choice used Node.js 22 even though AWS Lambda now supports Node.js 24 and the installed CDK package exposes `Runtime.NODEJS_24_X`.
- The plan leaned toward `NodejsFunction`, which would add bundling complexity before PR-009 needs a real TypeScript Lambda handler.
- The DynamoDB key/index design was still too implicit for PR-008 to implement repositories without rediscovering physical attribute names.
- API Gateway's public dev endpoint could become a precedent for persistent unauthenticated behavior in PR-009.
- IAM guidance was too vague and could allow broad helper grants that include `Scan`, `DeleteItem`, or `DeleteObject` without conscious review.
- Stage naming was not validated even though it flows into globally constrained S3 bucket names.

Additional fixes applied:

- Switched the planned runtime to Node.js 24.x and recorded the local CDK support check.
- Preferred an inline placeholder Lambda for PR-007 and deferred real TypeScript Lambda bundling to PR-009 unless implementation finds a concrete reason to bundle now.
- Added exact table keys, GSI names, and composite persistence attribute names.
- Added the full HTTP API route list directly to the plan.
- Added explicit IAM action guidance and negative assertions.
- Added stage validation requirements and stronger wording that PR-007's public dev placeholder is not a security precedent.

Second adversarial review result before fixes: not HECK YES.

Additional gaps found:

- The plan still allowed an unauthenticated dev placeholder API even though the infrastructure spec says dev should be protected with an allowlist, private deployment, or basic auth, and ADR-052 says dev deployment should still be protected appropriately.
- The plan required configuring `AWS_REGION` as a Lambda environment variable, but AWS Lambda reserves `AWS_REGION` and does not allow it to be set in function configuration.
- The plan pre-granted DynamoDB/S3 data-plane permissions for future PR-009 behavior to a PR-007 placeholder Lambda that does not use them, increasing blast radius without product value.
- The plan did not separate DynamoDB removal policy from deletion protection.
- The plan did not call out the multiple-active-price-book risk that remains even after adding `PriceBooks.byStatus`.
- Stage validation said bucket-safe but did not require maximum length under the full bucket-name pattern.

Second adversarial fixes applied:

- Changed the default HTTP API plan to route-level `AWS_IAM` authorization and made anonymous placeholder routes require an explicit local/dev-only override that fails for `prod`.
- Removed `AWS_REGION` from the required custom Lambda environment variables and added checks that the handler relies on Lambda's runtime-provided region.
- Changed the IAM plan so PR-007 does not attach unused DynamoDB/S3 data-plane permissions by default; PR-009 must add them with real persistent handlers.
- Added prod DynamoDB deletion-protection assertions alongside retention/PITR requirements.
- Added the active-price-book uniqueness risk and required PR-008 conflict behavior or an `AppSettings.ACTIVE_PRICE_BOOK_VERSION` authority.
- Strengthened stage validation to include bucket-name length.

Third adversarial review result before fixes: not HECK YES.

Additional gaps found:

- The plan's DynamoDB sort-key names did not preserve the documented padded numeric prefixes. This would synthesize successfully but break lexicographic ordering for run attempts, stage timelines, and ledger rows after sequence 9.
- The plan did not require stage-specific CloudFormation stack identities, only stage-specific resource names.
- The plan allowed a `$default` HTTP API route fallback even though that would stop PR-007 from proving the documented route surface.
- The plan assumed infra tests would run once written, but `/infra` currently has no `test` script and its `tsconfig.json` excludes `test/**/*.ts`.
- The plan did not explicitly forbid CDK context lookups, which could make synth depend on mutable AWS account state and generated `cdk.context.json`.
- The plan did not distinguish allowed Lambda basic CloudWatch Logs permissions from forbidden future data-plane permissions, and it did not require API Gateway invoke permissions to be scoped to the HTTP API execution ARN.
- The plan did not assert that DynamoDB TTL and streams remain disabled for business tables.

Third adversarial fixes applied:

- Required padded numeric sort-key attributes and value formats for run attempts, stage events, and ledger rows.
- Added stage-specific stack names and rollback guidance for later stack renames.
- Required explicit HTTP API route resources and asserted no `$default` catch-all substitute for PR-007.
- Added infra package test wiring and TypeScript test coverage requirements.
- Required context-free CDK synth with no AWS lookups or committed `cdk.context.json`.
- Allowed only Lambda basic CloudWatch Logs execution permissions and required API Gateway Lambda invoke permissions to be source-scoped.
- Added negative assertions for DynamoDB TTL and streams.

Fourth adversarial review result before fixes: not HECK YES.

Additional gaps found:

- The plan asserted GSI existence but not projection, so PR-008 could inherit GSIs that cannot return complete domain entities without N+1 base-table reads.
- The placeholder Lambda response was structured but did not require HTTP `501`, JSON content type, or no CORS headers.
- The inline Lambda plan did not explicitly forbid importing workspace packages or relying on TypeScript/ESM behavior.
- The S3 bucket plan covered privacy and encryption at rest but did not require HTTPS/TLS-only access.

Fourth adversarial fixes applied:

- Required `ALL` GSI projection unless a narrower projection is explicitly mapped and tested.
- Required the placeholder Lambda to be self-contained inline JavaScript returning HTTP `501`, `content-type: application/json`, structured `NOT_IMPLEMENTED`, and no CORS headers.
- Added an S3 `aws:SecureTransport=false` deny-policy requirement and assertion.

Adversarial final review result after the fourth pass: HECK YES.

- Scope is narrow enough for one PR and matches the build order.
- The implementation approach sets up later persistence without faking product behavior.
- Verification is concrete: CDK assertions plus root checks and CI.
- Edge cases are covered: anonymous API exposure, generated artifacts, reserved Lambda environment variables, inline Lambda packaging, runtime support, overbroad IAM, unused future data-plane grants, CloudWatch Logs exception handling, API Gateway invoke scoping, table/index drift, GSI projection drift, TTL/stream drift, padded numeric sort ordering, active price-book lookup without scans, active price-book conflicts, invalid stage naming, stage-specific stack identity, context-free synth, S3 TLS enforcement, CORS creep, rollback of retained resources, bundling scope creep, and PR-008/009 boundary creep.
- The plan preserves the product model: `TranslationJob` remains the business unit, `Run` remains a technical attempt, and `LedgerItem` remains the future economics source of truth.

## Progress, blockers, and evidence

- PR-006 completed and merged:
  - PR #4: `Add Control API skeleton`
  - merged commit: `5e744cd`
  - PR CI passed.
  - Post-merge `main` CI passed.
- Generated Next env-file issue resolved:
  - PR #5: `Update generated Next env file`
  - merged commit: `5a5f1b7`
  - PR CI passed.
  - Post-merge `main` CI passed.
  - `pnpm --filter @agentcore-pdf-translator/web build` leaves the worktree clean after the merge.
- Current branch before PR-007 implementation planning: `main`.
- Current worktree before this plan update was clean.
- Next uncompleted build-order item identified: PR-007, `CDK storage/database/API basics`.
- Planning sources read for PR-007:
  - `AGENTS.md`
  - `docs/codex/BUILD_ORDER.md`
  - `docs/07-infrastructure-cdk-spec-v0.6.md`
  - `docs/08-implementation-backlog-v0.7.md`
  - `docs/10-adrs-v0.9.md`
  - `docs/11-codex-implementation-brief-v1.0.md`
  - `docs/reference/API_ROUTES.md`
  - `docs/reference/S3_ARTIFACT_KEYS.md`
  - `docs/reference/ENTITY_MODEL.md`
  - `docs/reference/OPEN_DECISIONS.md`
- Current AWS documentation checked during planning:
  - Lambda runtimes confirm Node.js 24 is a supported Lambda runtime: https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html
  - CDK `NodejsFunction` docs confirm the construct remains available if implementation needs bundling later: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_lambda_nodejs.NodejsFunction.html
  - CDK `HttpLambdaIntegration` docs confirm HTTP API Lambda integration shape: https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_apigatewayv2_integrations.HttpLambdaIntegration.html
  - Lambda environment-variable docs confirm `AWS_REGION` is a reserved runtime environment variable and must not be configured as a custom Lambda environment key: https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html
  - CloudFormation `AWS::ApiGatewayV2::Route` docs confirm HTTP API routes support `AWS_IAM` authorization: https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-apigatewayv2-route.html
  - CloudFormation `AWS::ApiGatewayV2::Stage` docs confirm HTTP API stages are what make an API deployment available for clients to call: https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-resource-apigatewayv2-stage.html
  - S3 bucket naming docs confirm the 3-63 character length limit, lowercase/hyphen constraints, and begin/end character constraints: https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucketnamingrules.html
  - S3 bucket policy examples confirm `aws:SecureTransport` can deny HTTP requests and enforce HTTPS/TLS access: https://docs.aws.amazon.com/AmazonS3/latest/userguide/example-bucket-policies.html
- Local CDK package check:
  - `aws-cdk-lib` v2.254.0 exposes `Runtime.NODEJS_24_X`.
  - `aws-cdk-lib` v2.254.0 exposes `HttpIamAuthorizer` and `HttpApiProps.createDefaultStage`.
  - `aws-cdk-lib` v2.254.0 exposes DynamoDB table `deletionProtection`.
- No implementation has been started for PR-007.
- Loaded implementation skills for this infrastructure/backend TypeScript change: `implement-plan`, `backend-patterns`, `typescript`, `testing`, `security`, and `refactoring`.
- Created branch `codex/cdk-storage-database-api` from current `main`.
- PR-007 implementation started on branch `codex/cdk-storage-database-api`.
- Implemented stage-aware CDK app structure:
  - `infra/src/config.ts`
  - `infra/src/names.ts`
  - `infra/src/infra-app.ts`
  - `infra/src/stacks/storage-stack.ts`
  - `infra/src/stacks/database-stack.ts`
  - `infra/src/stacks/control-api-stack.ts`
  - `infra/src/lambda/control-api-placeholder.ts`
- Replaced the empty foundation stack entrypoint with staged `Storage`, `Database`, and `ControlApi` stacks.
- Implemented private retained S3 artifact bucket with S3-managed encryption, public access block, bucket-owner-enforced ownership, versioning, and `aws:SecureTransport=false` deny policy through CDK `enforceSSL`.
- Implemented ten separate DynamoDB tables with documented PK/SK shapes, required GSIs, `PriceBooks.byStatus`, pay-per-request billing, point-in-time recovery, safe retention, prod deletion protection, no TTL, no streams, and padded numeric sort-key attributes.
- Implemented Control API placeholder Lambda using self-contained inline JavaScript returning HTTP `501` structured `NOT_IMPLEMENTED` JSON with no CORS headers and no workspace package imports.
- Implemented explicit HTTP API routes for every documented Control API route, with `AWS_IAM` authorization by default and no `$default` route substitute.
- Kept the placeholder Lambda free of DynamoDB/S3 data-plane, Bedrock, AgentCore, tool Lambda, VPC, or Cognito permissions; only Lambda basic logging and API Gateway invoke permissions are synthesized.
- Added infra package test wiring and CDK assertion tests in `infra/test/infrastructure.test.ts`.
- Refactoring assessment:
  - Fix now: none after checks were green.
  - Worth doing if cheap: keep the table definitions centralized in `database-stack.ts`; no further extraction needed yet because PR-008 may change repository mapping details.
  - Leave alone: no additional stack/construct abstraction until a later PR introduces repeated infrastructure behavior.
- Local deterministic evidence:
  - `pnpm install --frozen-lockfile` passed.
  - `pnpm --filter @agentcore-pdf-translator/infra typecheck` passed.
  - `pnpm --filter @agentcore-pdf-translator/infra test` passed: 7 tests passed.
  - `pnpm typecheck` passed.
  - `pnpm test` passed: infra 7, schemas 3, data 10, costing 6, control-api 11, web 4 tests passed.
  - `pnpm lint` passed.
  - `pnpm cdk synth` passed and synthesized `AgentCorePdfTranslator-dev-StorageStack`, `AgentCorePdfTranslator-dev-DatabaseStack`, and `AgentCorePdfTranslator-dev-ControlApiStack`.
- Deployed verification: not available for PR-007 because the repository has CI-backed synth but no CI-backed deployment workflow.
- Telemetry verification: not applicable for PR-007 because no deployed runtime path, AgentCore telemetry, CloudWatch application signal, or product request flow was introduced.
- Published PR #6: `Add CDK storage database API basics`.
- Current blockers:
  - No CI-backed deployment workflow exists, so deployed verification is not available for PR-007 as planned.
