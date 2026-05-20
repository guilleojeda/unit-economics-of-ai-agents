# PLAN

## Objective

Perform a tenth adversarial review of all current story contracts and patch any clear defects that could let future slices pass while failing the intended AWS AgentCore unit-economics product.

## Scope and non-goals

In scope:

- Review PR-009, PR-010, PR-010A, and PR-011 through PR-016 from current `main`.
- Challenge the stories from a fresh failure perspective: deployed implementation provenance, stale historical comparison data, validation run isolation, environment contamination, acceptance evidence, economics truth, and tool/runtime traceability.
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
- Prior passes tightened deployment, fixture ownership, review cost, comparison assumptions, idempotency, artifact integrity, price-book versioning, model/configuration comparison evidence, private artifact access, immutable source lineage, and explicit artifact-bearing tool requests.
- Fresh adversarial assumption under review: V1/V2/V3 comparison evidence can still be contaminated if runs were produced by different deployed implementation versions or stale historical code while all visible economic/source/model prerequisites match.
- Open question to resolve by reading: do the current stories require persisted run/job evidence to identify the deployed implementation/build version that produced the result, and do comparison stories block or label implementation-version mismatches?

## Expected outcomes

- Any new high-confidence story-contract defects found by this pass are fixed narrowly.
- Validation and comparison evidence should be able to distinguish workflow variant effects from code/deployment-version effects.
- If no new defects are found, the review evidence explains why no story edits were made.
- No runtime behavior changes are made.
- PR-009 remains the next implementation task.

## Product design

The product is an AWS AgentCore-based unit-economics app for controlled Spanish-to-English PDF workflow measurement. `TranslationJob` is the business unit, `Run` is a technical attempt, and `LedgerItem` records are the economics source of truth. V1, V2, and V3 are architecture variants; if comparisons silently mix different deployed implementation versions, the product can mistake code drift for architecture-driven margin change.

## Deterministic checks

- Targeted `rg` checks for any patched contract language.
- Targeted `rg` checks for implementation-version, deployed-SHA, stale comparison, and validation-run isolation wording.
- `git diff --check`.
- `pnpm lint`.

## Deployed verification

Not applicable for this task. This is a documentation/story-contract review and patch only; it introduces no deployed runtime path.

## Telemetry verification

Not applicable for this task. No runtime validation run is introduced.

## Implementation steps

1. Read the governing instructions, story contracts, and relevant reference docs.
   - Done when AGENTS.md, PR-009 through PR-016, reference docs, and relevant product docs have been inspected.

2. Perform adversarial review.
   - Done when implementation provenance, stale comparison data, validation isolation, and deployed acceptance evidence have been challenged from a new angle.

3. Patch grounded defects if found.
   - Done when required story/reference changes are made narrowly and recorded.

4. Run deterministic checks and record evidence.
   - Done when checks pass or blockers are recorded.

## Risks and constraints

- Do not add process weight without a concrete failure mode.
- Do not obscure PR-009 as the next task.
- Do not create contradictions with repository-local AGENTS.md or global delivery rules.
- Do not overconstrain legitimate historical comparison; require proof or labeling rather than forbidding history.
- Avoid repeating previous passes unless the repeated concern reveals a new concrete contract hole.

## Progress, blockers, and evidence

- Loaded `review-plan`, `review-plan-adversarial`, `planning`, and `testing` skills.
- Confirmed starting point: clean `main` at `fc8bff4`.
- Created branch `codex/adversarial-story-review-pass-10`.
- Plan review gate:
  - I agree with this plan.
  - It contains enough to perform a fresh adversarial pass focused on implementation provenance and stale comparison risk without re-litigating only prior findings.
  - The best solution is to read the story set and references, then patch only grounded defects.
  - Confidence: HECK YES that this is the right process for this review pass.
- Read AGENTS.md, PR-009, PR-010, PR-010A, PR-011 through PR-016, API routes, entity model, tool contracts, current schemas, PRD comparison/acceptance sections, and ADR-039/048/049.
- Finding 1: Story contracts required deployed verification and deploy artifacts, but run/stage/evaluation records were not required to retain implementation provenance. If left unfixed, later evidence could show correct source, price book, and model configuration while hiding that a stale or different deployed build produced the result. Patched PR-011 through PR-013 plus entity/tool references.
- Finding 2: V1/V2/V3 comparison prerequisites covered source lineage, price book, value assumptions, and model/prompt configuration, but not compatible workflow implementation provenance. If left unfixed, comparison views could attribute cost or quality changes to architecture variants when they were caused by code/deployment drift. Patched PR-014 through PR-016 plus API/entity references to require provenance evidence and stale/build-mismatch labeling or blocking.
- Finding 3: PR-009 deploy artifacts already required deployed SHA, but did not state that this machine-readable identity is the future provenance anchor for persisted runs. Patched PR-009 to preserve that contract without adding product behavior.
- Plan review gate after patching:
  - I agree with the revised plan and scope.
  - It contains enough to prove this docs-only review pass.
  - The solution is narrow: persisted implementation provenance and comparison mismatch labeling/blocking only.
  - Confidence: HECK YES that these patches address stale/build-contaminated comparison evidence without changing PR-009 as the next task or forbidding legitimate historical comparisons.
- Deterministic check evidence:
  - Implementation-provenance `rg` scan passed and found the expected deployed commit/build, runtime image, tool Lambda, Gateway target, stale/build-mismatch, and implementation-version language in patched story/reference docs.
  - Comparison-prerequisite `rg` scan passed and found implementation-provenance mismatch blocking/labeling alongside existing source, price-book, value, and model/prompt prerequisite language.
  - `git diff --check` passed.
  - `pnpm lint` passed.
- Deployed verification: not applicable; no runtime behavior or infrastructure changed.
- Telemetry verification: not applicable; no runtime validation run was introduced.
