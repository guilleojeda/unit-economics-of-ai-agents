# PLAN

## Objective

Close the story-planning gaps that could prevent the current build plan from becoming the intended deployed product: deployed frontend access, dev API protection, and ownership of remaining open implementation decisions.

## Scope and non-goals

In scope:

- Add a dedicated story contract for deployed frontend hosting, API wiring, and browser/app dev access protection.
- Strengthen `PR-010` so the real Persistent Control API must resolve dev API protection before product data is exposed.
- Update build-order and implementation guidance so this story is required before additional workflow execution slices.
- Update remaining story contracts so direct deployed verification uses the rendered app once frontend hosting exists.
- Clarify which future story must resolve each open implementation decision.
- Preserve the current next task as `PR-009 - CI-backed dev deployment pipeline`.

Out of scope:

- Do not edit `/Users/guille/.codex/AGENTS.md`.
- Do not implement application, infrastructure, CI, authentication, AgentCore, Bedrock, PDF, or frontend code.
- Do not run `cdk deploy` or manually modify AWS resources.
- Do not choose a frontend hosting provider, auth mechanism, model ID, PDF library, or runtime-cost basis in this documentation patch unless the existing docs already require one.
- Do not add replay, synthetic-run, live-capture, recording, or presentation behavior.

## Assumptions and open questions

- The docs already make `PR-009` the immediate next implementation task; this remains unchanged.
- The open decisions should not block `PR-009`, but each decision needs a story owner before it can block product acceptance later.
- A deployed frontend cannot be fully wired before the Persistent Control API exists, so the new frontend/access story should sit after `PR-010` and before workflow execution expands in `PR-011`.
- The exact frontend hosting choice remains open; this patch should require `PR-010A` to resolve and document it.
- The exact dev API protection choice remains open; this patch should require `PR-010` to resolve the API guardrail and `PR-010A` to extend the access model to the rendered app.

## Expected outcomes

- The build order contains a required `PR-010A` story for deployed frontend hosting, deployed UI to API wiring, and browser/app dev access protection.
- `PR-010` cannot be accepted with unauthenticated real product APIs.
- Future workflow stories cannot be accepted using API-only verification when the rendered app should expose the behavior.
- Real product API data must not be exposed anonymously after placeholder behavior ends.
- Remaining implementation choices are mapped to the story that must resolve them.
- The docs still forbid hard-coded prices/model IDs, log-derived economics, and replay/synthetic/presentation modes.
- No runtime or application behavior changes in this patch.

## Product design

The intended product is a deployed AWS-native app that a reviewer can use normally: upload a controlled Spanish PDF, inspect it, create jobs/runs, review translated PDFs and evaluations, accept or reject work, and inspect ledger-derived economics and comparison views.

After `PR-009`, API-only deployed verification is acceptable only while no rendered frontend is deployed. After the new frontend/access story is complete, user-facing behavior must be verified through the deployed app UI, with API calls allowed only as supporting evidence for backend-only details.

The deployed app must not be a fake demo shell. It must read and write through the deployed Control API, show persisted records, and avoid seeded product-facing histories. Dev access must be protected before real product data is exposed.

## Deterministic checks

- `rg` verifies `PR-010A` is present in build-order/index documents.
- `rg` verifies future story contracts require rendered app verification after frontend hosting exists.
- `rg` verifies open decisions have explicit story owners.
- `git diff --check`.
- `pnpm lint`.

## Deployed verification

Not applicable for this task. This is a documentation/story-contract change only and does not implement a deployed runtime path.

## Telemetry verification

Not applicable for this task. No runtime validation run is introduced.

## Implementation steps

1. Strengthen `PR-010` around real API protection.
   - Done when the story requires the dev API protection decision to be resolved and verified before persistent product data is exposed.

2. Add the `PR-010A` story contract.
   - Done when it defines objective, scope, non-goals, deterministic checks, deployed verification, telemetry verification, acceptance criteria, and review traps for deployed frontend hosting/API wiring/dev access protection.

3. Update build-order and index documents.
   - Done when `AGENTS.md`, `README.md`, `MANIFEST.md`, `docs/codex/BUILD_ORDER.md`, `docs/08-implementation-backlog-v0.7.md`, and `docs/11-codex-implementation-brief-v1.0.md` require `PR-010A` in sequence.

4. Update dependent story contracts and open-decision ownership.
   - Done when PR-011 through PR-016 point to the new prerequisite where needed and `docs/reference/OPEN_DECISIONS.md` maps decisions to resolving stories.

5. Run deterministic checks and record evidence.
   - Done when planned checks pass or blockers are recorded.

## Risks and constraints

- Inserting a new story must not make `PR-009` broader; `PR-009` stays post-merge dev deployment plumbing only.
- The new story must not force a frontend hosting decision prematurely in this patch, but it must require that decision before implementation.
- The frontend/access story must not become enterprise auth or production hardening.
- API-only verification must remain valid for backend-only evidence, but not as the sole proof for user-facing flows once the rendered app exists.
- The docs must stay consistent across root instructions, build order, backlog, implementation brief, README, and manifest.

## Progress, blockers, and evidence

- Loaded `planning`, `specification`, and `review-plan` skills.
- Created branch `codex/patch-story-readiness-gaps`.
- Read `AGENTS.md`, current `PLAN.md`, `README.md`, `MANIFEST.md`, `docs/09-prd-v0.8.md`, `docs/11-codex-implementation-brief-v1.0.md`, `docs/08-implementation-backlog-v0.7.md`, `docs/reference/OPEN_DECISIONS.md`, `docs/codex/BUILD_ORDER.md`, and story contracts `PR-009` through `PR-016`.
- Plan review gate:
  - I agree with the plan.
  - The plan contains the missing acceptance mechanics from the confidence review: real API protection before product data, deployed frontend hosting/API wiring, and story ownership for open implementation choices.
  - The solution is narrow: add one missing story, strengthen existing story prerequisites, and map open decisions rather than implementing product code.
  - Confidence: HECK YES that this plan will make the story set materially more likely to produce the intended controlled MVP without widening `PR-009` or inventing fake product modes.
- Strengthened `PR-010` so real API protection and initial dev PriceBook records must be resolved before Persistent Control API acceptance.
- Added `docs/codex/PR-010A-DEPLOYED-FRONTEND-ACCESS.md` for deployed frontend hosting, browser/app access protection, deployed UI-to-API wiring, and rendered-app verification.
- Updated build order and index references in `AGENTS.md`, `README.md`, `MANIFEST.md`, `docs/codex/BUILD_ORDER.md`, `docs/08-implementation-backlog-v0.7.md`, and `docs/11-codex-implementation-brief-v1.0.md`.
- Updated PR-011 through PR-016 story contracts so user-facing verification uses the rendered deployed app after PR-010A.
- Updated `docs/reference/OPEN_DECISIONS.md`, `docs/09-prd-v0.8.md`, and `docs/11-codex-implementation-brief-v1.0.md` so each open decision has an owning story.
- Deterministic evidence:
  - `rg -n "PR-010A" AGENTS.md README.md MANIFEST.md docs/codex/BUILD_ORDER.md docs/08-implementation-backlog-v0.7.md docs/11-codex-implementation-brief-v1.0.md docs/codex/PR-010A-DEPLOYED-FRONTEND-ACCESS.md` passed.
  - `rg -n "Owner: PR-|Resolve in PR-|Resolve API protection|Resolve initial V1 basis|PriceBook values" docs/reference/OPEN_DECISIONS.md docs/09-prd-v0.8.md docs/11-codex-implementation-brief-v1.0.md` passed.
  - `rg -n "rendered deployed app|user-facing workflow|user-facing behavior|future deployed verification" AGENTS.md docs/codex/BUILD_ORDER.md docs/codex/PR-009-CI-DEPLOYMENT-PIPELINE.md docs/codex/PR-011-AGENT-RUNTIME-STAGE-RUNNER.md docs/codex/PR-012-AGENTCORE-RUNTIME-GATEWAY-INFRA.md docs/codex/PR-013-REAL-V1-PDF-WORKFLOW.md docs/codex/PR-014-V2-IMAGE-ANNOTATION.md docs/codex/PR-015-V3-OPTIMIZATION.md docs/codex/PR-016-OBSERVABILITY-HARDENING.md` passed.
  - `git diff --check` passed.
  - `pnpm lint` passed.
- Deployed verification:
  - Not applicable. This patch changes documentation/story contracts only and introduces no runtime path.
- Telemetry verification:
  - Not applicable. This patch changes documentation/story contracts only and introduces no validation run.
- Current blockers:
  - None.
