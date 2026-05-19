# PLAN

## Objective

Implement the first vertical slice of the AWS AgentCore PDF translation unit-economics app as a local TypeScript monorepo, proving the core product/economics model without AWS integration.

## Scope and non-goals

In scope:

- Monorepo foundation with `pnpm` workspaces, strict TypeScript, lint, tests, and CI.
- Empty frontend and CDK app shells only.
- `/packages/schemas` with Zod schemas and exported TypeScript types for the documented entities, API error, and tool contracts.
- `/packages/costing` with price-book lookup, ledger item builders, run rollups, and job economics rollups.
- `/packages/data` with repository interfaces, in-memory implementations, state transition guards, ID generation, and S3 key builders.
- Unit tests proving schemas, state transitions, S3 keys, cost rollups, accepted/rejected job economics, and multi-attempt economics.
- A draft GitHub pull request for the completed slice.

Out of scope:

- AWS integration, AgentCore Runtime, AgentCore Gateway, Bedrock calls, PDF extraction/recomposition, deployed frontend behavior, replay mode, synthetic-run mode, live-capture mode, and presentation mode.
- Real DynamoDB/S3 repositories beyond key generation and interfaces.
- Real PriceBook values for AWS services beyond test-local examples.

## Assumptions and open questions

- The existing docs are the source of truth for domain shapes and guardrails; resolved by reading the implementation brief, entity model, costing rules, state transitions, S3 key reference, and guardrails before implementation.
- This first slice can use test-only placeholder prices because product prices must come from `PriceBook` records, not hard-coded business logic.
- Since the current branch started with uncommitted repository guidance files from the prior task, the PR will include those files unless they are found to conflict with this implementation.

## Expected outcomes

- A fresh checkout can install dependencies and run `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm cdk synth` successfully.
- The schemas validate complete domain objects for the first slice.
- Costing functions calculate LLM-only cost separately from full workflow cost using `LedgerItem` rows.
- Human review cost is generated as a `HUMAN_REVIEW` ledger row from reviewer seconds and a PriceBook-backed hourly rate.
- Accepted job economics include all attempts and produce cost per verified outcome plus unit margin.
- Rejected job economics retain consumed cost and return no verified outcome or unit margin.
- State transition guards reject invalid document, job, and run transitions.
- S3 key builders produce the documented keys without storing or passing raw PDF bytes.
- No forbidden product modes are added.

## Product design

The first slice establishes the product’s business model before any AWS workflow execution exists. A `TranslationJob` represents the unit of business value: producing one accepted English PDF from one Spanish source PDF. A `Run` represents a technical attempt under that job. `StageEvent` records describe the workflow timeline, `Artifact` records describe durable S3-backed outputs, and `LedgerItem` records are the authoritative economics ledger.

The user-facing behavior this slice protects is economic correctness: completed technical work is not the same as an accepted outcome; automated evaluation is not acceptance; review is never free; rejected work still consumes cost; and LLM-only cost never substitutes for full workflow cost.

## Specification

### Scenario: accepted multi-attempt job economics

Given:

- one `TranslationJob` with two `Run` attempts
- ledger rows across both runs, including model and non-model components
- the job status is `ACCEPTED`

When:

- job economics are rolled up

Then:

- job cost includes both attempts
- LLM-only cost includes only `MODEL_INFERENCE` rows
- full workflow cost includes every ledger row
- cost per verified outcome equals total job cost
- unit margin equals value per accepted PDF minus cost per verified outcome

### Scenario: rejected job economics

Given:

- a `TranslationJob` with ledger rows
- the job status is `REJECTED`

When:

- job economics are rolled up

Then:

- consumed full workflow cost remains visible
- cost per verified outcome is `null`
- unit margin is `null`

### Scenario: review creates cost

Given:

- a reviewer spends a positive number of seconds on a run
- the active `PriceBook` defines a human review hourly rate

When:

- a human-review ledger row is built

Then:

- the row has component type `HUMAN_REVIEW`
- the row uses cost source `HUMAN_REVIEW_TIMER`
- estimated cost equals reviewer seconds divided by 3600 times the hourly rate

### Scenario: invalid state transitions

Given:

- document, job, and run records in known statuses

When:

- an invalid transition is requested

Then:

- the guard returns or throws a transition error
- terminal run states cannot move to any other status

### Scenario: S3 artifact key generation

Given:

- workspace, document, job, run, artifact, stage, page, and image identifiers

When:

- artifact keys are built

Then:

- keys match the documented `workspaces/...` structure
- callers receive bucket/key-friendly strings, not raw PDF bytes

## Deterministic checks

- `pnpm install`
- `pnpm typecheck`
- `pnpm test`
- `pnpm lint`
- `pnpm cdk synth`

Tests to add:

- schema parsing for representative entities and tool envelopes
- accepted/rejected/multi-attempt job economics
- LLM-only versus full workflow rollups
- human-review ledger cost creation
- document/job/run transition guards, including invalid terminal transitions
- S3 source, stage, image, preview, and ledger export key generation
- in-memory repository CRUD/list behavior through public repository interfaces

## Deployed verification

Not applicable for this slice. The requested scope explicitly excludes AWS integration and deployed runtime behavior.

## Telemetry verification

Not applicable for this slice. No deployed services, AgentCore telemetry, CloudWatch logs, or queryable runtime telemetry are introduced.

## Implementation steps

1. Create the monorepo foundation.
   - Done when workspace config, root scripts, strict TypeScript base config, lint/test setup, package skeletons, empty web app shell, empty CDK app shell, and CI exist.

2. Implement shared schemas.
   - Done when `/packages/schemas` exports documented enums, schemas, types, API error schema, tool contracts, and schema tests.

3. Implement costing.
   - Done when `/packages/costing` exports PriceBook lookup, ledger builders, run rollups, job economics rollups, and tests proving accepted/rejected/multi-attempt economics.

4. Implement data interfaces and in-memory repositories.
   - Done when `/packages/data` exports repository ports, in-memory implementations, ID generation, transition guards, S3 key builders, and tests.

5. Run verification and fix failures.
   - Done when install, typecheck, tests, lint, and CDK synth pass.

6. Review, commit, push, and open a draft PR.
   - Done when final evidence is recorded, scope is reviewed against guardrails, changes are committed on `codex/first-vertical-slice`, pushed, and a draft PR is open.

## Risks and constraints

- Costing must not depend on logs or traces; tests should assert rollups use `LedgerItem` inputs.
- Test PriceBook values must remain fixtures, not product defaults or hard-coded business logic.
- In-memory repositories must be development/test scaffolding only, not product-facing fake run behavior.
- Empty frontend and CDK shells must not grow into real frontend or AWS integration work in this slice.
- The job/run rejected-remediation nuance exists in the docs; for this slice, run transitions remain terminal while job economics can include multiple historical attempts supplied to the rollup.
- No model IDs should be hard-coded into runtime behavior; tests may use explicit fixture strings.

## Plan review gate

Review result: HECK YES.

- Scope challenged: the plan excludes AWS, frontend implementation, AgentCore, Bedrock, PDF processing, and forbidden product modes, matching the user request.
- Implementation approach challenged: building schemas before costing and data keeps domain contracts stable; repository interfaces and in-memory implementations stay behind ports.
- Verification challenged: checks cover install, typecheck, tests, lint, and CDK synth, with unit tests aimed at the core business invariants rather than coverage theater.
- Edge cases and failure modes checked: terminal state transitions, rejected economics, multi-attempt costs, and PriceBook-backed review cost are explicit.
- Simpler solution considered: skipping app/CDK shells would be smaller but would miss the documented PR-001 acceptance criteria, so the planned shell-only approach is the narrow compliant path.

## Progress, blockers, and evidence

- Created branch `codex/first-vertical-slice`.
- Read root `AGENTS.md`, `docs/codex/INITIAL_CODEX_PROMPT.md`, `docs/codex/GUARDRAILS.md`, `docs/codex/FIRST_SLICE_CHECKLIST.md`, `docs/04-data-model-and-contracts-v0.3.md`, and relevant reference docs before implementation.
- Loaded required skills: planning, specification, testing, TypeScript, and GitHub publish flow.
- Plan review gate completed before implementation edits.
- Implemented monorepo foundation, empty web shell, empty CDK shell, CI workflow, shared schemas, costing package, data repositories, state transition guards, S3 key builders, and tests.
- Verification passed:
  - `pnpm install`
  - `pnpm install --frozen-lockfile`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm lint`
  - `pnpm cdk synth`
- Refactoring assessment: no fix-now refactor remains. The first-slice code keeps schema, costing, and data boundaries separate; repeated test fixture values are acceptable because they represent local examples rather than product defaults.
- Completion review: implemented behavior matches the first vertical slice request. No AWS integration, AgentCore Runtime, AgentCore Gateway, Bedrock calls, PDF extraction, frontend behavior, replay mode, synthetic-run mode, live-capture mode, or presentation mode were added. Costing is driven by `PriceBook` inputs and `LedgerItem` rows, and logs are not used as an economics source.
- Draft PR opened: https://github.com/guilleojeda/unit-economics-of-ai-agents/pull/1
- Blockers: none.
