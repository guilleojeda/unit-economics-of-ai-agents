# PLAN

## Objective

Implement `PR-009 - CI-backed AWS dev deployment pipeline` so the merged `main` SHA deploys the current dev CDK stacks to `us-east-1` through CI, produces a sanitized deploy artifact, and can be directly verified by Codex against the deployed placeholder Control API.

## Scope and non-goals

In scope:

- Convert the current verification-only GitHub Actions workflow into a CI-backed post-merge dev deployment path.
- Keep pull request CI as deterministic verification only, without requiring AWS credentials, OIDC tokens, or deployment permissions.
- Validate GitHub workflow syntax and deployment-job semantics before merge as far as the platform allows, so a malformed deploy workflow cannot pass PR review and only fail after merge.
- Deploy only from the normal `main` push path after a PR is merged.
- Record GitHub event and ref provenance in deployment evidence so a direct push, rerun, or other non-PR-merge path cannot be mistaken for the normal accepted delivery path.
- Verify that the deployed SHA is associated with the merged PR being accepted, or explicitly fail/block acceptance when CI cannot prove that provenance.
- Serialize dev deployments so overlapping `main` pushes cannot race, corrupt stack state, or produce ambiguous deploy artifacts.
- Queue dev deployments rather than canceling in-flight deployments after they may have started mutating CloudFormation resources, unless cancellation safety is explicitly proven.
- Deploy these current dev stacks through CDK/IaC:
  - `AgentCorePdfTranslator-dev-StorageStack`
  - `AgentCorePdfTranslator-dev-DatabaseStack`
  - `AgentCorePdfTranslator-dev-ControlApiStack`
- Deploy only this explicit stack allowlist for PR-009 and fail if the deploy command or synthesized stack list would include unplanned stacks.
- Run CDK deployment in a non-interactive, CloudFormation-backed CI mode; do not use hotswap, watch mode, local approval prompts, or any deployment mode that bypasses CloudFormation stack state.
- Synthesize and deploy from a clean CI-generated CDK assembly; do not read stale local `cdk.out`, checked-in generated output, or artifacts from earlier runs as deployment input or validation evidence.
- Use the same explicit CDK context/configuration for synth, deploy, smoke, and artifact generation, and record a sanitized config fingerprint.
- Capture stack outputs, AWS account/region/stage identity, CI role/session identity, deployed SHA, workflow run URL, retention/protection summary, and smoke-check result in a sanitized deploy artifact.
- Validate the CI caller identity against an explicit expected dev AWS account before deployment; do not rely on whichever account the assumed role happens to target.
- Capture stack outputs from the current CI deployment or live CloudFormation state for the deployed stacks, not from repository secrets, local context defaults, stale artifacts, or synthesized templates alone.
- Name and upload deploy artifacts with stable SHA/run identity so later runs cannot overwrite or be mistaken for the accepted deployment evidence.
- Record deploy artifact retention/expiry behavior so later slices know whether the artifact itself remains retrievable or only its persisted identity/provenance fields remain.
- Version and validate the deploy artifact schema before upload; failed deployment artifacts, if emitted for diagnosis, must be clearly marked failed and cannot satisfy acceptance.
- Record deployment provenance for the exact synthesized assembly, including CDK assembly/template hashes and locked toolchain/dependency inputs such as package manager version, lockfile hash, Node runtime used for repo commands, CDK CLI version, and `aws-cdk-lib` version.
- Smoke-test a non-mutating deployed placeholder Control API route and prove it returns honest not-yet-implemented behavior that defers Persistent Control API work to PR-010.
- Record the deployed placeholder API access mode, such as IAM-protected or explicit dev-only unauthenticated placeholder, in the deploy artifact and direct-verification evidence.
- Remove the current GitHub Actions Node.js 20 JavaScript-action runtime deprecation warning from the PR and main/deploy workflow runs relevant to PR-009 acceptance.
- Treat the GitHub Actions deprecation warning as a JavaScript action-runtime issue, not automatically as a reason to change the repository's build Node version, Lambda runtime, or `@types/node` version.
- Minimize the action supply-chain surface in any OIDC-enabled deploy job: use trusted or pinned actions, document action refs/runtime basis, and avoid running unnecessary third-party actions where AWS credentials or OIDC token minting is possible.
- Document CI deployment prerequisites, including OIDC trust, branch/environment restriction, CDK bootstrap status, and least-privilege or temporary-permission status without exposing secret values.
- Resolve and document how `PIPELINE_EXECUTION_ROLE`, `CLOUDFORMATION_EXECUTION_ROLE`, and CDK bootstrap execution roles interact; unused or mismatched role secrets must not create false confidence.
- Inspect or otherwise account for existing dev stack status before deployment so rollback states, drift, or name conflicts are surfaced as CI/IaC blockers rather than repaired manually.
- Define how post-merge deployed-verification evidence is recorded in `PLAN.md` without creating an infinite cycle of evidence-only commits that retrigger deployment acceptance.
- Ensure any GitHub environment protection used for dev deployment is non-interactive for the normal post-merge path; required human approvals cannot be part of PR-009 acceptance.
- Preserve data-bearing resource protections for the artifact bucket and DynamoDB tables.
- Record deterministic, deployed, telemetry, and residual-risk evidence in `PLAN.md` during implementation.

Out of scope:

- No Persistent Control API behavior.
- No frontend hosting.
- No AgentCore Runtime or Gateway deployment.
- No Bedrock calls.
- No PDF extraction, translation, evaluation, or recomposition.
- No product-facing fake data, fake run history, replay mode, synthetic-run mode, live-capture mode, recording mode, or presentation mode.
- No per-PR branch preview environments.
- No production deployment.
- No local `cdk deploy`.
- No manual AWS console or ad hoc AWS resource changes as the delivery path.
- No manual workflow dispatch or human-triggered deployment as the acceptance path.
- No manual workflow rerun as the acceptance or recovery path; recovery must come from an automatic CI retry policy or a new merged fix through the normal pipeline.
- No required manual environment approval gate for the normal post-merge deployment.

## Assumptions and open questions

- Current repository state already has the prerequisite story docs merged through PR #26 and `PR-009` is the next uncompleted implementation unit.
- The current GitHub workflow is verification-only: it runs checks, configures AWS with `PIPELINE_EXECUTION_ROLE`, and runs `pnpm cdk synth`; it does not deploy. Because synth does not need AWS credentials today, PR-009 should remove AWS credential use from pull request verification unless a concrete future need is documented.
- Repository secrets visible by name are present: `PIPELINE_EXECUTION_ROLE`, `CLOUDFORMATION_EXECUTION_ROLE`, and `ARTIFACTS_BUCKET_NAME`. Their values are intentionally not visible and must not be exposed.
- Unknown until implementation/CI run: what explicit expected AWS account identifier is available to guard deployment. PR-009 must add or use a non-leaking expected dev account value and fail before deployment if STS caller identity does not match it.
- Unknown until implementation/CI run: whether the CI deploy role has the required deployment permissions, whether role trust is restricted to the intended repository/branch/environment, whether permissions are least-privilege or temporary broad permissions, and whether the target account/region is CDK-bootstrapped for these stacks.
- Unknown until implementation/CI run: whether CDK deploy will require approval for IAM/security-sensitive changes. PR-009 must make the CI deploy path non-interactive while preserving deterministic review of security-sensitive template changes; it must not hang waiting for approval or bypass review with hotswap/watch behavior.
- Unknown until implementation/CI run: whether stale generated CDK output exists in the workspace or CI cache. PR-009 must clean or isolate synthesis output and prove deploy artifacts come from the fresh CI-generated assembly for the accepted SHA.
- Unknown until implementation/PR CI: whether deploy-workflow syntax, conditions, permissions, and concurrency semantics are all valid before the first merge. PR-009 must add workflow static validation or an equivalent deterministic review check rather than relying only on the first post-merge run to discover workflow mistakes.
- Unknown until implementation: which GitHub Actions run inside the OIDC-enabled deploy job. Any third-party action in that job can be part of the credential trust boundary because job-level `id-token: write` is available before the AWS credential step; PR-009 must pin or justify trusted action refs and minimize that surface.
- Unknown until implementation/CI run: whether the normal `main` deployment event can prove the deployed SHA came from a merged PR instead of a direct push. If the repository cannot enforce branch protection or prove associated PR provenance through the GitHub API/metadata, PR-009 must record the limitation and cannot use that run as final acceptance evidence.
- Unknown until implementation: whether updated GitHub Actions versions remove the Node.js 20 JavaScript-action runtime deprecation warning without extra configuration. If not, the workflow must explicitly opt JavaScript actions into Node.js 24 or otherwise use a supported non-deprecated action runtime. Acceptance depends on actual PR and main run evidence showing the warning is gone, not on assuming a specific environment variable or action version is sufficient. Do not conflate this with the Node version used to run repository build/test commands or the deployed Lambda runtime unless those runtimes are directly implicated by failing evidence.
- Unknown until implementation/CI run: whether GitHub exposes the Node.js 20 action-runtime warning in a way the workflow can fail automatically. If not, PR-009 must require Codex inspection of run annotations/logs as acceptance evidence instead of pretending a non-existent self-check proves the warning is absent.
- Unknown until implementation/CI run: whether the dev CloudFormation stacks already exist, are absent, are in a rollback/import-required state, or have drift/name conflicts from prior work. PR-009 must surface those states as blockers or recover through new CI/IaC changes, not manual AWS repair.
- Unknown until implementation completion: how final post-merge deployed verification evidence should be represented in `PLAN.md` after the PR that created the pipeline has already merged. PR-009 must avoid an evidence-only commit loop that retriggers deployment forever; if repository-persisted final evidence is required, the evidence update must have an explicit non-product-change handling strategy.
- The placeholder API is currently IAM-protected by default, with an existing dev-only `allowUnauthenticatedPlaceholderApi` context escape hatch. The implementation should prefer an authenticated CI smoke request. If that would add disproportionate scope or block direct Codex verification, PR-009 may deploy the placeholder API with `allowUnauthenticatedPlaceholderApi=true` only while it returns no product/customer data, and must record that PR-010 must remove/restrict it before real product APIs are exposed. The selected access path must be usable by both CI smoke verification and direct Codex verification without exposing credentials in durable evidence.
- Telemetry may be limited to Lambda/API Gateway logs for the placeholder route. If telemetry cannot be queried or isolated to the smoke request, record the exact blocker and do not claim telemetry verification succeeded.

## Expected outcomes

- Pull requests still run install, typecheck, tests, lint, and CDK synth without deploying AWS resources or configuring AWS credentials unless a documented check truly requires them.
- Pull requests deterministically validate workflow syntax and deployment-job structure well enough to catch malformed YAML, wrong events, unsafe permissions, missing concurrency, missing conditions, and unexpected deploy commands before merge.
- A merge to `main` runs the normal CI path, then deploys the current dev CDK stacks to `us-east-1`.
- The accepted deployment SHA is tied to the PR being accepted; a direct push to `main` or a `main` run without merged-PR provenance is not valid final acceptance evidence.
- The deploy job fails before CDK deployment if the assumed AWS identity account does not match the expected dev account.
- Concurrent `main` pushes cannot run overlapping dev deployments; only one dev deployment can mutate the stack set at a time, and an in-flight deploy is not canceled after CloudFormation mutation has begun unless the workflow proves cancellation-safe recovery.
- The deployment uses the merged SHA from `main`, not a branch-only deployment.
- CDK deployment runs non-interactively through CloudFormation against the explicit stack allowlist; hotswap, watch mode, and local approval prompts are not part of the delivery path.
- CDK synth and deploy use the same clean CI-generated assembly and the same explicit dev context/configuration.
- The deploy artifact records the triggering event, ref, run attempt, and deployed SHA so acceptance evidence can distinguish a normal post-merge `main` deployment from a manual rerun, direct push, or branch-only run.
- The deployment produces a machine-readable deploy artifact for the merged SHA.
- The deploy artifact has a checked schema version and explicit deployment/smoke status fields.
- Deploy artifacts are named or keyed by SHA plus workflow run identity so accepted evidence is immutable enough for later reference.
- Deploy artifact retention or expiry behavior is explicit in the artifact or job summary.
- The deploy artifact is sanitized and includes the required PR-009 fields.
- The deploy artifact includes enough provenance for later PR-011+ persisted runs to reference the deployed build.
- The deploy artifact includes a sanitized config fingerprint and toolchain/assembly provenance sufficient to prove which CDK app, lockfile, context, and templates produced the deployed stacks.
- Stack outputs include `ArtifactBucketName`, all DynamoDB table names, `ControlApiUrl`, and `ControlApiLambdaName`.
- Stack outputs used for verification come from the current deployed stacks and match the endpoint Codex exercises.
- A post-deploy smoke check exercises a non-mutating deployed Control API route, preferably `GET /api/jobs`, and proves it returns `NOT_IMPLEMENTED` / Persistent Control API deferred-to-PR-010 behavior without product records.
- The deploy artifact and direct evidence identify whether the placeholder API was verified through IAM-authenticated access or explicit dev-only unauthenticated placeholder access.
- The deploy artifact or job summary records the deploy job's relevant action refs/runtime basis, and the OIDC-enabled job uses only trusted or pinned actions needed for deployment.
- Codex directly exercises the deployed API after merge and records the observed status/response in `PLAN.md`.
- Final evidence recording does not create a recursive deployment loop or reclassify a docs/evidence-only update as a new product delivery slice.
- The workflow fails if deployment, artifact creation, smoke verification, data-resource retention checks, or deployment-runtime deprecation checks fail.
- If deployment partially mutates AWS and fails, the work remains blocked until recovery is performed through CI/CD and CDK/IaC and evidence is recorded.

Forbidden outcomes:

- No successful completion based only on local checks, CDK synth, screenshots, logs, or CI summaries.
- No manual AWS resource edits or local `cdk deploy`.
- No manual workflow dispatch or human-triggered deployment as the completion signal.
- No manually rerun deployment as the completion or recovery signal.
- No required manual approval gate between merge and dev deployment completion.
- No deployment from an unmerged branch as acceptance evidence.
- No leaking AWS credentials, OIDC tokens, auth headers, cookies, full signed requests, secret values, or presigned URLs into artifacts, summaries, logs, or `PLAN.md`.
- No destructive removal policy, S3 object auto-delete, product-record TTL, or cleanup behavior that can erase product/economics evidence.
- No product behavior beyond the placeholder deployed smoke surface.

## Product design

PR-009 is deployment infrastructure, not product workflow behavior. Its user value is operational: every later slice can be accepted only after the exact merged `main` SHA is deployed to the AWS dev environment and directly used by Codex. The only runtime product surface for this slice is the existing placeholder Control API. A correct deployed user/API experience for PR-009 is an honest not-yet-implemented response that proves the API route is reachable in AWS and defers real Persistent Control API behavior to PR-010.

The deployment artifact is a product delivery artifact, not an economics artifact. It anchors environment identity and deployed-build provenance for future records, but it must not become a product mode or substitute for later workflow evidence. Logs and telemetry remain correlation/debugging evidence only; they are not an economics source of truth.

## Deterministic checks

Required local and PR checks:

```text
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm lint
pnpm cdk synth
```

Additional deterministic checks to add or verify in PR-009:

- Workflow check or review proof that pull requests do not deploy and `main` pushes do deploy.
- Workflow syntax/semantic validation, such as `actionlint` or an equivalent deterministic parser/review script, covering triggers, job conditions, permissions, concurrency, environment use, deploy commands, and artifact upload conditions.
- Workflow permission check proving PR verification does not request AWS credentials or `id-token: write` unless a specific non-deploy check requires it.
- Workflow permission check proving `id-token: write` and deployment credentials are scoped to the deploy job only; non-deploy jobs should use minimum read-only permissions such as `contents: read`.
- Workflow action trust check proving actions that run in the OIDC-enabled deploy job are pinned or explicitly trusted, and that unnecessary third-party actions do not run where OIDC token minting or AWS credentials are available.
- Workflow provenance check proving a deployable `main` SHA is associated with a merged PR, or documenting branch-protection evidence that prevents direct pushes to `main`; final acceptance must include the PR URL and merged SHA.
- AWS identity guard check proving the deploy job compares `aws sts get-caller-identity` account output to an explicit expected dev account value before `cdk deploy`.
- Workflow concurrency check or review proof that dev deployments are serialized for the shared dev environment without unsafe cancellation of in-flight CloudFormation mutations.
- Stack allowlist check proving the deployment command targets only `StorageStack`, `DatabaseStack`, and `ControlApiStack` for `dev`, and fails if unplanned stacks would be deployed.
- CDK deploy-mode check proving deployment is non-interactive, CloudFormation-backed, and does not use hotswap, watch, local prompts, or approval behavior that would block CI.
- Clean-assembly check proving CI removes or isolates stale `cdk.out` before synth, uses the freshly synthesized assembly for deployment, and records assembly/template hashes.
- Context consistency check proving synth, deploy, smoke verification, and artifact generation use the same explicit dev context values, including stage and placeholder API access mode.
- Workflow provenance check proving deploy artifacts include event name, ref, run ID, run attempt, and deployed SHA.
- Workflow/runtime check proving the GitHub Actions Node.js 20 deprecation warning is gone from PR verification and post-merge main deployment runs.
- Workflow/runtime review proving the warning fix targets JavaScript action runtime usage and does not make unrelated project Node, Lambda runtime, or type-version changes unless deterministic evidence requires them.
- Run-log/annotation inspection requirement for the Node.js 20 warning if GitHub does not expose the warning through a workflow-failable interface.
- CDK/template checks proving artifact bucket retention, S3 versioning, DynamoDB point-in-time recovery, no S3 object auto-delete, no product-record TTL, and no destructive cleanup settings for data-bearing resources.
- Pre-deploy stack status check or documented CI evidence showing existing dev stacks are deployable, or a precise blocker if they are absent, drifted, in rollback/import-required status, or blocked by retained-resource name conflicts.
- Deploy artifact schema/content check proving required fields are present, artifact identity includes merged SHA plus workflow run identity, artifact retention/expiry behavior is recorded, and secrets/signed URLs are absent.
- Deploy artifact validation check proving the artifact schema is versioned, machine-validated before upload, and records success/failure status so failed-run diagnostic artifacts cannot be mistaken for acceptance artifacts.
- Toolchain/provenance check proving the deploy artifact records package manager version, lockfile hash, Node version for repository commands, CDK CLI version, `aws-cdk-lib` version, CDK context/config fingerprint, and CDK assembly/template hashes.
- Stack-output source check proving deploy artifacts read outputs from the current deployment/live stack state and not from stale secrets or synthesized templates alone.
- Smoke-check script or workflow step proving a non-mutating route at `ControlApiUrl`, preferably `GET /api/jobs`, responds from AWS with placeholder `NOT_IMPLEMENTED` behavior.
- Artifact redaction check or review proof that CI job summaries, deploy artifacts, logs, and `PLAN.md` record only sanitized evidence.

## Deployed verification

After PR-009 is merged:

1. Wait for the normal `main` CI deployment for the merged SHA.
2. Confirm the deploy artifact exists for that SHA.
3. Read the deploy artifact and record:
   - GitHub Actions run URL
   - PR URL associated with the deployed merged SHA
   - merged SHA
   - triggering event name, ref, run ID, and run attempt
   - AWS account ID
   - region
   - stage
   - CI role/session identity
   - deployed stack names
   - `ControlApiUrl`
   - `ControlApiLambdaName`
   - DynamoDB table names
   - artifact bucket name
   - retention/protection summary
   - artifact schema version and artifact identity
   - package manager version, lockfile hash, Node version for repo commands, CDK CLI version, `aws-cdk-lib` version, CDK context/config fingerprint, and CDK assembly/template hashes
   - deploy artifact retention/expiry behavior
   - placeholder API access mode used for CI smoke and Codex direct verification
   - relevant deploy-job action refs/runtime basis and action trust posture
4. Confirm the deployed artifact identity matches the endpoint used for validation.
5. Confirm the AWS account and region in the deploy artifact match the explicit expected dev account and `us-east-1`.
6. Directly call the deployed `ControlApiUrl` from Codex using the access mechanism selected by the implementation.
7. Record the route, status code, sanitized response body, request ID if available, and evidence that the response identifies Persistent Control API behavior as deferred to PR-010.
8. Confirm no product-facing fake documents, jobs, runs, ledgers, evaluations, or review decisions are seeded or exposed.
9. Record final evidence in `PLAN.md` according to the explicit post-merge evidence strategy without creating a recursive deployment loop or claiming that an unverified evidence-only run is a new accepted product deployment.

Do not use local CDK deployment, branch deployment, screenshots, logs, or synth output as deployed verification.

## Telemetry verification

If telemetry is queryable for the smoke request, use these selectors:

- merged commit SHA
- GitHub Actions run ID
- AWS account ID, region, and stage from the deploy artifact
- `ControlApiUrl`
- API Gateway request ID or Lambda request ID when available

Required signals:

- Control API Lambda invocation for the smoke request.
- No Lambda error for the smoke request.
- No 5xx response for the smoke request.

Forbidden signals:

- No seeded product records.
- No evidence that logs or telemetry are used as economics source of truth.
- No secret, signed request, token, cookie, or presigned URL leakage in durable evidence.

If telemetry cannot be queried or cannot be isolated, record the exact blocker in `PLAN.md` and do not claim telemetry verification succeeded.

## Implementation steps

1. Resolve deployment prerequisites and runtime-warning strategy.
   - Done when the CI deploy identity, expected dev AWS account guard, role-trust boundary, `PIPELINE_EXECUTION_ROLE`/`CLOUDFORMATION_EXECUTION_ROLE`/CDK bootstrap-role relationship, least-privilege or temporary-permission status, stage, region, CDK bootstrap assumptions, existing stack status strategy, GitHub Actions runtime-warning strategy, GitHub environment behavior, merged-PR provenance strategy, post-merge evidence-recording strategy, and placeholder API access choice are documented in `PLAN.md` with blockers called out.

2. Update the GitHub Actions workflow for separate verify and post-merge deploy behavior.
   - Done when pull requests run deterministic checks without deployment-only credentials, deployable `main` pushes run checks then deploy only with merged-PR provenance or documented branch-protection evidence, dev deployment is queued/serialized by workflow concurrency or an equivalent guard without unsafe in-flight cancellation, wrong-account deployments fail before CDK deploy, any environment protection is non-interactive for the normal path, workflow syntax/semantics are deterministically validated, OIDC-enabled deploy-job actions are pinned or explicitly trusted, and the workflow uses non-deprecated JavaScript-action runtime behavior.

3. Add CI-invoked deployment support.
   - Done when the workflow can deploy only the three allowlisted dev stacks through non-interactive CloudFormation-backed CDK deployment from a clean freshly synthesized CI assembly with explicit shared dev context, no hotswap/watch behavior, no local approval prompt dependency, and any helper script is clearly marked CI-invoked only.

4. Add deploy artifact generation and upload.
   - Done when a sanitized machine-readable artifact contains the required PR-009 fields, is schema-versioned and validated before upload, is keyed by merged SHA plus workflow run identity, records associated PR/event/ref/run-attempt provenance, success/failure status, config/toolchain/assembly provenance, and artifact retention/expiry behavior, uses current deployed stack outputs, and is uploaded for the merged SHA.

5. Add data-resource retention/protection validation.
   - Done when CI fails on destructive data-resource settings such as missing retention, disabled table protection/PITR where required, S3 object auto-delete, product-record TTL, or cleanup behavior that could erase product evidence.

6. Add the post-deploy Control API smoke check.
   - Done when CI exercises a non-mutating route at the deployed `ControlApiUrl`, records sanitized status/response evidence, and fails if the response does not honestly defer Persistent Control API behavior to PR-010.

7. Run local deterministic checks and open the PR.
   - Done when local checks pass, `PLAN.md` records evidence, and the PR CI passes without deployment.

8. Merge the PR and monitor post-merge deployment.
   - Done when the merged `main` SHA deploys successfully through the automatic post-merge CI path and the deploy artifact exists; a human-clicked rerun is not sufficient completion evidence.

9. Perform Codex direct deployed verification and telemetry verification.
   - Done when Codex exercises the deployed API, records sanitized evidence in `PLAN.md` according to the post-merge evidence strategy, and records telemetry proof or a precise telemetry blocker.

10. Completion review.
   - Done when PR-009 acceptance criteria are satisfied, PR-010 remains blocked until PR-009 evidence is complete, and any residual risk is recorded.

## Risks and constraints

- CI deployment can fail because the deploy role lacks permissions or the target account/region is not bootstrapped; this must be treated as a blocker, not worked around manually.
- Pull request verification can fail or expose unnecessary trust surface if it requests AWS credentials when no deploy is allowed; PR-009 should keep AWS credential configuration scoped to the main deployment path unless a concrete check requires otherwise.
- A malformed workflow or wrong deploy-job condition can pass human review and only fail after merge; PR-009 should include static workflow validation or an equivalent deterministic semantic check.
- Any action in an OIDC-enabled job can become part of the credential trust boundary, even before the explicit AWS credential step; PR-009 must minimize, pin, or explicitly justify actions in the deploy job.
- A `push` event to `main` can come from a direct push as well as a PR merge; PR-009 must either enforce associated merged-PR provenance in the workflow/evidence or document branch-protection evidence before treating a run as accepted.
- A manual rerun can make a previously failed deployment look green without proving the normal post-merge loop works; PR-009 acceptance must rely on the automatic post-merge run, an automatic retry policy, or a new merged fix that triggers the normal run again.
- AWS credentials can point at the wrong account while still producing a successful deployment; the deploy job must compare caller identity to an explicit expected dev account before mutating stacks.
- CDK app config currently fixes region but not account, so account correctness must be enforced by CI identity guards and deploy artifact evidence.
- `CLOUDFORMATION_EXECUTION_ROLE` may be required, unused, or inconsistent with the CDK bootstrap role chain; PR-009 must resolve that relationship instead of assuming the secret name implies correct deployment behavior.
- Concurrent dev deployments can race on the same stack set and confuse validation evidence; the workflow must serialize or otherwise guard shared dev deployment mutations.
- GitHub concurrency configured with cancellation can interrupt a deployment after CloudFormation has started, creating partial state without a clean recovery signal; PR-009 should queue deployments or prove cancellation safety.
- A broad `cdk deploy --all` can accidentally deploy future or experimental stacks merged before PR-009 acceptance; PR-009 must use an explicit stack allowlist or fail on unexpected stacks.
- CDK approval prompts can hang CI, while hotswap/watch behavior can bypass CloudFormation and weaken stack-output evidence; PR-009 must use a non-interactive CloudFormation-backed deploy mode and deterministic checks for security-sensitive templates.
- Stale `cdk.out` or mismatched context between synth, deploy, smoke, and artifact generation can make evidence describe a different assembly than the one deployed; PR-009 must clean or isolate assembly output, use one explicit context path, and record assembly/config provenance.
- Failed-run diagnostic artifacts can look like valid deploy artifacts if status/schema validation is weak; acceptance must require a schema-valid success artifact tied to the successful deploy and smoke run.
- Over-broad or incorrectly scoped CI role trust would become a deployment security risk; PR-009 must document the current trust/permission posture and any temporary permission debt.
- Manual GitHub environment approvals would undermine the intended automatic post-merge acceptance loop; if environments are used, the plan requires non-interactive guardrails for this dev path.
- GitHub Actions Node.js runtime deprecation is already present on current CI; PR-009 must remove the JavaScript action-runtime warning in actual CI evidence rather than normalize it or rely on an unproven workaround.
- Misreading the action-runtime warning as an application runtime problem could cause unnecessary Node/Lambda/type-version churn; PR-009 should change only the runtime layer implicated by evidence.
- GitHub may expose platform deprecation warnings only as annotations/log text, not as data a job can self-query; if so, acceptance must include Codex inspection evidence instead of a fake automated pass condition.
- Existing dev stacks may be absent, drifted, in rollback states, or blocked by retained resource name conflicts; PR-009 must surface and recover through CI/IaC, not manual repair.
- Authenticated API smoke may require SigV4 request support in CI and direct Codex verification. If using the dev-only unauthenticated placeholder path, the scope must stay limited to placeholder 501 behavior with no product data.
- If the deploy uses explicit dev-only unauthenticated placeholder access, the artifact and evidence must say so plainly; if it uses IAM, the artifact and evidence must prove both CI and Codex used the selected authenticated path without leaking signed requests or credentials.
- Smoke checks that use mutating routes could hide future side effects once PR-010 replaces placeholder behavior; PR-009 should use a non-mutating route such as `GET /api/jobs`.
- Final deployed verification happens after the implementation PR has merged, so `PLAN.md` evidence handling must avoid either leaving required evidence ambiguous or creating an endless deploy-triggering evidence-commit loop.
- Deploy artifacts and job summaries are durable evidence and must be sanitized.
- GitHub Actions artifact retention may expire before later slices need historical context; PR-009 must record retention/expiry behavior and the deploy identity fields needed even if the downloadable artifact later expires.
- `PLAN.md` must not include secrets, full signed requests, auth headers, cookies, or presigned URLs.
- Data-bearing S3/DynamoDB resources already have retention-oriented settings; PR-009 must preserve and enforce them, not relax them to make deployment easier.
- Existing repository secrets such as `ARTIFACTS_BUCKET_NAME` are not proof of the currently deployed stack outputs; PR-009 must use deployed stack outputs as the verification source of truth.
- Synthesized templates prove intended configuration but not deployed outputs; deployed verification must use current CloudFormation/CDK outputs for the stack instances mutated by the accepted run.
- CDK deploy failures after partial resource changes must be recovered through CI/CD and IaC only.
- PR-009 must not absorb PR-010 Persistent Control API, frontend hosting, AgentCore, Bedrock, or PDF workflow behavior.

## Adversarial assumption review

- Assumption: `PR-009` is the correct next unit.
  - Evidence: repository `AGENTS.md`, `BUILD_ORDER.md`, and the PR-009 story contract all identify it as next.
  - Challenge: if an unmerged branch or hidden issue superseded it, implementing PR-009 could target stale requirements.
  - Plan response: implementation starts from current `main`, records the merged SHA, and leaves PR-010+ blocked until PR-009 evidence is complete.

- Assumption: pull request verification should not deploy.
  - Evidence: PR-009 contract says deployment runs only from the post-merge `main` path.
  - Challenge: the current workflow configures AWS credentials during pull request verification; that is unnecessary for synth today and widens the trust surface.
  - Plan response: PR verification must avoid deployment-only AWS credentials and `id-token: write` unless a concrete non-deploy check requires them.

- Assumption: a `main` push means an accepted post-merge deployment.
  - Evidence: the intended loop is PR checks, PR merge, normal main deploy.
  - Challenge: a direct push, rerun, or unusual event could also produce a main run and deploy artifact.
  - Plan response: deploy artifacts must include event name, ref, run ID, run attempt, associated PR URL when available, and deployed SHA; final acceptance requires merged-PR provenance or documented branch-protection evidence, not only `push` on `refs/heads/main`.

- Assumption: rerunning a failed deployment proves the delivery loop.
  - Evidence: GitHub exposes run attempts, and a rerun can produce a green workflow for the same SHA.
  - Challenge: a manual rerun would bypass the automatic post-merge acceptance requirement and could hide a flaky or order-dependent deploy failure.
  - Plan response: run attempt is recorded, but final acceptance must be from the automatic post-merge run, an automatic retry policy, or a new merged fix that triggers the normal run again; a human-clicked rerun is not completion evidence.

- Assumption: the AWS account behind the deploy role is the intended dev account.
  - Evidence: current CI can configure AWS through a secret named `PIPELINE_EXECUTION_ROLE`, and stack names/stage imply dev.
  - Challenge: the secret could point at the wrong account or a stale role, and the CDK app currently pins region but not account.
  - Plan response: PR-009 must use an explicit expected dev account value, compare it with STS caller identity before deploy, include both in sanitized evidence, and fail before CDK mutates resources on mismatch.

- Assumption: the role-secret names describe the real CDK deployment chain.
  - Evidence: `PIPELINE_EXECUTION_ROLE` and `CLOUDFORMATION_EXECUTION_ROLE` exist by name.
  - Challenge: CDK may use bootstrap roles, `--role-arn`, or default credentials differently than the secret names imply; a missing or unused CloudFormation execution role could break deployment or weaken least privilege.
  - Plan response: implementation step 1 must document the actual role path and bootstrap behavior, including whether `CLOUDFORMATION_EXECUTION_ROLE` is used, unused, or replaced by bootstrap-generated roles.

- Assumption: one dev deployment at a time is enough for a shared dev environment.
  - Evidence: all future slices target the same dev stack set.
  - Challenge: overlapping pushes could race CloudFormation deployments, produce stale outputs, or make the deploy artifact ambiguous.
  - Plan response: workflow concurrency or an equivalent guard must serialize dev stack mutations.

- Assumption: concurrency serialization cannot make partial deployments worse.
  - Evidence: GitHub Actions concurrency can prevent simultaneous jobs.
  - Challenge: if cancellation is enabled, a newer run can interrupt an older deploy after CloudFormation has started mutating resources.
  - Plan response: PR-009 must queue or serialize deployment runs without unsafe in-flight cancellation, unless the implementation proves cancellation-safe recovery.

- Assumption: the deploy command will only deploy PR-009's intended stacks.
  - Evidence: the PR-009 contract names exactly three dev stacks.
  - Challenge: a broad `cdk deploy --all` can deploy unexpected future or experimental stacks if the CDK app changes before acceptance.
  - Plan response: PR-009 must deploy an explicit stack allowlist or fail when unplanned stacks are present.

- Assumption: CDK deploy in CI is automatically non-interactive and CloudFormation-backed.
  - Evidence: CDK is the required deployment mechanism, and CI is expected to run without human input.
  - Challenge: security approval prompts can hang CI, and hotswap/watch behavior can bypass normal CloudFormation stack updates and weaken output/state evidence.
  - Plan response: PR-009 must use a non-interactive CloudFormation-backed deploy mode, forbid hotswap/watch/local prompt dependencies, and rely on deterministic template checks for security-sensitive changes.

- Assumption: the synthesized assembly deployed by CI is the same assembly described by the evidence.
  - Evidence: CI will run synth and deploy in the same workflow.
  - Challenge: stale `cdk.out`, CI cache reuse, or different context arguments between synth, deploy, smoke, and artifact generation could deploy one assembly while recording evidence for another.
  - Plan response: PR-009 must clean or isolate CDK output, deploy the fresh CI-generated assembly, keep explicit context/config values consistent across steps, and record sanitized config, lockfile, toolchain, and assembly/template hashes.

- Assumption: the CI deploy role and bootstrap are ready.
  - Evidence: repository secrets are present by name and current CI can configure AWS.
  - Challenge: secrets may point to roles without deploy permissions, incorrect trust boundaries, wrong account, or an unbootstrapped CDK environment.
  - Plan response: the implementation must document caller identity, trust/permission posture, region, stage, CDK bootstrap status, and blockers without manual AWS repair.

- Assumption: the placeholder API can be safely smoke-tested.
  - Evidence: the current Lambda returns `501` with `NOT_IMPLEMENTED` and no product records.
  - Challenge: IAM protection may block direct Codex verification, while unauthenticated access could become dangerous if real API behavior leaks into PR-009.
  - Plan response: prefer authenticated smoke where practical; unauthenticated placeholder access is allowed only for no-data placeholder behavior and PR-010 must remove/restrict it before real product APIs. The deploy artifact and direct-verification evidence must record the chosen access mode.

- Assumption: deploy artifacts are durable enough for later provenance.
  - Evidence: PR-009 requires a machine-readable deploy artifact.
  - Challenge: GitHub artifact retention can expire or a later run can overwrite ambiguous artifact names.
  - Plan response: artifact identity must include SHA plus workflow run identity, and retention/expiry behavior plus key provenance fields must be recorded.

- Assumption: any deploy artifact for a SHA is acceptance evidence.
  - Evidence: PR-009 requires artifacts for the merged SHA.
  - Challenge: a failed deployment may still upload diagnostic artifacts, and a weak schema could make failed artifacts look successful.
  - Plan response: deploy artifacts must be schema-versioned, machine-validated before upload, include explicit deployment and smoke status, and only success artifacts can satisfy acceptance.

- Assumption: workflow permissions are safe if deployment credentials are used only in deploy steps.
  - Evidence: the current workflow has top-level `id-token: write`.
  - Challenge: top-level OIDC permission can leak unnecessary trust surface into PR verification jobs even if no deploy step runs.
  - Plan response: PR-009 must scope `id-token: write` and AWS credential use to the deploy job only, with non-deploy jobs kept to minimum read-only permissions.

- Assumption: the deploy workflow will be syntactically and semantically correct after merge.
  - Evidence: GitHub validates workflow YAML when runs start, and PR review can inspect the file.
  - Challenge: a wrong trigger, condition, permission block, concurrency group, or deploy command can pass casual review and only fail when the post-merge deploy is needed.
  - Plan response: PR-009 must add workflow static validation or an equivalent deterministic semantic check for triggers, permissions, concurrency, deploy conditions, stack allowlist, and artifact behavior.

- Assumption: GitHub Actions used in the deploy job are safe because AWS credentials are configured later.
  - Evidence: credentials are normally configured in a later workflow step.
  - Challenge: job-level `id-token: write` lets actions in that job request OIDC tokens before the explicit AWS credential step; third-party or unpinned actions become part of the deployment trust boundary.
  - Plan response: PR-009 must minimize OIDC-enabled job actions, pin or explicitly justify trusted action refs, and record relevant action refs/runtime basis in the deploy evidence.

- Assumption: stack outputs prove the deployed environment.
  - Evidence: PR-009 requires stack outputs for validation.
  - Challenge: using secrets, local config, or stale outputs could validate the wrong bucket/API/tables.
  - Plan response: deployed stack outputs from the current run or live CloudFormation state are the verification source of truth and must match the endpoint Codex uses; synthesized templates alone are not enough.

- Assumption: removing the GitHub Actions Node.js 20 warning is straightforward.
  - Evidence: GitHub supports Node.js 24 action runtime migration, but current CI emits a warning.
  - Challenge: some mitigations may still emit warnings or actions may not yet support Node 24 cleanly.
  - Plan response: acceptance requires actual warning-free PR and main run evidence, not just a presumed fix. The fix must target JavaScript action runtime usage unless evidence shows project build Node, Lambda runtime, or Node type versions are implicated.

- Assumption: the workflow can automatically fail on the Node.js 20 action-runtime warning.
  - Evidence: PR-009 wants the warning gone from relevant runs.
  - Challenge: GitHub may surface this class of warning only in run annotations or logs, not as a directly queryable condition inside the job.
  - Plan response: the workflow should fail automatically if a reliable warning check exists; otherwise Codex must inspect run annotations/logs and record warning-free evidence in `PLAN.md` without pretending an automated check exists.

- Assumption: existing dev stacks are in a deployable state.
  - Evidence: PR-007/PR-008 infrastructure exists in code, but no AWS deployment has been performed through CI yet.
  - Challenge: stacks may be absent, already exist from prior manual work, be drifted, be in rollback status, or collide with retained named resources.
  - Plan response: PR-009 must inspect or account for existing stack status before deployment, treat unsafe states as blockers, and recover only through CI/IaC or a new merged fix.

- Assumption: any placeholder route is safe for smoke verification.
  - Evidence: the current placeholder Lambda returns the same `501` response for all routes.
  - Challenge: using a mutating `POST` route can normalize unsafe validation habits and may create side effects after PR-010 replaces placeholder behavior.
  - Plan response: PR-009 smoke verification should use a non-mutating route, preferably `GET /api/jobs`, unless implementation evidence requires a different non-mutating route.

- Assumption: `PLAN.md` can contain final post-merge evidence without changing the delivery loop.
  - Evidence: global instructions require `PLAN.md` to record final evidence, but PR-009 evidence can only exist after the implementation PR has merged and deployed.
  - Challenge: committing only final evidence can retrigger deployment and create a recursive acceptance problem; leaving it uncommitted can make repository-persisted evidence ambiguous.
  - Plan response: PR-009 must define the post-merge evidence-recording strategy before implementation completion, use deploy artifacts/job summaries as durable run evidence, and avoid treating an evidence-only update as a new product delivery slice unless the user explicitly requires a repository-persisted evidence PR.

- Assumption: telemetry may be optional for PR-009.
  - Evidence: the story says PR-009 does not need full product telemetry but must state telemetry status honestly.
  - Challenge: claiming telemetry success from a smoke response or logs alone would weaken later verification norms.
  - Plan response: telemetry requires stable selectors and required/forbidden signals; otherwise `PLAN.md` records a blocker/status without claiming success.

## Progress, blockers, and evidence

- Completed prior phase: PR #26 was merged to `main` at `2c964a5624be68777b02e6e743a5ee29b85ddd52`, and main CI completed successfully.
- Loaded and followed `plan-next-phase`.
- Confirmed current branch was clean `main` before replacing the previous phase plan.
- Read repository-local `AGENTS.md`, `docs/codex/PR-009-CI-DEPLOYMENT-PIPELINE.md`, `docs/codex/BUILD_ORDER.md`, current `PLAN.md`, `.github/workflows/ci.yml`, current CDK app/config/stacks, placeholder Control API Lambda, and infrastructure tests.
- Confirmed next uncompleted unit is `PR-009 - CI-backed dev deployment pipeline`.
- Observed current GitHub secrets by name only: `PIPELINE_EXECUTION_ROLE`, `CLOUDFORMATION_EXECUTION_ROLE`, and `ARTIFACTS_BUCKET_NAME`.
- Observed current CI workflow `CI` is active and recent pull request/main verify runs have succeeded.
- Plan review gate:
  - I agree with this plan.
  - It contains the required scope, non-goals, verification, deployment, telemetry, risks, and acceptance evidence for PR-009.
  - The approach is appropriately narrow: establish post-merge CI deployment and deploy artifact evidence without implementing product behavior.
  - It explicitly handles the known Node.js 20 warning, AWS prerequisite uncertainty, data retention, sanitized evidence, and direct deployed verification.
  - Confidence: HECK YES that this is the right plan to begin PR-009 implementation.
- Second review pass found and fixed precision gaps around role trust/least-privilege evidence, manual workflow-dispatch exclusion, and ensuring the Node.js 20 deprecation warning is removed from the relevant PR and main/deploy runs.
- Third review pass found and fixed gaps around concurrent deployment races, deploy artifact identity/overwrite risk, and requiring actual CI evidence that the Node.js 20 warning is gone.
- Checked the current GitHub changelog for Node.js 20 deprecation timing and Node.js 24 opt-in guidance; the plan now requires actual warning-free run evidence rather than assuming any one mitigation is sufficient.
- Fourth review pass found and fixed the deploy artifact retention/expiry gap.
- Adversarial review pass found and fixed gaps around PR AWS credential exposure, direct-push/rerun provenance, non-interactive environment protection, stack-output source of truth, and explicit assumption tracking.
- Additional adversarial review pass found and fixed sharper failure modes around proving merged-PR provenance, rejecting manual reruns as acceptance/recovery evidence, enforcing expected dev AWS account identity before deployment, resolving CDK role-chain ambiguity, and requiring current deployed stack outputs instead of stale local or secret-derived outputs.
- Further adversarial review pass found and fixed gaps around post-merge `PLAN.md` evidence handling, Node.js action-runtime versus project-runtime confusion, platform warning detectability, existing dev stack state/drift/name-conflict preflight, and using a non-mutating smoke route.
- Additional adversarial review pass found and fixed gaps around unsafe concurrency cancellation, explicit stack allowlisting, deploy artifact schema/status validation, and scoping OIDC permissions to deploy-only jobs.
- Further adversarial review pass found and fixed gaps around non-interactive CloudFormation-backed CDK deployment, forbidding hotswap/watch/local approval prompts, and recording placeholder API access mode in deploy and verification evidence.
- Further adversarial review pass found and fixed gaps around pre-merge workflow syntax/semantic validation and the GitHub Actions supply-chain trust boundary created by job-level OIDC permissions.
- Further adversarial review pass found and fixed gaps around stale CDK assemblies, synth/deploy context drift, and missing lockfile/toolchain/template hash provenance in the deploy artifact.
- `git diff --check` passed for the PLAN-only change.
- Started PR-009 implementation on branch `codex/pr-009-ci-deploy-pipeline`.
- Loaded and followed `implement-plan`, `planning`, `testing`, `security`, and `typescript` skills for this CI/infrastructure change.
- Rechecked GitHub auth and repository deployment prerequisites before editing. Visible repository secrets by name are still `PIPELINE_EXECUTION_ROLE`, `CLOUDFORMATION_EXECUTION_ROLE`, and `ARTIFACTS_BUCKET_NAME`; no repository variables are currently visible.
- Local AWS SSO is expired, so account evidence cannot be gathered safely from local credentials. Implementation will require an explicit non-secret repository variable named `DEV_AWS_ACCOUNT_ID` and will fail the deploy job before CDK deployment if it is absent or does not match `aws sts get-caller-identity`.
- GitHub release checks for `actions/checkout@v5`, `actions/setup-node@v5`, and `actions/upload-artifact@v5` returned `release not found`; implementation will avoid JavaScript actions in the PR-009 workflow instead of assuming unavailable action runtimes remove the Node.js 20 warning.
- Chosen workflow strategy: no `uses:` actions in either job. Each job performs CI-only shell checkout, uses the runner's preinstalled Node plus pinned Corepack `pnpm@10.29.3`, and the deploy job performs GitHub OIDC-to-STS credential exchange through AWS CLI without `aws-actions/configure-aws-credentials`.
- Chosen deployment provenance strategy: the deploy job will query the GitHub commit-to-pulls API for the deployed `main` SHA and will fail before AWS credential exchange if no associated merged PR is found.
- Chosen deployment access mode for PR-009: deploy the placeholder Control API with `allowUnauthenticatedPlaceholderApi=true` only for dev, because the current Lambda returns only `NOT_IMPLEMENTED` placeholder data. The deploy artifact and evidence must label this as explicit dev-only unauthenticated placeholder access, and PR-010 must remove or restrict it before real product APIs are exposed.
- Chosen post-merge evidence strategy: the successful deployment writes durable machine-readable evidence to the configured S3 artifact bucket under a SHA/run-attempt key. `PLAN.md` records final direct verification evidence in the working tree after merge; that evidence update is not itself a new product delivery slice and must not be treated as a replacement for the deploy artifact.
- Implemented CI workflow separation:
  - Pull requests run checkout, pinned `pnpm`, install, workflow contract validation, typecheck, test, lint, CDK synth, and data-resource protection validation without AWS credentials or `id-token: write`.
  - `main` pushes run a queued `deploy-dev` job only after `verify`, with job-scoped `id-token: write`, merged-PR provenance checking, manual rerun rejection, expected-account guard, GitHub OIDC credential exchange, pre-deploy stack status capture, clean CDK synth, explicit allowlisted CDK deploy, placeholder API smoke check, deploy artifact creation, and S3 artifact upload.
  - The workflow intentionally uses no `uses:` JavaScript actions, avoiding the current Node.js 20 GitHub Actions JavaScript-runtime warning path instead of changing project Node, Lambda runtime, or `@types/node`.
- Added CI-only helper scripts under `scripts/ci/`:
  - `validate-workflow.mjs`
  - `validate-data-protection.mjs`
  - `resolve-merged-pr.mjs`
  - `configure-aws-oidc.mjs`
  - `describe-stack-status.mjs`
  - `smoke-control-api.mjs`
  - `create-deploy-artifact.mjs`
- Documented the required `DEV_AWS_ACCOUNT_ID` repository variable and `ARTIFACTS_BUCKET_NAME` repository secret in `docs/codex/PR-009-CI-DEPLOYMENT-PIPELINE.md`.
- Local deterministic evidence:
  - `pnpm install --frozen-lockfile` passed.
  - `pnpm ci:validate-workflow` passed.
  - `pnpm typecheck` passed.
  - `pnpm test` passed.
  - `pnpm lint` passed.
  - Clean CDK synth for `AgentCorePdfTranslator-dev-StorageStack`, `AgentCorePdfTranslator-dev-DatabaseStack`, and `AgentCorePdfTranslator-dev-ControlApiStack` passed with explicit PR-009 dev context and output at `.ci/verify/cdk.out`.
  - `CDK_ASSEMBLY_DIR=.ci/verify/cdk.out DATA_PROTECTION_SUMMARY_PATH=.ci/verify/data-protection-summary.json node scripts/ci/validate-data-protection.mjs` passed.
  - `for file in scripts/ci/*.mjs; do node --check "$file"; done` passed.
  - A local fixture run of `scripts/ci/create-deploy-artifact.mjs` passed, proving the artifact schema/redaction path can write a sanitized success artifact from CDK outputs, smoke evidence, data-protection summary, AWS identity, and PR provenance inputs.
  - Ruby YAML parse of `.github/workflows/ci.yml` passed.
  - `git diff --check` passed.
- Refactoring assessment:
  - Fix now: added explicit CI-only headers to every `scripts/ci/*.mjs` helper so none can be mistaken for a local deployment path.
  - Leave alone: checkout/setup duplication remains directly in the workflow because extracting it into a GitHub action would reintroduce the JavaScript action-runtime/supply-chain surface this PR is intentionally avoiding.
- Opened draft PR #27: `https://github.com/guilleojeda/unit-economics-of-ai-agents/pull/27`.
- PR #27 pull-request verification has passed on the actionless workflow. Exact pre-merge run IDs are intentionally not committed to `PLAN.md` because evidence-only amends retrigger PR CI and create stale run references; the current PR check state is the source for pre-merge CI status until merge.
- Inspected PR CI logs for Node.js action-runtime deprecation evidence. Search for `node.js 20`, `node 20`, `deprecated`, and `deprecation` returned no GitHub JavaScript action-runtime deprecation warning. The only `node 20` match was the package install line for `@types/node 20.19.41`, which is not the GitHub Actions runtime warning.
- Current merge blocker: repository variable `DEV_AWS_ACCOUNT_ID` is not visible in `gh variable list`. PR #27 remains draft until that non-secret variable is set to the expected 12-digit dev AWS account ID, because the post-merge deploy job intentionally fails before AWS mutation without it.
- User reported setting the account guard value. Rechecked GitHub configuration:
  - `gh variable list` still shows no repository variables.
  - `gh secret list` now shows a repository secret named `DEV_AWS_ACCOUNT_ID`, updated `2026-05-20T23:39:43Z`.
  - Because secret values cannot be read locally, correctness will be proven by CI before mutation: the deploy job validates the configured value is a 12-digit account ID and compares it to `aws sts get-caller-identity` before `cdk deploy`.
- Updated PR #27 to accept either preferred repository variable `DEV_AWS_ACCOUNT_ID` or fallback repository secret `DEV_AWS_ACCOUNT_ID`, while recording the source in the deploy artifact without exposing the value.
- Post-adjustment local checks passed:
  - `pnpm ci:validate-workflow`
  - `for file in scripts/ci/*.mjs; do node --check "$file"; done`
  - Ruby YAML parse of `.github/workflows/ci.yml`
  - `git diff --check`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm lint`
- PR #27 was marked ready and merged. Merge commit: `1d64dc8687b475c6d358f34033e8bebb81fadf90`.
- First normal post-merge CI run: `https://github.com/guilleojeda/unit-economics-of-ai-agents/actions/runs/26196481966`, attempt `1`, event `push`, ref `main`, merged SHA `1d64dc8687b475c6d358f34033e8bebb81fadf90`.
  - `verify` job passed.
  - `deploy-dev` passed merged-PR provenance, manual rerun rejection, expected account shape validation, GitHub OIDC credential exchange, STS account guard, pre-deploy stack status capture, typecheck, test, lint, clean CDK synth, and data-resource protection validation.
  - `deploy-dev` failed at `Deploy dev stacks` before smoke/artifact steps.
  - Root cause from deploy log: CDK could not read `/cdk-bootstrap/hnb659fds/version`; the assumed pipeline role was denied `ssm:GetParameter` on the CDK bootstrap version parameter. This is a CI role-chain/permission issue, not a local or manual deployment issue.
  - The deploy log also showed CDK could not assume bootstrap file-publishing/deploy roles and proceeded with the right-account credentials. This confirms PR-009 must use or fix the configured role chain instead of treating the `CLOUDFORMATION_EXECUTION_ROLE` secret as documentation-only.
  - No smoke check, deploy artifact creation, or artifact upload occurred on the failed run.
- Started fix branch `codex/pr-009-cdk-deploy-role` from `main`.
- Verified current Ubuntu 24.04 GitHub runner image documentation lists Node.js `24.15.0` in the hosted toolcache. The fix selects Node.js 24 directly from `/opt/hostedtoolcache/node` in shell, still without `uses:` JavaScript actions.
- Updated CI to:
  - select Node.js 24 in both jobs before Corepack/pnpm setup, avoiding the AWS SDK Node 20 support warning observed in the failed deploy log
  - write the initial OIDC pipeline identity to `.ci/deploy/aws-pipeline-identity.json`
  - assume `CLOUDFORMATION_EXECUTION_ROLE` when configured for effective CDK operations
  - guard the effective AWS identity again before any stack status/deploy operations
  - record both pipeline and effective deployment identities in the sanitized deploy artifact
- Fix-branch local checks passed:
  - `pnpm ci:validate-workflow`
  - `for file in scripts/ci/*.mjs; do node --check "$file"; done`
  - Ruby YAML parse of `.github/workflows/ci.yml`
  - `git diff --check`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm lint`
  - local fixture run of `scripts/ci/create-deploy-artifact.mjs` with `CI_CDK_DEPLOY_ROLE_ASSUMED=true`
