# PLAN

## Objective

Perform another adversarial review of all remaining story contracts and patch any clear defects that could let future implementation pass while violating the intended AWS AgentCore unit-economics product.

## Scope and non-goals

In scope:

- Review PR-009 through PR-016 from current `main`.
- Challenge assumptions, sequencing, verification, rollback/recovery, telemetry, cost truth, fixture discipline, and product-mode boundaries.
- Patch story contracts where defects are grounded in existing AGENTS.md, PRD, ADRs, implementation brief, or reference docs.

Out of scope:

- Do not edit `/Users/guille/.codex/AGENTS.md`.
- Do not implement application, infrastructure, CI, AgentCore, Bedrock, PDF, or frontend code.
- Do not run `cdk deploy` or manually modify AWS resources.
- Do not choose unresolved implementation options unless existing docs already require a choice.
- Do not introduce replay, synthetic-run, live-capture, recording, or presentation behavior.

## Assumptions and open questions

- PR-009 remains the next implementation task.
- The current task is a docs/story-contract review; deployed verification is not applicable unless runtime behavior is changed.
- Previous review passes may have missed gaps in operational recovery, traceability, security posture, or acceptance evidence.

## Expected outcomes

- Any new high-confidence story-contract defects found by this pass are fixed.
- If no new defects are found, the review evidence explains why no story edits were made.
- No runtime behavior changes are made in this patch.

## Product design

The intended product is an AWS AgentCore-based unit-economics app. `TranslationJob` is the business unit, `Run` is a technical attempt, and `LedgerItem` records are the economics source of truth. The product must stay centered on real persisted jobs, runs, review decisions, artifacts, and ledger rows, not fake histories, logs-only economics, or product modes.

Future slices are accepted only after post-merge CI deployment, direct deployed use by Codex, and recorded evidence. Story contracts must make that loop executable without leaving hidden gaps that let local checks, screenshots, logs, or substituted fixtures stand in for the intended product evidence.

## Deterministic checks

- `rg` checks for any patched story-contract language.
- `git diff --check`.
- `pnpm lint`.

## Deployed verification

Not applicable for this task. This is a documentation/story-contract review and patch only; it introduces no deployed runtime path.

## Telemetry verification

Not applicable for this task. No runtime validation run is introduced.

## Implementation steps

1. Read the governing instructions and story contracts.
   - Done when AGENTS.md, PR-009 through PR-016, and relevant reference docs have been inspected.

2. Perform adversarial review.
   - Done when assumptions, failure modes, sequencing risks, and verification gaps have been challenged.

3. Patch grounded defects if found.
   - Done when any required story-contract changes are made narrowly and recorded.

4. Run deterministic checks and record evidence.
   - Done when planned checks pass or blockers are recorded.

## Risks and constraints

- Do not add process weight without a concrete failure mode.
- Do not obscure PR-009 as the next task.
- Do not create contradictions with the repository-local AGENTS.md or global delivery rules.
- Do not overconstrain open implementation decisions that are intentionally owned by later stories.

## Progress, blockers, and evidence

- Loaded `review-plan` and `review-plan-adversarial` skills.
- Confirmed starting point: clean `main` at `d222df6`.
- Created branch `codex/adversarial-story-review-pass-5`.
- Plan review gate:
  - I agree with this plan.
  - It contains enough to run a fresh adversarial story review without assuming a predetermined patch.
  - The best solution is to read first and patch only grounded defects; otherwise record no-op evidence.
  - Confidence: HECK YES that this is the right process for another review pass.
- Read AGENTS.md, PR-009 through PR-016, PRD, ADRs, implementation brief, and references for state transitions, costing, API routes, tool contracts, and open decisions.
- Adversarial review findings:
  - Review decisions were consistently described as costed, but the later story contracts did not consistently require positive reviewer seconds. A zero-second review could create a `HUMAN_REVIEW` row that makes review look free.
  - PR-013 required real V1 PDF inspection but did not explicitly prevent PR-010's placeholder inspection readiness from being reused as V1 acceptance evidence.
  - V1/V2/V3 comparisons required the same document lineage but did not consistently require matching `PriceBook` versions and business value assumptions, so margin comparisons could be invalid while appearing apples-to-apples.
- Patched PR-010 and PR-011 to require positive reviewer seconds in review request validation and non-zero `HUMAN_REVIEW` cost for review decisions.
- Patched PR-013 to require real PDF inspection metadata/artifacts for V1 readiness and to reject placeholder inspection as V1 acceptance evidence.
- Patched PR-013 through PR-016 so review decisions require positive reviewer seconds and non-zero human-review cost where review occurs.
- Patched PR-014 through PR-016 so V1/V2/V3 comparison evidence uses matching `PriceBook` versions and business value assumptions, or explicitly blocks/labels mismatches.
- Deterministic evidence:
  - `rg -n 'positive reviewer seconds|HUMAN_REVIEW|zero or missing reviewer seconds|reviewer seconds' docs/codex/PR-010-PERSISTENT-CONTROL-API.md docs/codex/PR-011-AGENT-RUNTIME-STAGE-RUNNER.md docs/codex/PR-013-REAL-V1-PDF-WORKFLOW.md docs/codex/PR-014-V2-IMAGE-ANNOTATION.md docs/codex/PR-015-V3-OPTIMIZATION.md docs/codex/PR-016-OBSERVABILITY-HARDENING.md` passed.
  - `rg -n "placeholder inspection|real PDF inspection|placeholder readiness|real inspection" docs/codex/PR-013-REAL-V1-PDF-WORKFLOW.md` passed.
  - `rg -n "PriceBook|price book|business value assumptions|apples-to-apples|mismatch|mismatched" docs/codex/PR-014-V2-IMAGE-ANNOTATION.md docs/codex/PR-015-V3-OPTIMIZATION.md docs/codex/PR-016-OBSERVABILITY-HARDENING.md` passed.
  - `git diff --check` passed.
  - `pnpm lint` passed.
- Deployed verification:
  - Not applicable. This task patches documentation/story contracts only and introduces no runtime path.
- Telemetry verification:
  - Not applicable. This task patches documentation/story contracts only and introduces no validation run.
- Current blockers:
  - None.
