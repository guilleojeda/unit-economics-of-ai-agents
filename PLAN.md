# PLAN

## Objective

Refine the PR-009 CI deployment story so it clearly means post-merge deployment of accepted PRs to AWS, requires a deploy artifact, and does not absorb future slice-specific validation work.

## Scope and non-goals

In scope:

- Update the PR-009 task contract to clarify that deployment happens after merge to `main`, not as a per-PR preview deployment.
- Add the deploy artifact as an explicit PR-009 deliverable and acceptance criterion.
- Clarify that PR-009 enables future deployed validation gates but does not define reusable validation scripts or future slice-specific acceptance tests.
- Update any nearby build-order wording needed to avoid ambiguity.

Out of scope:

- Do not edit `/Users/guille/.codex/AGENTS.md`.
- Do not implement the CI deployment pipeline in this task.
- Do not implement reusable validation scripts in this task.
- Do not define acceptance checks for PR-010 or later slices in this task.
- Do not run `cdk deploy`.
- Do not manually trigger deployment workflows.
- Do not manually modify AWS resources.

## Assumptions and open questions

- The user clarified that "every future pull request is deployed to AWS" means every accepted PR after merge, not PR-branch preview environments.
- PR-009 should include one narrow smoke check and deploy artifact so the pipeline proves it can deploy and expose evidence.
- Slice-specific deployed validation belongs in later stories and should not be pulled into PR-009.

## Expected outcomes

- `docs/codex/PR-009-CI-DEPLOYMENT-PIPELINE.md` explicitly says there is no PR-branch preview environment requirement.
- PR-009 requires an archived or durable deploy artifact that includes commit SHA, CI run URL, deployed stack outputs, API URL, smoke result, and timestamp.
- PR-009 acceptance requires the deploy artifact, but not reusable validation tooling or future slice-specific checks.
- The completion gate for later slices says those slices extend their own requirements after PR-009 exists, rather than PR-009 defining them now.

## Product design

PR-009 is infrastructure groundwork. Its user-visible value is that an accepted repository change can be deployed to the AWS dev environment automatically after merge, with enough durable evidence for Codex and reviewers to know exactly what was deployed and how it was smoke-checked.

The desired loop is:

```text
future PR checks pass -> future PR is merged -> main deploys to dev through CI -> deploy artifact is produced -> Codex uses deployed app/API according to that slice's own requirements -> slice is accepted
```

PR-009 establishes the deployment and evidence path. Later slices define their own product-specific deployed validation.

## Deterministic checks

- `rg` checks that PR-009 does not require PR-branch preview deployments.
- `rg` checks that deploy artifact requirements are present.
- `git diff --check`.
- `pnpm lint`.

## Deployed verification

Not applicable for this task. This task refines the PR-009 story and does not implement or run deployment.

## Telemetry verification

Not applicable for this task. No deployed runtime path is introduced.

## Implementation steps

1. Tighten the PR-009 task contract.
   - Done when the story clearly says post-merge `main` deployment only, requires a deploy artifact, and excludes future slice-specific validation tooling.

2. Update related build-order wording if needed.
   - Done when immediate-next-task references remain aligned with the narrowed PR-009 scope.

3. Run deterministic checks and record evidence.
   - Done when the docs/reference checks and lint pass, or blockers are recorded.

## Risks and constraints

- If the story leaves "future pull request" ambiguous, it could be mistaken for preview deployments per branch.
- If PR-009 includes reusable validation tooling or slice-specific checks, it becomes too broad and delays the deployment foundation.
- If PR-009 omits a deploy artifact, later deployed verification will be harder to audit.
- The repo-local story must not weaken `/Users/guille/.codex/AGENTS.md`.

## Progress, blockers, and evidence

- Loaded `planning` and `specification` skills.
- Created branch `codex/refine-pr009-post-merge-deploy`.
- Read the current PR-009 task contract and searched for wording around pull requests, preview deployments, branch-only deploys, post-merge deploys, and deploy artifacts.
- Plan review gate:
  - I agree with the plan.
  - It contains the needed scope boundaries and proof for this docs refinement.
  - The best solution is a narrow story wording update, not CI implementation.
  - Confidence: HECK YES that this will encode the user's clarified intent without widening PR-009.
- Updated the PR-009 contract to state:
  - PR-009 deploys accepted changes after merge to `main`.
  - PR-009 does not create per-PR branch preview environments.
  - PR-009 must produce a durable `deploy-artifact-dev.json` or equivalent CI-owned deploy artifact.
  - PR-009 excludes reusable deployed-validation framework work and future slice-specific acceptance checks.
- Updated `AGENTS.md`, `docs/codex/BUILD_ORDER.md`, `docs/08-implementation-backlog-v0.7.md`, `docs/07-infrastructure-cdk-spec-v0.6.md`, and `docs/11-codex-implementation-brief-v1.0.md` to keep the surrounding story references aligned.
- Deterministic evidence:
  - `rg` confirmed explicit post-merge, no per-PR preview, and deploy artifact language is present in the PR-009 story and related build-order references.
  - `git diff --check` passed.
  - `pnpm lint` passed.
- Refactoring assessment:
  - No refactor is useful; this is a focused documentation/story clarification.
- Deployed verification:
  - Not applicable. No deployment workflow was implemented or run.
- Telemetry verification:
  - Not applicable. No deployed runtime path was introduced.
- Current blockers:
  - None.
