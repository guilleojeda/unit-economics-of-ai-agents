# PLAN

## Objective

Implement PR-005: a fixture-backed Next.js frontend that exposes the documented product model and economics surfaces without adding AWS integration or fake product modes.

## Scope and non-goals

In scope:

- Merge completed first-slice PR into `main`.
- Add a Next.js App Router frontend with API-shaped fixture data.
- Implement document library, document detail, create job view, job detail, run detail/timeline, result, evaluation/review, ledger, comparison, and economics settings routes.
- Add reusable UI/domain presentation components needed for these routes.
- Add fixture-backed behavior that demonstrates reviewer decisions changing accepted/rejected/escalated economics locally.
- Add tests for key UI evidence: fixture document visibility, ledger LLM-only/full-cost distinction, reviewer decision economics behavior, and comparison V1/V2/V3 visibility.
- Run deterministic checks and open a draft PR.

Out of scope:

- AWS integration, Control API, AgentCore Runtime, AgentCore Gateway, Bedrock calls, PDF extraction/recomposition, real upload/presigned URLs, deployed environment verification, replay mode, synthetic-run mode, live-capture mode, and presentation mode.
- Persistent user edits. Fixture-backed UI state may change in the browser session only.
- Production authentication, scanned-PDF OCR, V2/V3 real image processing, and sophisticated charting.

## Assumptions and open questions

- The fixture-backed UI is development scaffolding only. It must present realistic product states without becoming a product mode.
- Existing schemas/costing package from PR-001 through PR-004 are the source of truth for domain data and economics.
- Next.js App Router file conventions and `next/link` usage were checked against official Next.js docs before implementation.
- PR #1 was merged into `main` before starting this branch.

## Expected outcomes

- The app opens at `/documents` and shows the controlled Spanish PDF fixture.
- Document detail shows inspection metadata and V1/V2/V3 jobs for the same comparison group.
- Job detail distinguishes `TranslationJob` economics from `Run` attempts.
- Run detail shows the persisted timeline from `StageEvent` fixtures.
- Ledger view shows LLM-only cost separately from full workflow cost and displays `LedgerItem` rows.
- Evaluation view allows local accept/reject/escalate decisions only for `AWAITING_REVIEW` runs, adds human review cost in local state, and recalculates job economics.
- Comparison view shows V1, V2, and V3 economics side by side.
- Economics settings show the active `PriceBook` with labels that do not imply AWS bill reconciliation.
- No forbidden product modes or AWS integrations are introduced.

## Product design

The frontend should feel like a quiet operational product for evaluating workflow economics, not a marketing page or a generic translator. The first screen should be the document library. Navigation should preserve the product mental model:

```text
Document -> TranslationJob -> Run -> Evaluation -> ReviewDecision -> Economics
```

Fixture data should make the central lesson visible: completed technical work is not accepted business value, LLM cost is only part of workflow cost, human review is costed, and rejected work still has cost with no verified outcome. Cards and tables should be compact, scannable, and business-oriented. Charts should stay simple.

## Specification

### Scenario: document library

Given:

- the local fixture dataset contains the controlled Spanish PDF document

When:

- a user opens `/documents`

Then:

- the document appears with source/target language, page/image counts, status, latest outcome, full workflow cost, and unit margin
- actions link to document detail, create job, and comparison

### Scenario: job and run economics

Given:

- a job has one or more run attempts and ledger rows

When:

- a user opens the job or ledger views

Then:

- LLM-only cost is shown separately from full workflow cost
- job-level economics are distinct from run-level cost
- rejected jobs show consumed cost but no verified outcome

### Scenario: local review decision

Given:

- a run is `AWAITING_REVIEW`

When:

- the user selects accept, reject, or escalate and enters reviewer time

Then:

- local UI state records a review decision
- local UI state adds a `HUMAN_REVIEW` ledger row
- accepted jobs show cost per verified outcome and unit margin
- rejected/escalated jobs keep cost per verified outcome and unit margin unresolved

### Scenario: comparison

Given:

- V1, V2, and V3 fixture jobs share a comparison group

When:

- a user opens `/compare/:comparisonGroupId`

Then:

- the UI shows all three variants with outcome, evaluation score, reviewer decision, LLM-only cost, full workflow cost, human review cost, cost per verified outcome, unit value, and unit margin

## Deterministic checks

- `pnpm typecheck`
- `pnpm test`
- `pnpm lint`
- `pnpm cdk synth`
- local browser verification of impacted routes at desktop and mobile widths
- `pnpm --filter @agentcore-pdf-translator/web build`

Tests to add:

- component/integration check for document library fixture visibility
- component/integration check for ledger summary cost distinction
- component/integration check for reviewer accept/reject behavior and economics recalculation
- component/integration check for comparison table V1/V2/V3 rows

## Deployed verification

Not applicable. This task explicitly excludes deployed AWS integration and adds fixture-backed frontend scaffolding only.

## Telemetry verification

Not applicable. No deployed runtime telemetry, AgentCore telemetry, or CloudWatch signals are introduced.

## Implementation steps

1. Refresh frontend package setup for UI development and testing.
   - Done when app scripts, test setup, layout, global styles, and required test dependencies are in place.

2. Add fixture data and local UI state helpers.
   - Done when the frontend can read typed fixture documents/jobs/runs/stage events/artifacts/evaluations/ledger rows/price book and can apply review decisions in local state.

3. Build shared UI components.
   - Done when badges, money values, summary cards, tables, timeline, ledger, review form, and comparison/cost visuals are reusable across routes.

4. Build the documented routes.
   - Done when `/documents`, `/documents/new`, `/documents/:documentId`, `/documents/:documentId/jobs/new`, `/jobs/:jobId`, `/jobs/:jobId/runs/:runId`, `/jobs/:jobId/runs/:runId/result`, `/jobs/:jobId/runs/:runId/evaluation`, `/jobs/:jobId/runs/:runId/ledger`, `/compare/:comparisonGroupId`, and `/settings/economics` render fixture-backed product views.

5. Add frontend tests.
   - Done when tests prove the documented visible outcomes and review/economics behavior through rendered UI.

6. Run deterministic and browser checks, then fix failures.
   - Done when all commands and direct UI checks pass and evidence is recorded.

7. Commit, push, and open a draft PR.
   - Done when the branch is pushed and a draft PR is open with validation evidence.

## Risks and constraints

- Fixture data must not be named or exposed as replay/synthetic/presentation product behavior.
- Prices and model IDs in fixtures must be clearly test/demo values from a `PriceBook` fixture, not hard-coded product assumptions.
- The UI must not imply estimates are AWS-bill-reconciled actuals.
- The PR should not add real API routes or network integration.
- Review state is browser-local only; this is acceptable for PR-005 and must be replaced by the Control API in later PRs.
- Frontend tests should use accessible selectors and user-visible behavior, not implementation details.

## Plan review gate

Review result: HECK YES.

- Scope challenged: the plan is limited to fixture-backed UI and explicitly excludes AWS/API/AgentCore/PDF work and forbidden product modes.
- Implementation approach challenged: typed fixture data plus local review state is the simplest way to prove product surfaces before Control API exists.
- Verification challenged: tests cover visible product claims, and browser checks cover actual rendered UI across desktop/mobile.
- Edge cases checked: non-reviewable runs, rejected economics, and estimate-vs-reconciled labeling are explicit.
- Simpler option considered: a single dashboard would be smaller but would not satisfy PR-005 route/page contracts, so route-complete fixture UI is the right slice.

## Progress, blockers, and evidence

- PR #1 merged into `main`: https://github.com/guilleojeda/unit-economics-of-ai-agents/pull/1
- Created branch `codex/frontend-api-shaped-fixtures`.
- Read repository `AGENTS.md`, `docs/03-product-ui-and-workflow-spec-v0.2.md`, `docs/06-frontend-api-contract-v0.5.md`, and `docs/08-implementation-backlog-v0.7.md`.
- Loaded required skills: planning, testing, TypeScript, frontend-patterns, frontend-testing, refactoring, and GitHub publish flow.
- Verified current Next.js App Router file conventions and Link component usage against official Next.js docs.
- Plan review gate completed before implementation edits.
- Implemented fixture-backed Next.js routes for documents, document upload scaffold, document detail, create job scaffold, job detail, run timeline, result, evaluation/review, ledger, comparison, and economics settings.
- Added typed fixture data backed by the shared schemas and costing package, including local review decisions that create `HUMAN_REVIEW` ledger rows and recalculate job economics from ledger rows.
- Added frontend checks for document fixture visibility, LLM-only versus full workflow cost, review decision economics behavior, and V1/V2/V3 comparison visibility.
- Deterministic checks passed: `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm cdk synth`, and `pnpm --filter @agentcore-pdf-translator/web build`.
- Local browser verification used `pnpm --filter @agentcore-pdf-translator/web dev` at `http://localhost:3000` and headless Chrome screenshots for `/documents` at 1440px, `/jobs/job_v1/runs/run_v1/evaluation` at 1280px, and `/compare/cmp_refunds` at 390px.
- Refactoring assessment completed after green checks: kept the route-complete fixture UI in one view module for this slice because splitting it now would not reduce meaningful complexity before Control API boundaries exist.
