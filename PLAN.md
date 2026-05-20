# PLAN

## Objective

Perform another adversarial review of all remaining story contracts and patch any clear defects that could let future implementation pass while violating the intended AWS AgentCore unit-economics product.

## Scope and non-goals

In scope:

- Review PR-009 through PR-016 from current `main`.
- Challenge state consistency, idempotency, access boundaries, artifact integrity, acceptance evidence, telemetry correlation, and comparison validity.
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
- Prior review passes have tightened deployment, fixture, review-cost, and comparison assumptions, but may not have fully covered API idempotency, object integrity, and cross-entity state consistency.
- Adversarial finding: the remaining story contracts could still pass a single happy-path validation while browser retries, client resubmits, Runtime retries, Gateway/Lambda redelivery, or duplicate review submissions create duplicated product records and corrupted ledger-derived economics.

## Expected outcomes

- Any new high-confidence story-contract defects found by this pass are fixed.
- Story contracts explicitly require idempotent or conditionally written mutating routes, workflow/stage persistence, tool/model deliveries, and reviewer decisions.
- Story contracts explicitly require source and translated artifact integrity metadata and reject arbitrary or unverified S3 source keys.
- If no new defects are found, the review evidence explains why no story edits were made.
- No runtime behavior changes are made in this patch.

## Product design

The intended product is an AWS AgentCore-based unit-economics app. `TranslationJob` is the business unit, `Run` is a technical attempt, and `LedgerItem` records are the economics source of truth. The product must stay centered on real persisted jobs, runs, review decisions, artifacts, and ledger rows, not fake histories, logs-only economics, or product modes.

Because the app will accept uploads, create jobs, start runs, and record review decisions, the stories must preserve state-machine correctness under retries and repeated user/API actions. A slice should not pass simply because the happy path worked once.

## Deterministic checks

- `rg` checks for idempotency, duplicate-delivery, and artifact-integrity story-contract language.
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
- Do not create contradictions with repository-local AGENTS.md or global delivery rules.
- Do not overconstrain open implementation decisions that are intentionally owned by later stories.

## Progress, blockers, and evidence

- Loaded `review-plan` and `review-plan-adversarial` skills.
- Confirmed starting point: clean `main` at `f78eabe`.
- Created branch `codex/adversarial-story-review-pass-6`.
- Plan review gate:
  - I agree with this plan.
  - It contains enough to run a fresh adversarial story review without assuming a predetermined patch.
  - The best solution is to read first and patch only grounded defects; otherwise record no-op evidence.
  - Confidence: HECK YES that this is the right process for another review pass.
- Read PR-010 through PR-016 plus API, S3 artifact, costing, and state-transition references.
- Finding 1: PR-010 did not sufficiently require idempotency/conditional writes for mutating routes or S3 source-object integrity before `Document`/`Artifact` creation. Patched PR-010 and reference docs.
- Finding 2: PR-011 through PR-013 did not sufficiently require retry-safe stage/tool/model/review persistence across runner, AgentCore Runtime, Gateway, Lambda, Bedrock, and browser/API retry boundaries. Patched PR-011, PR-012, and PR-013.
- Finding 3: PR-014 and PR-015 needed explicit duplicate-delivery protections for image-stage and V3 skipped-stage economics. Patched PR-014 and PR-015.
- Finding 4: PR-016 needed a final cross-variant idempotency and artifact-integrity audit so the finished product proves the invariant end to end. Patched PR-016.
- Plan review gate after patching:
  - I agree with the revised plan and scope.
  - It contains everything needed for this docs-only adversarial pass.
  - The solution is narrow: story and reference contracts only, no application implementation.
  - Confidence: HECK YES that these changes address the concrete failure mode without changing the next implementation task.
- Deterministic checks:
  - `rg -n "idempot|conditional-write|duplicate|checksum|artifact integrity|source-object|invocation identity|arbitrary S3|double-count|retry" ...` passed and found the new contract language across PR-010 through PR-016 plus API/S3 references.
  - `git diff --check` passed.
  - `pnpm lint` passed.
- Deployed verification: not applicable for this docs-only patch; no runtime behavior or infrastructure changed.
- Telemetry verification: not applicable for this docs-only patch.
