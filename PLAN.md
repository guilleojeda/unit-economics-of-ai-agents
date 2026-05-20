# PLAN

## Objective

Perform another adversarial review of all remaining story contracts and patch any clear defects that could let future implementation pass while violating the intended AWS AgentCore unit-economics product.

## Scope and non-goals

In scope:

- Review PR-009 through PR-016 from current `main`.
- Challenge sequencing, product-mode leakage, fixture ownership, deployed-verification assumptions, economics source-of-truth requirements, and V1/V2/V3 boundaries.
- Patch story contracts where the defect is grounded in existing ADRs, AGENTS.md, the PRD, implementation brief, or reference docs.

Out of scope:

- Do not edit `/Users/guille/.codex/AGENTS.md`.
- Do not implement application, infrastructure, CI, AgentCore, Bedrock, PDF, or frontend code.
- Do not run `cdk deploy` or manually modify AWS resources.
- Do not choose unresolved implementation options unless existing docs already require a choice.
- Do not introduce replay, synthetic-run, live-capture, recording, or presentation behavior.

## Assumptions and open questions

- PR-009 remains the next implementation task.
- The current task is a docs/story-contract review; deployed verification is not applicable unless runtime behavior is changed.
- V1 must work before V2/V3 behavior is product-executable, but later V2/V3 contracts may still be planned.
- Multiple stories depend on the controlled Spanish PDF; the fixture should be owned explicitly so verification does not depend on an ad hoc local file.

## Expected outcomes

- PR-011 does not allow deployed V2/V3 execution before V1 is real.
- PR-011 labels pre-Gateway development output honestly and prevents it from being mistaken for proof that the real V1 PDF workflow works.
- The controlled MVP PDF fixture is explicitly owned and validated before real V1/V2/V3 verification depends on it.
- No runtime behavior changes are made in this patch.

## Product design

The intended product is an AWS AgentCore-based unit-economics app. `TranslationJob` is the business unit, `Run` is a technical attempt, and `LedgerItem` records are the economics source of truth. The product must stay centered on real persisted jobs, runs, review decisions, artifacts, and ledger rows, not fake histories or product modes.

PR-011 is a temporary architecture step to prove runner mechanics before AgentCore Runtime and Gateway are wired in. It must not become a product-facing way to execute V2/V3 early or imply that the real PDF translation workflow is already complete.

The controlled PDF is part of the product method. V1, V2, and V3 only produce meaningful comparisons if they run against the same stable document containing the required glossary terms, page 4 process diagram, and decorative image.

## Deterministic checks

- `rg` verifies PR-011 limits executable deployed behavior to V1/pre-Gateway proof and gates V2/V3.
- `rg` verifies the controlled MVP PDF fixture is explicitly owned and validated.
- `git diff --check`.
- `pnpm lint`.

## Deployed verification

Not applicable for this task. This is a documentation/story-contract review and patch only; it introduces no deployed runtime path.

## Telemetry verification

Not applicable for this task. No runtime validation run is introduced.

## Implementation steps

1. Patch PR-011 V2/V3 sequencing and pre-Gateway proof-language gaps.
   - Done when PR-011 explicitly blocks deployed V2/V3 execution before their owning stories and labels pre-Gateway proof output as not proof of real V1 PDF translation.

2. Patch controlled fixture ownership in the earliest appropriate story and real V1 story.
   - Done when the story set clearly requires a stable controlled MVP PDF fixture and validates required content before V1/V2/V3 acceptance depends on it.

3. Run deterministic checks and record evidence.
   - Done when planned checks pass or blockers are recorded.

## Risks and constraints

- Do not erase PR-011's useful purpose of proving runner/review/economics mechanics before AgentCore/Gateway.
- Do not let fixture creation become product-facing fake history.
- Do not broaden PR-010 or PR-013 into arbitrary PDF support.
- Do not move PR-009 out of next-task position.

## Progress, blockers, and evidence

- Loaded `review-plan` and `review-plan-adversarial` skills.
- Confirmed starting point: clean `main` at `d4578d2`.
- Created branch `codex/adversarial-story-review-pass-4`.
- Read AGENTS.md, MANIFEST.md, PR-009 through PR-016, PRD, ADRs, implementation brief, and reference docs for entity model, state transitions, tool contracts, costing, API routes, S3 keys, workflow variants, open decisions, and guardrails.
- Adversarial review findings:
  - PR-011 still scoped stage-plan generation for V1, V2, and V3 before real V1 exists. That risks violating the documented V1-before-V2/V3 sequencing and could let product-executable V2/V3 behavior leak in early.
  - PR-011 required accepting a pre-Gateway development run and showing cost per verified outcome, but did not explicitly prevent that evidence from being misused as proof that the real V1 PDF workflow works.
  - PR-010, PR-010A, PR-013, PR-014, PR-015, and PR-016 all depend on the controlled Spanish PDF, while the story set did not clearly assign ownership for creating or validating that stable fixture.
- Plan review gate:
  - I agree with the plan.
  - It contains what is needed for this review pass because it targets only concrete story-contract defects found by reading the docs.
  - The best solution is narrow documentation edits; application behavior should not be implemented in a review pass.
  - Confidence: HECK YES that the plan will reduce the chance of early V2/V3 leakage, fake proof of V1, or ad hoc validation documents.
- Patched PR-011 to limit deployed pre-Gateway execution to V1, gate V2/V3 until PR-014/PR-015, and require honest labeling that PR-011 output is pre-Gateway development proof rather than proof of the real V1 PDF workflow.
- Patched PR-010, PR-010A, PR-013, PR-014, PR-015, and PR-016 so deployed verification uses a repository-controlled MVP Spanish PDF fixture rather than ad hoc local files or substituted documents.
- Deterministic evidence:
  - `rg -n "pre-Gateway development proof|not evidence that the real V1 PDF workflow is complete|rejects or disables V2/V3|does not execute V2 or V3" docs/codex/PR-011-AGENT-RUNTIME-STAGE-RUNNER.md` passed.
  - `rg -n "repository-controlled MVP PDF fixture|repository-controlled MVP Spanish PDF fixture|repository-controlled Spanish PDF fixture|ad hoc" docs/codex/PR-010-PERSISTENT-CONTROL-API.md docs/codex/PR-010A-DEPLOYED-FRONTEND-ACCESS.md docs/codex/PR-013-REAL-V1-PDF-WORKFLOW.md docs/codex/PR-014-V2-IMAGE-ANNOTATION.md docs/codex/PR-015-V3-OPTIMIZATION.md docs/codex/PR-016-OBSERVABILITY-HARDENING.md` passed.
  - `git diff --check` passed.
  - `pnpm lint` passed.
- Deployed verification:
  - Not applicable. This task patches documentation/story contracts only and introduces no runtime path.
- Telemetry verification:
  - Not applicable. This task patches documentation/story contracts only and introduces no validation run.
- Current blockers:
  - None.
