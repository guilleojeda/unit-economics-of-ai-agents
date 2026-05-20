# PLAN

## Objective

Perform a thirteenth adversarial review of all current story contracts and patch any clear defects that could let future slices pass while failing the intended AWS AgentCore unit-economics product.

## Scope and non-goals

In scope:

- Review PR-009, PR-010, PR-010A, and PR-011 through PR-016 from current `main`.
- Re-check the story set against repository instructions, reference contracts, and the intended controlled Spanish-to-English PDF economics workflow.
- Challenge the stories from a fresh failure perspective: destructive operations, cleanup/retention behavior, immutable economic evidence, artifact deletion, operational rollback, and data-loss paths.
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
- Prior passes tightened deployment, fixture ownership, review cost, comparison assumptions, idempotency, artifact integrity, price-book versioning, model/configuration evidence, private artifact access, immutable source lineage, explicit artifact-bearing tool requests, implementation provenance, environment/validation scoping, and evidence hygiene.
- Open question to resolve by reading: do the story contracts prevent future slices from satisfying acceptance while allowing destructive deletes, cleanup jobs, stack replacement, or rollback paths to erase `LedgerItem`, `ReviewDecision`, `StageEvent`, `Artifact`, source-object, or validation evidence needed for economics and auditability?

## Expected outcomes

- Any new high-confidence story-contract defects found by this pass are fixed narrowly.
- Future implementation stories should preserve economic and review evidence even when cleanup, rollback, retries, or failed deployments occur.
- If no new defects are found, the review evidence explains why no story edits were made.
- No runtime behavior changes are made.
- PR-009 remains the next implementation task.

## Product design

The product is an AWS AgentCore-based unit-economics app for controlled Spanish-to-English PDF workflow measurement. `TranslationJob` is the business unit, `Run` is a technical attempt, and `LedgerItem` records are the economics source of truth. Reviewer decisions, failed/rejected work, artifacts, and stage events are audit evidence. Operational convenience must not erase or mutate the records required to prove cost, margin, acceptance, lineage, and comparison claims.

## Deterministic checks

- Targeted `rg` checks for destructive operation, deletion, retention, cleanup, rollback, and immutability wording.
- Targeted `rg` checks for evidence hygiene and forbidden product mode wording to ensure this pass does not regress prior constraints.
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
   - Done when destructive-operation, cleanup, retention, rollback, data-loss, and evidence-immutability risks have been challenged from a fresh angle.

3. Patch grounded defects if found.
   - Done when required story/reference changes are made narrowly and recorded.

4. Run deterministic checks and record evidence.
   - Done when checks pass or blockers are recorded.

## Risks and constraints

- Do not add process weight without a concrete failure mode.
- Do not obscure PR-009 as the next task.
- Do not create contradictions with repository-local AGENTS.md or global delivery rules.
- Do not weaken private artifact access or evidence hygiene constraints while adding retention language.
- Do not accidentally require permanent retention of secrets, signed URLs, or raw prompt/response evidence.
- Avoid repeating previous passes unless the repeated concern reveals a new concrete contract hole.

## Progress, blockers, and evidence

- Loaded `planning`, `review-plan`, `review-plan-adversarial`, and `testing` skills.
- Confirmed starting point: clean `main` at `510b4cb`.
- Created branch `codex/adversarial-story-review-pass-13`.
- Read repository instructions, PR-009 through PR-016 story contracts, API/S3/tool/cost/entity reference docs, relevant PRD/ADR/implementation-brief excerpts, and the current CDK storage/database retention tests.
- Adversarial finding: the story set strongly required immutable source identity, idempotent writes, private artifact access, and sanitized evidence, but it did not consistently make destructive-operation and retention behavior part of future acceptance. A later slice could add a delete/purge/cleanup route, lifecycle rule, destructive stack replacement, or retry cleanup that erases failed/rejected/skipped evidence while still satisfying the visible happy path.
- Patched `docs/reference/API_ROUTES.md` to state that MVP product APIs have no hard-delete, purge, hard-reset, or cleanup routes for product/economics evidence, and that any future archive/retention/delete behavior needs an explicit story preserving auditability and ledger-derived costs.
- Patched `docs/reference/S3_ARTIFACT_KEYS.md` to treat artifact objects referenced by `Artifact` records as product evidence that must not be auto-deleted, expired, replaced, or orphaned by lifecycle/CDK behavior without an explicit retention/archive story.
- Patched `docs/reference/TOOL_CONTRACTS.md` to require additive retry/remediation evidence and to forbid tools/runtime code from deleting or overwriting prior StageEvents, Artifacts, LedgerItems, EvaluationResults, ReviewDecisions, or S3 artifact objects to make later attempts look cheaper or cleaner.
- Patched PR-009 so the CI deployment foundation must preserve data-bearing resources, fail on destructive synthesized resource settings, and include data-resource retention/protection in the deploy artifact.
- Patched PR-010 so the persistent API must reject unsupported destructive route attempts and leave records readable.
- Patched PR-011 through PR-015 so workflow, Runtime/Gateway, V1, V2, and V3 retry/remediation paths must preserve failed/rejected/skipped/retried evidence rather than deleting or overwriting it.
- Patched PR-016 so final hardening includes a destructive-operation and retention audit across infrastructure, APIs, workflow execution, retries, reviews, and artifact storage.
- Verified retention/destructive-operation wording with `rg -n 'hard-delete|purge|cleanup|archive|destructive|retention|retain|auto-delete|TTL|ttl|expire|delete or overwrite|Deletes, overwrites|evidence-retention|removal policy|DeletionPolicy|point-in-time|orphan artifact|artifact object evidence|historical economics|failed/rejected/skipped|failed/rejected/retried' docs/codex docs/reference PLAN.md`.
- Verified evidence-hygiene wording remains present with `rg -n 'evidence hygiene|secret redaction|sanitized|redact|presigned|signed query|auth headers|cookies|raw PDF|raw image|raw artifacts|full prompts|raw model responses|full extracted|full translated|PLAN.md|CI artifacts|browser evidence' docs/codex docs/reference PLAN.md`.
- Verified forbidden product-mode wording remains present with `rg -n 'replay|synthetic|live-capture|recording|presentation|product mode|correlation only|must not become a product mode|must not create' docs/codex docs/reference`.
- `git diff --check` passed.
- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed.
- `pnpm cdk synth` passed. It emitted the existing CDK notice `37949` about affected `aws-cdk-lib` versions, but synthesis completed successfully.
- No blockers.
- Plan review gate:
  - I agree with this plan.
  - It contains enough to perform a fresh adversarial pass focused on destructive operations, retention, rollback, and durable economics evidence without re-litigating only prior findings.
  - The best solution is to read the story set and references, then patch only grounded defects.
  - Confidence: HECK YES that this is the right process for this review pass.
