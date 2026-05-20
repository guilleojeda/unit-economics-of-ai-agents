# PLAN

## Objective

Perform an adversarial review of the remaining story contracts and patch high-confidence planning defects that could prevent the stories from producing the intended deployed product.

## Scope and non-goals

In scope:

- Review PR-009 through PR-016, including PR-010A.
- Challenge sequencing, hidden assumptions, verification gaps, and product-economics risks.
- Patch story-contract defects that are directly supported by existing docs.
- Preserve the next implementation task as PR-009.

Out of scope:

- Do not edit `/Users/guille/.codex/AGENTS.md`.
- Do not implement application, infrastructure, CI, frontend, AgentCore, Bedrock, or PDF code.
- Do not run `cdk deploy` or manually modify AWS resources.
- Do not choose unresolved implementation options unless the docs already make the choice.
- Do not introduce replay, synthetic-run, live-capture, recording, or presentation behavior.

## Assumptions and open questions

- The stories should be strong enough to guide implementation without inventing product behavior at implementation time.
- A story-contract patch is appropriate when the current story contradicts product docs or leaves a verification gap large enough to accept the wrong product.
- PR-009 remains the next implementation task and must not be broadened.
- PR-010 can include a placeholder document-inspection contract only if it is honest, deterministic, and does not claim real PDF extraction or translation quality.

## Expected outcomes

- PR-010 and PR-010A require the upload -> inspect -> READY -> job creation flow before job/run behavior is accepted.
- Pre-Gateway and pre-Bedrock stories cannot create misleading model-inference economics.
- V1 verification includes direct content/glossary checks, not only PDF readability.
- V3 optimization verification cannot be satisfied by hiding costs or forcing a cheaper-looking path without evidence.
- PR-016 final pass explicitly confirms normal product use without adding recording/presentation product modes.

## Product design

The product should behave as a normal deployed app for a controlled Spanish PDF workflow. A document becomes usable for jobs only after inspection marks it `READY`. Runs create real persisted workflow records, artifacts, ledger rows, evaluation results, and reviewer decisions. Economics come from `LedgerItem` rows, with cost-basis labels that do not exaggerate reconciliation.

Development scaffolding may prove contracts before Gateway or real PDF tooling exists, but it must be labeled honestly, not be selectable as a fake product mode, and not create model-inference economics unless a model was actually invoked.

## Deterministic checks

- `rg` verifies PR-010/PR-010A include inspection/readiness gating.
- `rg` verifies PR-012 forbids fake `MODEL_INFERENCE` rows.
- `rg` verifies PR-013 includes glossary/content verification.
- `rg` verifies PR-015 avoids forced cheaper full-cost acceptance without evidence.
- `git diff --check`.
- `pnpm lint`.

## Deployed verification

Not applicable for this task. This is a documentation/story-contract review and patch only; it introduces no deployed runtime path.

## Telemetry verification

Not applicable for this task. No runtime validation run is introduced.

## Implementation steps

1. Patch document readiness and inspection gaps in PR-010 and PR-010A.
   - Done when job creation is gated by explicit inspection to `READY`.

2. Patch economics and quality verification gaps in PR-012 through PR-016.
   - Done when fake model costs, weak V1 content checks, forced V3 cost claims, and final product-mode verification gaps are addressed.

3. Run deterministic checks and record evidence.
   - Done when planned checks pass or blockers are recorded.

## Risks and constraints

- A placeholder inspection path can become fake product behavior if it claims real PDF understanding before PR-013.
- Tightening V3 economics too much can incentivize hard-coded cheaper outcomes; verification must require honest comparison, not a predetermined result.
- Too much detail in story contracts can overconstrain implementation, so patches should target only acceptance-critical gaps.
- Documentation changes must not move PR-009 out of the next-task slot.

## Progress, blockers, and evidence

- Loaded `review-plan` and `review-plan-adversarial` skills.
- Created branch `codex/adversarial-story-review-fixes`.
- Read story contracts PR-009 through PR-016, `AGENTS.md`, `docs/codex/BUILD_ORDER.md`, `docs/reference/OPEN_DECISIONS.md`, `docs/reference/API_ROUTES.md`, `docs/reference/STATE_TRANSITIONS.md`, `docs/reference/WORKFLOW_VARIANTS.md`, `docs/reference/TOOL_CONTRACTS.md`, `docs/06-frontend-api-contract-v0.5.md`, `docs/04-data-model-and-contracts-v0.3.md`, and PRD acceptance criteria.
- Adversarial review finding:
  - PR-010/PR-010A had a job-creation/readiness gap: stories exercised job creation after upload without requiring document inspection to `READY`, while implemented state guards and product docs require READY documents for jobs.
  - PR-012 could allow pre-Bedrock Gateway proof to create misleading model-inference costs.
  - PR-013 V1 deployed verification checked PDF readability but did not explicitly require glossary/content checks from the controlled document.
  - PR-015 could be read as requiring lower full workflow cost even if routing overhead makes that false, which could incentivize hiding costs.
  - PR-016 did not explicitly tie final pass to normal product use without recording/presentation modes.
- Plan review gate:
  - I agree with the plan.
  - It contains the concrete defects found by the adversarial review and excludes speculative implementation choices.
  - The best solution is to patch the story contracts, not to implement code or change PR-009.
  - Confidence: HECK YES that this scoped patch will remove the identified acceptance gaps without weakening product guardrails.
- Patched PR-010 and PR-010A to require upload -> inspect -> `READY` before job/run behavior, including deployed verification, telemetry, acceptance, and review-trap coverage.
- Patched PR-012 to forbid fake `MODEL_INFERENCE` ledger rows before real model calls exist.
- Patched PR-013 to require direct translated-PDF content, page-count, glossary, and material Spanish-text checks before reviewer acceptance.
- Patched PR-015 to require honest V3 cost/margin comparison instead of forcing lower full workflow cost when routing overhead or retries make that false.
- Patched PR-016 to require normal product use under external recording without adding recording/replay/presentation product modes.
- Deterministic evidence:
  - `rg -n 'inspection|READY|pre-inspection|non-\`READY\`|status == READY' docs/codex/PR-010-PERSISTENT-CONTROL-API.md docs/codex/PR-010A-DEPLOYED-FRONTEND-ACCESS.md` passed.
  - `rg -n "MODEL_INFERENCE|fake model inference|model invocation" docs/codex/PR-012-AGENTCORE-RUNTIME-GATEWAY-INFRA.md` passed.
  - `rg -n "glossary|refund|eligibility|chargeback|manual review|escalated case|translated PDF content" docs/codex/PR-013-REAL-V1-PDF-WORKFLOW.md` passed.
  - `rg -n "unnecessary image-handling cost|routing overhead|hard-coded cheaper|full workflow cost and margin" docs/codex/PR-015-V3-OPTIMIZATION.md` passed.
  - `rg -n "external screen recording|recording, replay|normal app" docs/codex/PR-016-OBSERVABILITY-HARDENING.md` passed.
  - `git diff --check` passed.
  - `pnpm lint` passed.
- Deployed verification:
  - Not applicable. This task patches documentation/story contracts only and introduces no runtime path.
- Telemetry verification:
  - Not applicable. This task patches documentation/story contracts only and introduces no validation run.
- Current blockers:
  - None.
