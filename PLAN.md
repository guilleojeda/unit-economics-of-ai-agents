# PLAN

## Objective

Create deploy-ready story contracts for PR-010 through PR-016 so the remaining build order can follow the PR-009 post-merge deployment, deploy artifact, direct-use, and evidence workflow.

## Scope and non-goals

In scope:

- Add dedicated story contract documents for PR-010 through PR-016.
- Each story contract must define objective, scope, non-goals, deterministic checks, deployed verification, telemetry verification, acceptance criteria, and review traps.
- Update build-order and guidance documents so future agents can find and use the story contracts.
- Preserve PR-009 as the current next task.

Out of scope:

- Do not edit `/Users/guille/.codex/AGENTS.md`.
- Do not implement application, infrastructure, CI, AgentCore, Bedrock, PDF, or frontend code.
- Do not run `cdk deploy`.
- Do not manually trigger deployment workflows.
- Do not manually modify AWS resources.
- Do not broaden PR-009 or change its post-merge-only scope.

## Assumptions and open questions

- PR-009 remains the immediate next implementation task.
- PR-010 through PR-016 should be ready enough to implement after PR-009, but they do not need to be implemented now.
- Later stories should each define their own deployed verification instead of relying on PR-009 to define all future validation.
- Some telemetry may not exist until PR-016; earlier story contracts should require honest telemetry status and available selectors, not fake success.

## Expected outcomes

- PR-010 through PR-016 each have a dedicated `docs/codex/PR-*.md` contract.
- The contracts are narrow enough to prevent scope creep but explicit enough to support post-merge deployment acceptance.
- The contracts require use of the deploy artifact from the merged SHA.
- The contracts define direct deployed use through the app/API for each story.
- The contracts identify telemetry requirements or blockers.
- The contracts preserve product guardrails: no replay/synthetic/live-capture/presentation modes, no hard-coded prices/model IDs, and no log-derived economics source of truth.

## Product design

After PR-009, each story should complete through this loop:

```text
story PR checks pass
story PR merges to main
normal CI deploys the merged SHA to dev
deploy artifact is produced
Codex directly exercises the story's deployed app/API behavior
Codex records deterministic, deployed, and telemetry evidence in PLAN.md
story is accepted only if expected outcomes are directly observed
```

The contracts should make the next observable product behavior precise without turning any story into a fake demo mode.

## Deterministic checks

- `rg` verifies story files exist for PR-010 through PR-016.
- `rg` verifies each story includes deploy artifact, deployed verification, telemetry verification, and forbidden outcome language.
- `git diff --check`.
- `pnpm lint`.

## Deployed verification

Not applicable for this task. This is a documentation/story-contract change and does not implement or deploy runtime behavior.

## Telemetry verification

Not applicable for this task. No runtime validation run is introduced.

## Implementation steps

1. Add PR-010 through PR-016 story contract documents.
   - Done when each story defines scope, non-goals, deterministic checks, deployed verification, telemetry verification, acceptance criteria, and review traps.

2. Update story indexes and guidance.
   - Done when `docs/codex/BUILD_ORDER.md`, `docs/08-implementation-backlog-v0.7.md`, `docs/11-codex-implementation-brief-v1.0.md`, `README.md`, and `MANIFEST.md` reference the story contracts.

3. Run deterministic checks and record evidence.
   - Done when docs/reference checks and lint pass, or blockers are recorded.

## Risks and constraints

- Story contracts that are too vague will not support the new deployment workflow.
- Story contracts that are too detailed may overconstrain implementation or absorb adjacent stories.
- PR-011 must not introduce a product-facing synthetic mode while still proving the runner shape before AgentCore.
- PR-013 through PR-015 must require real persisted jobs/runs/ledger rows, not demo histories.
- Telemetry requirements must not imply logs are the economics source of truth.

## Progress, blockers, and evidence

- Loaded `planning`, `specification`, and `testing` skills.
- Created branch `codex/add-story-contracts-pr010-pr016`.
- Read current build order, backlog, implementation brief, PR-009 contract, frontend/API contract, workflow implementation spec, route reference, and tool contract reference.
- Plan review gate:
  - I agree with the plan.
  - It contains the needed scope boundaries and proof for this documentation update.
  - The best solution is dedicated story contracts plus index updates, not edits scattered only in the backlog.
  - Confidence: HECK YES that implementing this plan will make PR-010 through PR-016 ready for the new post-merge deployment workflow at the story-contract level.
- Added dedicated story contracts:
  - `docs/codex/PR-010-PERSISTENT-CONTROL-API.md`
  - `docs/codex/PR-011-AGENT-RUNTIME-STAGE-RUNNER.md`
  - `docs/codex/PR-012-AGENTCORE-RUNTIME-GATEWAY-INFRA.md`
  - `docs/codex/PR-013-REAL-V1-PDF-WORKFLOW.md`
  - `docs/codex/PR-014-V2-IMAGE-ANNOTATION.md`
  - `docs/codex/PR-015-V3-OPTIMIZATION.md`
  - `docs/codex/PR-016-OBSERVABILITY-HARDENING.md`
- Updated `AGENTS.md`, `README.md`, `MANIFEST.md`, `docs/codex/BUILD_ORDER.md`, `docs/08-implementation-backlog-v0.7.md`, and `docs/11-codex-implementation-brief-v1.0.md` to reference the story contracts.
- Deterministic evidence:
  - `ls docs/codex/PR-01[0-6]-*.md` confirmed story files exist for PR-010 through PR-016.
  - `rg` confirmed each story includes deployed verification, telemetry verification, acceptance criteria, deploy artifact language, and forbidden-mode language.
  - `rg` confirmed story contract links are present in README, MANIFEST, AGENTS, BUILD_ORDER, backlog, and implementation brief.
  - `git diff --check` passed.
  - `pnpm lint` passed.
- Refactoring assessment:
  - No refactor is useful. The repeated story structure is intentional because each story must be directly usable as an implementation contract.
- Deployed verification:
  - Not applicable. This task creates documentation/story contracts only and does not implement or deploy runtime behavior.
- Telemetry verification:
  - Not applicable. No deployed runtime path was introduced.
- Completion evidence:
  - PR #11: `https://github.com/guilleojeda/unit-economics-of-ai-agents/pull/11`.
  - PR #11 merged to `main` at `2026-05-20T14:11:05Z`.
  - Merge commit: `33298ccfba5df13880f8c18b7a9ddb4a32a80944`.
  - PR checks passed before merge in GitHub Actions run `26168048736`.
  - Post-merge CI passed on merged SHA `33298ccfba5df13880f8c18b7a9ddb4a32a80944` in GitHub Actions run `26168157875`.
  - Post-merge CI evidence URL: `https://github.com/guilleojeda/unit-economics-of-ai-agents/actions/runs/26168157875`.
- Current blockers:
  - None.
