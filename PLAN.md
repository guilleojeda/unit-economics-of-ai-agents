# PLAN

## Objective

Define the CI-backed AWS dev deployment pipeline as the mandatory next implementation task and make its acceptance criteria explicit enough that future slices cannot be accepted without post-merge CI deployment and direct deployed verification.

## Scope and non-goals

In scope:

- Update repository planning and instruction documents to make `PR-009 - CI-backed dev deployment pipeline` the immediate next task.
- Add a dedicated PR-009 task specification that defines scope, required CI behavior, AWS deployment constraints, direct verification requirements, telemetry expectations, and completion evidence.
- Fix stale repository text that still says Persistent Control API behavior is deferred until `PR-009`; Persistent Control API is now `PR-010`.
- Preserve the rule that all AWS deployment must happen through CI/CD and CDK/IaC.

Out of scope:

- Do not edit `/Users/guille/.codex/AGENTS.md`.
- Do not implement the deployment workflow in this task.
- Do not run `cdk deploy`.
- Do not manually trigger deployment workflows.
- Do not manually modify AWS resources.
- Do not implement Persistent Control API behavior.
- Do not implement AgentCore Runtime, AgentCore Gateway, Bedrock calls, PDF processing, or frontend hosting.

## Assumptions and open questions

- `/Users/guille/.codex/AGENTS.md` is the workflow source of truth and must not be edited.
- The repository already defines `PR-009` as CI-backed dev deployment, but the next task is not yet specified in enough detail.
- Current CI is verification-only. It configures AWS credentials and runs `pnpm cdk synth`, but it does not deploy.
- Current infrastructure exposes a placeholder Control API. PR-009 can use that API as the first direct deployed verification surface until frontend hosting exists.
- Frontend hosting is not implemented yet. PR-009 must state that API direct use is sufficient only until a rendered frontend is deployed; future frontend slices must verify the rendered app directly.

## Expected outcomes

- `PR-009 - CI-backed dev deployment pipeline` is documented as the next task with no intervening feature/API/runtime slice.
- The PR-009 task document states that Persistent Control API (`PR-010`) and all later slices are blocked until PR-009 is merged, deployed from `main`, and directly verified.
- PR-009 requires GitHub Actions or the repository's normal CI/CD path to deploy the merged SHA to AWS `us-east-1` using CDK/IaC.
- PR-009 forbids local `cdk deploy`, manual AWS console changes, fake deployment evidence, and treating `cdk synth` as deployment.
- PR-009 requires Codex to directly use the deployed API or app, capture stack outputs, and record evidence in `PLAN.md`.
- PR-009 documents the exact expected completion evidence: PR merged, post-merge deploy green, deployed endpoint exercised, and telemetry status recorded.
- Stale references that incorrectly defer Persistent Control API to PR-009 are corrected to PR-010.

## Product design

Future delivery should move through a strict pipeline:

1. PR changes product, API, infrastructure, or runtime behavior.
2. CI runs deterministic verification on the PR.
3. The PR is reviewed and merged.
4. The normal CI deployment deploys the merged SHA to the AWS dev environment in `us-east-1`.
5. Codex directly uses the deployed app or API, not just logs or screenshots.
6. Codex records deployed evidence and telemetry status in `PLAN.md`.
7. Only then is the slice accepted.

PR-009 is the groundwork that makes that loop real. It should deploy the current CDK app and placeholder API first, then run a smoke check against the deployed Control API output. That gives the repository a concrete deployed verification surface before Persistent Control API persistence is added in PR-010.

## Deterministic checks

- `rg` checks for stale `PR-009` references that still mean Persistent Control API.
- `rg` checks that deployment language is CI-scoped and does not allow local/manual deploys.
- `git diff --check`.
- `pnpm lint`.
- `pnpm typecheck`.
- `pnpm test`.

## Deployed verification

Not applicable for this task because it only defines the next deployment slice and fixes stale text. This task must not deploy AWS resources. PR-009 itself must perform deployed verification by exercising the deployed API/app from the CI-deployed `main` SHA and recording evidence.

## Telemetry verification

Not applicable for this task because no runtime path is deployed or exercised. PR-009 must explicitly record whether telemetry is queryable for the smoke validation run. If telemetry is not queryable yet, PR-009 must document that blocker instead of claiming telemetry verification succeeded.

## Implementation steps

1. Add a dedicated PR-009 CI deployment task specification.
   - Done when the document states objective, scope, non-goals, workflow, acceptance criteria, verification evidence, telemetry expectations, and blockers for later slices.

2. Wire the PR-009 specification into the repository instructions and build-order docs.
   - Done when `AGENTS.md`, `docs/codex/BUILD_ORDER.md`, `docs/08-implementation-backlog-v0.7.md`, `docs/07-infrastructure-cdk-spec-v0.6.md`, and `docs/11-codex-implementation-brief-v1.0.md` point to the same next task.

3. Correct stale PR numbering in placeholder/deferred-behavior text.
   - Done when Persistent Control API deferral points to `PR-010`, not `PR-009`.

4. Run deterministic checks and record evidence.
   - Done when the docs/reference checks and workspace checks pass, or any blocker is recorded precisely.

## Risks and constraints

- Under-specifying PR-009 would let future slices continue to bypass deployed verification.
- Over-specifying PR-009 could accidentally include Persistent Control API implementation; the task must deploy current foundations and smoke-check the placeholder API first.
- Adding a manual dispatch deployment path would conflict with the global rule against manual deploy workflow triggers.
- Using logs or synth output as acceptance evidence would recreate the contradiction the user is trying to remove.
- The repository must not imply frontend deployed verification exists before frontend hosting is implemented.
- CI/CD details may depend on GitHub environment secrets and AWS OIDC roles that are outside the repo; the PR-009 spec must list those as prerequisites/blockers rather than pretending they are already configured.

## Progress, blockers, and evidence

- Loaded the `planning`, `specification`, and `testing` skills explicitly for this docs/specification change.
- Created branch `codex/define-ci-deployment-task`.
- Read `AGENTS.md`, `docs/codex/BUILD_ORDER.md`, `docs/08-implementation-backlog-v0.7.md`, `docs/07-infrastructure-cdk-spec-v0.6.md`, `docs/11-codex-implementation-brief-v1.0.md`, `.github/workflows/ci.yml`, and `infra/src/lambda/control-api-placeholder.ts`.
- Found a stale contradiction: `infra/src/lambda/control-api-placeholder.ts` still says Persistent Control API behavior is deferred until `PR-009`, but the agreed build order now makes `PR-009` the deployment pipeline and `PR-010` Persistent Control API.
- Plan review gate:
  - I agree with the plan.
  - It contains the needed scope boundaries and proof for this task.
  - The best solution is to add a dedicated PR-009 specification and link it from the governing docs, while avoiding deployment implementation in this task.
  - Confidence: HECK YES that implementing this plan will make CI-backed AWS deployment the next task and remove the stale PR-numbering contradiction.
- Added `docs/codex/PR-009-CI-DEPLOYMENT-PIPELINE.md` as the dedicated next-task contract.
- Linked PR-009 from `AGENTS.md`, `docs/codex/BUILD_ORDER.md`, `docs/08-implementation-backlog-v0.7.md`, `docs/07-infrastructure-cdk-spec-v0.6.md`, and `docs/11-codex-implementation-brief-v1.0.md`.
- Corrected the placeholder Control API deferral from `PR-009` to `PR-010`.
- Deterministic evidence:
  - `rg` found no stale literal references to `Persistent Control API behavior is deferred until PR-009`, `deferredUntil: "PR-009"`, `deferred until PR-009`, or `deferred to PR-009`.
  - `rg` found deployment language only in CI-owned or explicitly forbidden-local/manual contexts.
  - `git diff --check` passed.
  - `pnpm lint` passed.
  - `pnpm typecheck` passed.
  - `pnpm test` passed.
  - `pnpm cdk synth` passed and synthesized `AgentCorePdfTranslator-dev-StorageStack`, `AgentCorePdfTranslator-dev-DatabaseStack`, and `AgentCorePdfTranslator-dev-ControlApiStack`.
- Refactoring assessment:
  - No refactor is useful here; changes are documentation/specification updates plus one stale placeholder string correction.
- Deployed verification:
  - Not applicable for this task. No AWS deployment was implemented or run.
- Telemetry verification:
  - Not applicable for this task. No deployed runtime validation run was introduced.
- Completion evidence:
  - PR #9: `https://github.com/guilleojeda/unit-economics-of-ai-agents/pull/9`.
  - PR #9 merged to `main` at `2026-05-20T13:21:59Z`.
  - Merge commit: `419cf1666ec4f18c78c4fc0d7a2a6cc3c1c5c56a`.
  - PR checks passed before merge: `verify` passed in GitHub Actions run `26165226324`.
  - Post-merge CI passed on merged SHA `419cf1666ec4f18c78c4fc0d7a2a6cc3c1c5c56a` in GitHub Actions run `26165333191`.
  - Post-merge CI evidence URL: `https://github.com/guilleojeda/unit-economics-of-ai-agents/actions/runs/26165333191`.
- Current blockers:
  - None.
