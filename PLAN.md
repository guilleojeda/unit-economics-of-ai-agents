# PLAN

## Objective

Perform a seventh adversarial review of all current story contracts and patch any clear defects that could let future slices pass while failing the intended AWS AgentCore unit-economics product.

## Scope and non-goals

In scope:

- Review PR-009, PR-010, PR-010A, and PR-011 through PR-016 from current `main`.
- Challenge environment isolation, deploy artifact usability, data lifecycle, access boundaries, price-book/versioning behavior, artifact access, state consistency, acceptance evidence, telemetry, and rollback/operational failure modes.
- Patch story or reference contracts only where defects are grounded in repository instructions and product docs.

Out of scope:

- Do not edit `/Users/guille/.codex/AGENTS.md`.
- Do not implement application, infrastructure, CI, AgentCore, Bedrock, PDF, frontend, or AWS runtime behavior.
- Do not run `cdk deploy` or manually modify AWS resources.
- Do not choose unresolved implementation options unless existing docs already require a choice.
- Do not introduce replay, synthetic-run, live-capture, recording, or presentation behavior.

## Assumptions and open questions

- PR-009 remains the next implementation task.
- This is a docs/story-contract review; deployed verification is not applicable unless runtime behavior changes.
- Prior passes have already tightened deployment, fixture ownership, review cost, comparison assumptions, idempotency, and artifact integrity. This pass should look for different failure modes, especially economics versioning, access/environment mistakes, and operational recovery gaps.
- Adversarial assumption under review: a current price-book update and model configuration changes can happen between V1, V2, V3, job creation, run execution, and review. Story contracts must prevent those changes from silently rewriting historical economics or invalidating comparison claims.

## Expected outcomes

- Any new high-confidence story-contract defects found by this pass are fixed narrowly.
- Historical economics cannot be repriced by changing the current `PriceBook`.
- V1/V2/V3 comparisons must prove or explicitly label/block mismatched model and prompt/configuration settings, not just mismatched price books or value assumptions.
- If no new defects are found, the review evidence explains why no story edits were made.
- No runtime behavior changes are made.
- PR-009 remains the next implementation task.

## Product design

The product is an AWS AgentCore-based unit-economics app for controlled Spanish-to-English PDF workflow measurement. `TranslationJob` is the business unit, `Run` is a technical attempt, and `LedgerItem` records are the economics source of truth. Story contracts must preserve historical economic truth, deployed verification discipline, artifact-based workflow boundaries, and honest acceptance evidence across V1, V2, and V3.

## Deterministic checks

- Targeted `rg` checks for any patched contract language.
- Targeted `rg` checks for stale active/current price-book wording.
- `git diff --check`.
- `pnpm lint`.

## Deployed verification

Not applicable for this task. This is a documentation/story-contract review and patch only; it introduces no deployed runtime path.

## Telemetry verification

Not applicable for this task. No runtime validation run is introduced.

## Implementation steps

1. Read the governing instructions, story contracts, and relevant reference docs.
   - Done when AGENTS.md, PR-009 through PR-016, and relevant references have been inspected.

2. Perform adversarial review.
   - Done when assumptions, failure modes, sequencing risks, and verification gaps have been challenged from a new angle.

3. Patch grounded defects if found.
   - Done when required story/reference changes are made narrowly and recorded.

4. Run deterministic checks and record evidence.
   - Done when checks pass or blockers are recorded.

## Risks and constraints

- Do not add process weight without a concrete failure mode.
- Do not obscure PR-009 as the next task.
- Do not create contradictions with repository-local AGENTS.md or global delivery rules.
- Do not overconstrain implementation choices that later stories intentionally own.

## Progress, blockers, and evidence

- Loaded `review-plan` and `review-plan-adversarial` skills.
- Confirmed starting point: clean `main` at `39178a4`.
- Created branch `codex/adversarial-story-review-pass-7`.
- Read repository-local AGENTS.md and prior `PLAN.md` evidence from pass 6.
- Plan review gate:
  - I agree with this plan.
  - It contains enough to perform a fresh adversarial pass without re-litigating only the previous idempotency finding.
  - The best solution is to read PR-009, PR-010A, and the later stories together, then patch only grounded defects.
  - Confidence: HECK YES that this is the right process for this review pass.
- Read PR-009, PR-010, PR-010A, PR-011 through PR-016, COSTING_RULES, API_ROUTES, STATE_TRANSITIONS, S3_ARTIFACT_KEYS, ENTITY_MODEL, PRD price-book requirements, ADR-019, ADR-034, and ADR-058.
- Finding 1: PR-010 exposed price-book reads/settings but did not explicitly make active price-book changes append-only or protect referenced versions from mutation. If left unfixed, historical job economics could be silently repriced after a settings change. Patched PR-010 plus API, costing, and entity references.
- Finding 2: PR-011 and PR-013 still allowed review cost wording to depend on the active/current price book instead of the job's recorded price-book version and value model. If left unfixed, review timing could alter job economics. Patched PR-011 and PR-013.
- Finding 3: V1/V2/V3 comparison stories required matching `PriceBook` and business value assumptions, but not matching model IDs or prompt/configuration versions. If left unfixed, a model/config change could be mistaken for a workflow-variant effect. Patched PR-013 through PR-016 plus API and entity references.
- Plan review gate after patching:
  - I agree with the revised plan and scope.
  - It contains enough to prove this docs-only review pass.
  - The solution is narrow: versioning/comparison-contract language only, no application implementation.
  - Confidence: HECK YES that these patches address the identified failure modes without changing PR-009 as the next task.
- Deterministic checks:
  - `rg -n 'append-only|reprice|repriced|job.s recorded|prompt/configuration|configuration-mismatched|model/configuration|comparison prerequisites|ACTIVE_PRICE_BOOK_VERSION' ...` passed and found the intended contract language in PR-010, PR-011, PR-013 through PR-016, API_ROUTES, COSTING_RULES, ENTITY_MODEL, and PLAN.md.
  - `git diff --check` passed.
  - `pnpm lint` passed.
- Deployed verification: not applicable for this docs-only patch; no runtime behavior or infrastructure changed.
- Telemetry verification: not applicable for this docs-only patch.
