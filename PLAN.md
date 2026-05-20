# PLAN

## Objective

Perform an eleventh adversarial review of all current story contracts and patch any clear defects that could let future slices pass while failing the intended AWS AgentCore unit-economics product.

## Scope and non-goals

In scope:

- Review PR-009, PR-010, PR-010A, and PR-011 through PR-016 from current `main`.
- Re-check the story set against repository instructions, reference contracts, and the intended controlled Spanish-to-English PDF economics workflow.
- Challenge the stories from a fresh failure perspective: environment identity, data isolation, acceptance evidence, deployed verification, telemetry evidence, economics truth, artifact lineage, and comparison integrity.
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
- Prior passes tightened deployment, fixture ownership, review cost, comparison assumptions, idempotency, artifact integrity, price-book versioning, model/configuration comparison evidence, private artifact access, immutable source lineage, explicit artifact-bearing tool requests, and implementation provenance.
- Open question to resolve by reading: do future stories have enough contract language to prevent cross-environment or cross-tenant contamination in persisted evidence, deployed verification, and comparison queries once CI deployment exists?

## Expected outcomes

- Any new high-confidence story-contract defects found by this pass are fixed narrowly.
- Future validation evidence should be bound to the intended environment and isolated validation dataset, not merely to any persisted job/run with matching IDs.
- If no new defects are found, the review evidence explains why no story edits were made.
- No runtime behavior changes are made.
- PR-009 remains the next implementation task.

## Product design

The product is an AWS AgentCore-based unit-economics app for controlled Spanish-to-English PDF workflow measurement. `TranslationJob` is the business unit, `Run` is a technical attempt, and `LedgerItem` records are the economics source of truth. V1, V2, and V3 are architecture variants; acceptance evidence must prove the controlled workflow in the intended deployed environment without borrowing stale, local, fixture, or wrong-environment records.

## Deterministic checks

- Targeted `rg` checks for any patched contract language.
- Targeted `rg` checks for environment identity, validation selector, comparison, and telemetry isolation wording.
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
   - Done when environment identity, validation isolation, deployed acceptance evidence, telemetry selectors, and comparison integrity have been challenged from a fresh angle.

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

- Loaded `planning`, `review-plan`, `review-plan-adversarial`, and `testing` skills.
- Confirmed starting point: clean `main` at `649b8c7`.
- Created branch `codex/adversarial-story-review-pass-11`.
- Plan review gate:
  - I agree with this plan.
  - It contains enough to perform a fresh adversarial pass focused on environment and validation isolation without re-litigating only prior findings.
  - The best solution is to read the story set and references, then patch only grounded defects.
  - Confidence: HECK YES that this is the right process for this review pass.
- Read AGENTS.md, README.md excerpts, BUILD_ORDER, PR-009, PR-010, PR-010A, PR-011 through PR-016, API routes, entity model, tool contracts, workflow variants, costing rules, state transitions, S3 key reference, current schemas, repository interfaces, and relevant PRD/ADR/implementation-brief excerpts.
- Finding 1: PR-009's deploy artifact contract did not require AWS account ID or CI role/session identity. If left unfixed, later deployed verification could accidentally use stack outputs from the wrong AWS account or stage while still matching `dev`, `us-east-1`, and a merged SHA. Patched PR-009 to require account/stage/role identity in the deploy artifact and telemetry selectors.
- Finding 2: PR-010 and the API reference required artifact workspace ownership, but did not globally require every product API route, list, comparison, and mutation to resolve workspace/environment server-side. If left unfixed, a client-supplied ID could let wrong-workspace or wrong-environment records satisfy reads, comparisons, or validation evidence. Patched API routes and PR-010 to require server-resolved workspace/environment scoping and negative tests.
- Finding 3: Later stories referenced `validationRunId`, but the shared contracts did not define it as correlation-only evidence or require environment/workspace matching in V1/V2/V3 comparison prerequisites. If left unfixed, validation selectors could drift into product-mode behavior, or comparisons could silently mix records from different account/stage/workspace validation contexts. Patched PR-010 through PR-016 and reference docs to require environment/workspace/validation evidence and mismatch labeling/blocking.
- Finding 4: Current GitHub Actions checks emit a Node.js 20 JavaScript-action deprecation warning. If PR-009 builds the deployment foundation without addressing that, the deployment gate could inherit an already-known upcoming CI runtime failure. Patched PR-009 to require the deployment workflow to use non-deprecated action/runtime configuration and to fail if the warning remains.
- Plan review gate after patching:
  - I agree with the revised plan and patches.
  - The plan now contains the concrete failure mode, the evidence source, and the narrow docs-only corrections.
  - The solution is better than a broad rewrite because it adds environment/account/workspace/selector requirements exactly where future acceptance could be contaminated.
  - Confidence: HECK YES that these patches strengthen the story set without changing application code, adding product modes, or moving PR-009 out of the next-task position.
- Deterministic check evidence:
  - Environment/validation targeted `rg` scan passed and found the expected wrong-environment, wrong-account, wrong-workspace, AWS account, `validationRunId`, server-resolved workspace, and Node.js 20 story-contract language.
  - Product-mode targeted `rg` scan passed and confirmed validation selectors are described as correlation-only and not replay, synthetic, live-capture, recording, or presentation behavior.
  - `git diff --check` passed.
  - `pnpm lint` passed.
- Deployed verification: not applicable; no runtime behavior or infrastructure changed.
- Telemetry verification: not applicable; no runtime validation run was introduced.
