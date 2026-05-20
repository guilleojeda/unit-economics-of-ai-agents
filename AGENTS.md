# AGENTS.md

Repository-local instructions for Codex and other coding agents working in this repository.

Product and architecture instructions are based on:

- `README.md`
- `MANIFEST.md`
- `docs/09-prd-v0.8.md`
- `docs/10-adrs-v0.9.md`
- `docs/11-codex-implementation-brief-v1.0.md`
- `docs/codex/GUARDRAILS.md`

Delivery workflow rules also inherit the global Codex baseline from `/Users/guille/.codex/AGENTS.md`. Repository-local instructions must not weaken that baseline.

## Product Purpose

This repository implements an AWS-native, AgentCore-based unit-economics application for one controlled workflow:

```text
controlled Spanish PDF -> AgentCore workflow -> translated English PDF -> evaluation -> reviewer decision -> full ledger -> unit margin
```

The product is not a generic PDF translator. It exists to answer:

```text
Is the value of solving this document-translation task greater than the full cost of solving it?
```

The core product model is:

```text
Document -> TranslationJob -> Run -> StageEvents / Artifacts / LedgerItems -> EvaluationResult -> ReviewDecision -> Job economics
```

`TranslationJob` is the business unit. `Run` is a technical attempt. `LedgerItem` records are the source of truth for economics.

## Non-Negotiable Rules

- Deploy in `us-east-1`.
- Use TypeScript as the primary implementation language.
- Use AWS CDK TypeScript for infrastructure.
- Use Amazon Bedrock AgentCore Runtime for agent execution.
- Use Strands for the AgentCore agent implementation, with most stage-runner logic kept in plain TypeScript.
- Use AgentCore Gateway as the deterministic tool boundary.
- Use Lambda-backed Gateway targets for MVP tools.
- Use Amazon Bedrock Converse through a shared wrapper for all model calls.
- Keep model IDs configurable. Do not hard-code model IDs.
- Store PDF bytes and generated artifact bytes in S3.
- Pass artifact IDs and S3 keys through APIs, AgentCore requests, and Gateway tool requests. Do not pass raw PDFs.
- Use separate DynamoDB tables for MVP clarity.
- Persist workflow progress as `StageEvent` records.
- Persist durable outputs as `Artifact` records.
- Calculate product economics from `LedgerItem` records.
- Use `PriceBook` records for cost assumptions. Do not hard-code prices.
- Show LLM-only cost separately from full workflow cost.
- Treat human review as a costed economic event.
- Do not treat automated evaluation as business acceptance.
- Rejected and failed attempts still count toward workflow cost.
- Limit MVP support to controlled, digitally generated Spanish PDFs.
- Do not implement arbitrary scanned-PDF support in MVP.
- V1 must work before V2 or V3.
- Development fixtures are allowed only for tests and local scaffolding, not product behavior.
- All AWS deployment must run through CI and infrastructure as code.
- Do not run `cdk deploy` manually from a developer machine.
- Do not manually modify AWS resources to implement or verify a change.
- Do not treat `cdk synth`, passing tests, logs, screenshots, or local checks as deployed verification.
- A delivery slice that affects deployed product, API, infrastructure, or runtime behavior is complete only after the relevant PR is merged, the normal post-merge CI deployment succeeds, and Codex directly uses the deployed app or API and records evidence.

## Forbidden Product Modes

Do not add or model any of these as product behavior:

- replay mode
- synthetic-run mode
- live-capture mode
- recording mode
- presentation mode
- `LIVE_CAPTURE`
- `REPLAY_CAPTURED`
- `SYNTHETIC_SEED`

Historical comparison is allowed only through real persisted jobs, runs, evaluations, review decisions, and ledger rows linked by `comparisonGroupId`.

## Economics Source of Truth

`LedgerItem` records are authoritative for:

- run cost
- job cost
- LLM-only cost
- full workflow cost
- review cost
- retry/remediation cost
- cost per verified outcome
- unit margin

Logs, traces, AgentCore Observability, and CloudWatch are for debugging, correlation, and reconciliation. Do not use logs as the sole source of cost truth.

Every cost display must honestly label its basis, such as telemetry-derived, price-book-estimated, AWS-bill-reconciled, or mixed. Do not claim AWS bill reconciliation unless it is actually implemented.

## Build Order

Build in this order:

```text
PR-001 - Monorepo foundation
PR-002 - Shared schemas
PR-003 - Costing package
PR-004 - In-memory repositories and state transitions
PR-005 - Frontend with API-shaped fixtures
PR-006 - Control API skeleton
PR-007 - CDK storage/database/API basics
PR-008 - DynamoDB and S3 repositories
PR-009 - CI-backed dev deployment pipeline
PR-010 - Persistent Control API
PR-010A - Deployed frontend and dev access
PR-011 - Agent runtime stage runner without real Gateway
PR-012 - AgentCore Runtime and Gateway infrastructure
PR-013 - Real V1 PDF workflow
PR-014 - V2 image annotation
PR-015 - V3 optimization
PR-016 - Observability and hardening
```

Do not start AWS integration before the local economic and data model are working.

Do not wire additional deployed product behavior before CI-backed dev deployment exists. The current CI workflow is verification-only until a deployment pipeline is explicitly implemented.

The next task is `PR-009 - CI-backed dev deployment pipeline`. Use `docs/codex/PR-009-CI-DEPLOYMENT-PIPELINE.md` as the task contract. Persistent Control API, AgentCore Runtime, AgentCore Gateway, Bedrock calls, PDF processing, frontend hosting, and all later product behavior are blocked until PR-009 is merged, the normal post-merge CI deployment succeeds, a deploy artifact exists for the merged SHA, and Codex directly verifies the deployed API/app. PR-009 is post-merge dev deployment only; it does not create per-PR branch preview environments.

For PR-010, PR-010A, and PR-011 through PR-016, use the dedicated story contracts in `docs/codex/PR-010-PERSISTENT-CONTROL-API.md`, `docs/codex/PR-010A-DEPLOYED-FRONTEND-ACCESS.md`, and `docs/codex/PR-011-AGENT-RUNTIME-STAGE-RUNNER.md` through `docs/codex/PR-016-OBSERVABILITY-HARDENING.md`. Those contracts are the acceptance source for deployed verification, telemetry status, deploy artifact evidence, non-goals, and forbidden outcomes.

## Deployment And Completion Rules

Current CI may run typecheck, tests, lint, AWS credential configuration, and `pnpm cdk synth`. That is verification, not deployment.

When deployment is required for a slice:

- deploy only through the normal CI workflow
- deploy only the merged SHA for the target branch/environment unless a documented preview deployment exists
- use AWS CDK/IaC, not console edits or local `cdk deploy`
- capture stack outputs needed for verification
- directly exercise the deployed app or API as Codex
- record deployed verification evidence in `PLAN.md`
- verify telemetry when queryable telemetry exists for the changed path

If a slice has no deployed runtime path yet, `PLAN.md` must say deployed verification is not applicable and explain why. This exception must not be used after the CI-backed deployment path exists for the affected product/API path.

After `PR-010A` deploys the frontend, user-facing behavior must be verified through the rendered deployed app. API calls may support evidence collection, but they are not enough by themselves for product flows that the app exposes.

## What To Implement First

The first implementation slice is only PR-001 through PR-004:

- monorepo foundation
- `pnpm` workspace setup
- TypeScript config
- lint, test, and typecheck scripts
- basic package structure
- empty Next.js app
- empty CDK app
- CI workflow
- `/packages/schemas`
- `/packages/costing`
- `/packages/data`
- repository interfaces
- in-memory repositories
- state transition guards
- ID generation
- S3 key builder
- unit tests

The first slice must prove:

- `TranslationJob` is the business unit.
- `Run` is a technical attempt.
- `LedgerItems` are the economics source of truth.
- LLM-only cost and full workflow cost are separate.
- Human review creates cost.
- Rejected work shows cost but no verified outcome.
- Multi-attempt accepted jobs include failed attempt costs.

## What To Defer

Defer until the earlier slices are complete:

- AgentCore Runtime integration
- AgentCore Gateway integration
- Bedrock model calls
- real PDF extraction and recomposition
- frontend behavior beyond API-shaped fixtures
- V2 image annotation
- V3 optimization
- AgentCore Policy
- AgentCore Memory
- runtime cost reconciliation
- AWS Cost Explorer or billing reconciliation
- Cognito or enterprise auth
- VPC networking
- scanned-PDF OCR
- image inpainting
- multi-language support
- production billing reconciliation
- complex analytics

AgentCore Policy can be added after V1 works. AgentCore Memory should only be added if glossary or reviewer-preference memory becomes concrete product behavior.

## Testing Expectations

For the first slice, checks must cover:

- schemas
- state transitions
- S3 key generation
- cost rollups
- price-book lookup
- accepted job economics
- rejected job economics
- multi-attempt job economics
- ledger rollups
- tool response validation, when tool contracts are introduced

The first deliverable must pass:

```text
pnpm install
pnpm typecheck
pnpm test
pnpm lint
```

The monorepo foundation should also support `pnpm cdk synth`.

After the CI-backed deployment slice exists, every implementation deliverable that changes deployed behavior must also pass the normal post-merge deployment and deployed-use verification before it is accepted.

Later integration and end-to-end checks must prove the documented workflow directly:

- upload controlled Spanish PDF
- inspect document
- create V1 job
- start V1 run
- reach `AWAITING_REVIEW`
- open translated PDF
- open evaluation
- accept run
- verify cost per verified outcome and unit margin
- repeat for V2 and V3
- open comparison group
- verify cost and margin comparison

## Review Guidelines

Review changes against the product model and economics model first.

Reject or revise changes that:

- make the product behave like a generic PDF translator
- treat `Run` as the business unit
- calculate economics from logs instead of `LedgerItems`
- hide failed or rejected work from cost
- treat review as free
- treat automated evaluation as acceptance
- hard-code prices
- hard-code model IDs
- pass raw PDFs through API, AgentCore, or Gateway requests
- store PDF bytes in DynamoDB
- add replay, synthetic-run, live-capture, recording, or presentation modes
- let V2 or V3 block V1
- seed fake product-facing run histories

Reviewer decisions are product events. Only `AWAITING_REVIEW` runs can be accepted, rejected, or escalated. Accept, reject, and escalate actions must create `ReviewDecision` records and `HUMAN_REVIEW` ledger rows.

## Core State Rules

Document statuses:

```text
UPLOADED -> INSPECTING -> READY
UPLOADED -> INSPECTING -> UNSUPPORTED
UPLOADED -> INSPECTING -> FAILED_INSPECTION
READY -> INSPECTING, only for reinspection
```

Unsupported or failed-inspection documents cannot start `TranslationJob` creation.

Run statuses:

```text
CREATED -> QUEUED -> RUNNING -> EVALUATING -> AWAITING_REVIEW
AWAITING_REVIEW -> ACCEPTED
AWAITING_REVIEW -> REJECTED
AWAITING_REVIEW -> ESCALATED
QUEUED/RUNNING/EVALUATING -> FAILED
```

`FAILED`, `ACCEPTED`, `REJECTED`, and `ESCALATED` are terminal run states.

Invalid transitions must be rejected.

## Required Costing Rules

Use these formulas:

```text
llmOnlyCostUsd = sum(ledger.estimatedCostUsd where componentType == MODEL_INFERENCE)
fullWorkflowCostUsd = sum(ledger.estimatedCostUsd for all rows)
humanReviewCostUsd = reviewerSeconds / 3600 * humanReviewHourlyRateUsd
jobCostUsd = sum(full workflow costs for every run under job)
costPerVerifiedOutcomeUsd = jobCostUsd if job.status == ACCEPTED; null otherwise
unitMarginUsd = valuePerAcceptedPdfUsd - costPerVerifiedOutcomeUsd
```

Accepted jobs show cost per verified outcome and unit margin. Rejected jobs show consumed cost but no verified outcome and no unit margin.

## Controlled MVP Document

The primary controlled fixture is:

```text
Title: Procedimiento de Reembolsos y Elegibilidad
Language: Spanish
Target: English
Length: 4 pages
Format: digitally generated PDF
```

Required glossary:

```text
reembolso -> refund
elegibilidad -> eligibility
contracargo -> chargeback
revisión manual -> manual review
caso escalado -> escalated case
```

Include a page 4 process diagram with Spanish labels and one decorative image without material text so V3 has legitimate work to skip.
