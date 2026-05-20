# PLAN

## Objective

Perform a fourteenth adversarial review of all current story contracts and patch any clear defects that could let future slices pass while failing the intended AWS AgentCore unit-economics product.

## Scope and non-goals

In scope:

- Review PR-009, PR-010, PR-010A, and PR-011 through PR-016 from current `main`.
- Re-check the story set against repository instructions, reference contracts, and the intended controlled Spanish-to-English PDF economics workflow.
- Challenge the stories from a fresh failure perspective: partial multi-record writes, transaction boundaries, cross-table consistency, orphaned evidence, retries after partial failure, and reconciliation of incomplete commits.
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
- Prior passes tightened deployment, fixture ownership, review cost, comparison assumptions, idempotency, artifact integrity, price-book versioning, model/configuration evidence, private artifact access, immutable source lineage, explicit artifact-bearing tool requests, implementation provenance, environment/validation scoping, evidence hygiene, and destructive-operation/retention behavior.
- Open question to resolve by reading: do the story contracts prevent future slices from satisfying acceptance while allowing partial commits across `StageEvent`, `Artifact`, `LedgerItem`, `EvaluationResult`, `ReviewDecision`, S3 objects, and status updates to leave orphaned or inconsistent economic evidence?

## Expected outcomes

- Any new high-confidence story-contract defects found by this pass are fixed narrowly.
- Future implementation stories should require atomic, transactional, or recoverably staged persistence for multi-record workflow/economics writes.
- If no new defects are found, the review evidence explains why no story edits were made.
- No runtime behavior changes are made.
- PR-009 remains the next implementation task.

## Product design

The product is an AWS AgentCore-based unit-economics app for controlled Spanish-to-English PDF workflow measurement. `TranslationJob` is the business unit, `Run` is a technical attempt, and `LedgerItem` records are the economics source of truth. Because economics are reconstructed from several persisted record types and S3 artifacts, the product cannot tolerate partial success that makes artifacts, evaluations, review decisions, stage events, or ledger rows disagree about what happened.

## Deterministic checks

- Targeted `rg` checks for atomicity, transaction, consistency, orphan, partial failure, commit, and reconciliation wording.
- Targeted `rg` checks for retention, evidence hygiene, and forbidden product mode wording to ensure this pass does not regress prior constraints.
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
   - Done when partial-write, transaction-boundary, orphaned-record, retry-after-partial-failure, and reconciliation risks have been challenged from a fresh angle.

3. Patch grounded defects if found.
   - Done when required story/reference changes are made narrowly and recorded.

4. Run deterministic checks and record evidence.
   - Done when checks pass or blockers are recorded.

## Risks and constraints

- Do not add process weight without a concrete failure mode.
- Do not obscure PR-009 as the next task.
- Do not create contradictions with repository-local AGENTS.md or global delivery rules.
- Do not prescribe a specific database transaction implementation where a recoverable staged commit could satisfy the product contract.
- Do not weaken idempotency, retention, private artifact access, or evidence hygiene constraints.
- Avoid repeating previous passes unless the repeated concern reveals a new concrete contract hole.

## Progress, blockers, and evidence

- Loaded `planning`, `review-plan`, `review-plan-adversarial`, and `testing` skills.
- Confirmed starting point: clean `main` at `e39ed11`.
- Created branch `codex/adversarial-story-review-pass-14`.
- Plan review gate:
  - I agree with this plan.
  - It contains enough to perform a fresh adversarial pass focused on partial writes and cross-record consistency without re-litigating only prior findings.
  - The best solution is to read the story set and references, then patch only grounded defects.
  - Confidence: HECK YES that this is the right process for this review pass.
- Reviewed PR-009 through PR-016 plus reference API, tool, costing, and entity contracts from the perspective of partial multi-record writes and incomplete commits.
- Finding: the story set required idempotency, retention, evidence hygiene, and ledger-derived economics, but it did not consistently require successful visible outcomes to be backed by complete record groups after partial write failures. A future implementation could otherwise show artifact, evaluation, review, economics, or comparison success with missing `StageEvent`, `Artifact`, `LedgerItem`, `EvaluationResult`, `ReviewDecision`, S3 metadata, or status evidence.
- Patched the reference contracts to require transactional, conditional, or recoverably staged commit boundaries for multi-record product events, with incomplete groups blocked or labeled failed/incomplete until recovery.
- Patched PR-010 through PR-016 so deterministic checks, deployed verification, telemetry verification, acceptance criteria, and review traps cover partial-persistence and incomplete-record-group failure modes.
- Targeted scans confirmed the new consistency wording is present across API routes, tool contracts, costing rules, entity model, PR-010 through PR-016, and that prior constraints around forbidden modes, hard-coded prices/model IDs, and logs-not-economics remain present.
- `git diff --check` passed.
- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed.
- `pnpm cdk synth` passed. It emitted CDK notice `37949` about affected `aws-cdk-lib` versions, but synthesis completed successfully.
- No blockers.
