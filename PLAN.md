# PLAN

## Objective

Align repository-local instructions and planning documents with the global Codex rule that delivery work is not accepted until it is deployed through CI, directly verified in the deployed environment, and recorded with evidence.

## Scope and non-goals

In scope:

- Update repository instruction documents only.
- Make CI-backed AWS deployment a required planned slice before persistent deployed behavior is wired.
- Clarify that manual `cdk deploy`, local deployment scripts, and manual AWS resource changes are forbidden for delivery completion.
- Clarify that deployed verification means Codex must use the deployed app/API directly after the CI deployment.
- Clarify the interim state: current CI is verification-only and must not be treated as deployment evidence.

Out of scope:

- Do not edit `/Users/guille/.codex/AGENTS.md`.
- Do not implement the deployment workflow yet.
- Do not run `cdk deploy`.
- Do not manually modify AWS resources.
- Do not implement Persistent Control API behavior yet.

## Assumptions and open questions

- The global `/Users/guille/.codex/AGENTS.md` file is the source of truth for delivery workflow. It must not be edited in this task.
- The next implementation step after this docs fix should be a CI-backed dev deployment pipeline, not Persistent Control API.
- Current frontend hosting is not implemented. Until frontend deployment exists, deployed verification may be limited to the deployed API and stack outputs for infrastructure/API slices. The docs should make that limitation explicit rather than pretending the full app can be used.

## Expected outcomes

- Repository-local `AGENTS.md` states that all AWS deployment must happen through CI/IaC and never through manual `cdk deploy`.
- Build-order docs include a CI-backed dev deployment pipeline before Persistent Control API.
- Infrastructure docs describe deployment as a GitHub Actions / CI sequence rather than local operator commands.
- Any deploy script mentioned by docs is framed as CI-invoked only.
- The docs distinguish verify-only CI from deploy CI.
- Future delivery slices cannot be marked accepted based on tests, synth, logs, or screenshots alone when a deployed product/API path is affected.

## Product design

This repository should support a disciplined delivery loop:

1. A PR changes product, API, infrastructure, or runtime behavior.
2. CI runs deterministic verification.
3. The PR is merged when review and checks pass.
4. The normal CI deployment deploys the merged SHA to the AWS dev environment.
5. Codex uses the deployed app or API directly.
6. Codex records deployed and telemetry evidence in `PLAN.md`.
7. Only then can the slice be called complete.

For slices that only define code with no deployed runtime path, the plan must say deployed verification is not applicable and why. Once the CI-backed dev deployment exists, any slice that affects deployed behavior must include deployed verification.

## Deterministic checks

- `rg` checks for stale build-order references.
- `rg` checks that manual deployment language is either removed or explicitly CI-scoped.
- Documentation review of changed files.

## Deployed verification

Not applicable. This task changes repository instructions only and deliberately does not implement or run deployment.

## Telemetry verification

Not applicable. No runtime code path or deployed validation run is introduced by this documentation-only change.

## Implementation steps

1. Update repository-local `AGENTS.md` with CI-only deployment and completion rules.
   - Done when future agents can see the delivery rule without reading the home file.

2. Insert a CI-backed dev deployment pipeline into the build order before Persistent Control API.
   - Done when `AGENTS.md`, `docs/codex/BUILD_ORDER.md`, and `docs/11-codex-implementation-brief-v1.0.md` agree.

3. Update the backlog and infrastructure docs so deployment is CI-owned.
   - Done when the docs no longer imply manual local `cdk deploy` is an acceptable delivery path.

4. Run deterministic documentation checks and record evidence.
   - Done when stale references are resolved or documented.

## Risks and constraints

- Overcorrecting the docs could imply every docs-only change requires AWS deployment. The instructions should apply deployed verification to delivery slices that affect deployed behavior.
- Under-correcting the docs would allow the next slice to wire persistent Control API before a CI deployment path exists.
- Renumbering PRs can create drift. All main build-order references must be updated together.
- Home `AGENTS.md` remains authoritative and must not be edited.

## Progress, blockers, and evidence

- Read `/Users/guille/.codex/AGENTS.md`; deployment-through-CI and direct deployed verification are explicit global requirements.
- Read repository `AGENTS.md`; it lacked CI-only deployment and completion rules.
- Read `.github/workflows/ci.yml`; current CI configures AWS credentials but only runs `pnpm cdk synth`, not deployment.
- Read `docs/codex/BUILD_ORDER.md`, `docs/08-implementation-backlog-v0.7.md`, `docs/07-infrastructure-cdk-spec-v0.6.md`, and `docs/11-codex-implementation-brief-v1.0.md`; deployment exists as a desired outcome but CI-backed deployment is not a first-class planned slice.
- Plan review gate:
  - I agree with the plan.
  - It contains what is needed to fix the repository-instruction drift.
  - The best solution is to fix docs/instructions now, not implement deployment in this task.
  - Confidence: HECK YES that this will align the repo guidance with the global source of truth for future implementation work.
- Updated repository instructions:
  - `AGENTS.md` now states CI-only deployment, no manual `cdk deploy`, verification-only CI distinction, direct deployed-use evidence, and the new PR-009 deployment pipeline slice.
  - `AGENTS.md` now distinguishes project product/architecture source docs from the global delivery workflow baseline, so the file no longer falsely claims every instruction is sourced only from project docs.
  - `docs/codex/BUILD_ORDER.md` and `docs/11-codex-implementation-brief-v1.0.md` now insert `PR-009 — CI-backed dev deployment pipeline` before Persistent Control API and renumber later slices.
  - `docs/08-implementation-backlog-v0.7.md` now includes CI-backed deployment in Milestone 2 and the recommended build order.
  - `docs/07-infrastructure-cdk-spec-v0.6.md` now describes deployment as a CI/CD sequence and explicitly forbids manual AWS changes/local deploys.
  - `docs/09-prd-v0.8.md` now says deployment is through CI/CD.
- Deterministic evidence:
  - `rg` found no stale old Persistent Control API PR-009 wording or old build-order PR numbering in the primary instruction docs.
  - Remaining `ci-deploy-dev.sh` mention is explicitly CI-invoked only.
  - `git diff --check` passed.
  - `pnpm lint` passed.
- Deployed verification:
  - Not applicable; this task changes repository instructions only and does not implement or deploy runtime behavior.
- Current blockers:
  - None.
