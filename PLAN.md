# PLAN

## Objective

Perform a ninth adversarial review of all current story contracts and patch any clear defects that could let future slices pass while failing the intended AWS AgentCore unit-economics product.

## Scope and non-goals

In scope:

- Review PR-009, PR-010, PR-010A, and PR-011 through PR-016 from current `main`.
- Challenge the stories from a fresh failure perspective: deploy continuity, acceptance gates, artifact privacy, economic truth, user-facing review, operational evidence, comparison validity, authorization, and state consistency.
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
- Prior passes tightened deployment, fixture ownership, review cost, comparison assumptions, idempotency, artifact integrity, price-book versioning, model/configuration comparison evidence, and private artifact access.
- Fresh adversarial assumption under review: future stories may require deployed validation to upload or reuse controlled PDFs, but may not explicitly prevent cross-run, cross-variant, or cross-environment artifact contamination in validation evidence.
- Open question to resolve by reading: do the current stories force validation evidence to prove that the exact controlled source artifact used for a job is the one used in downstream run, review, ledger, and comparison evidence?

## Expected outcomes

- Any new high-confidence story-contract defects found by this pass are fixed narrowly.
- Deployed validation evidence should remain traceable from controlled source artifact through document, job, run, artifacts, review, ledger, and comparison evidence.
- If no new defects are found, the review evidence explains why no story edits were made.
- No runtime behavior changes are made.
- PR-009 remains the next implementation task.

## Product design

The product is an AWS AgentCore-based unit-economics app for controlled Spanish-to-English PDF workflow measurement. `TranslationJob` is the business unit, `Run` is a technical attempt, and `LedgerItem` records are the economics source of truth. The intended workflow measures the full cost per accepted translated PDF from one controlled source document; therefore, validation stories must prevent evidence from mixing artifacts, jobs, runs, price books, model configuration, or comparison groups in ways that make economics look correct while measuring the wrong workflow.

## Deterministic checks

- Targeted `rg` checks for any patched contract language.
- Targeted `rg` checks for contamination, comparison, and validation-evidence shortcuts.
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
   - Done when validation traceability, comparison integrity, economic truth, artifact privacy, and operational failure modes have been challenged from a new angle.

3. Patch grounded defects if found.
   - Done when required story/reference changes are made narrowly and recorded.

4. Run deterministic checks and record evidence.
   - Done when checks pass or blockers are recorded.

## Risks and constraints

- Do not add process weight without a concrete failure mode.
- Do not obscure PR-009 as the next task.
- Do not create contradictions with repository-local AGENTS.md or global delivery rules.
- Do not overconstrain implementation choices that later stories intentionally own.
- Avoid repeating previous passes unless the repeated concern reveals a new concrete contract hole.

## Progress, blockers, and evidence

- Loaded `review-plan`, `review-plan-adversarial`, `planning`, and `testing` skills.
- Confirmed starting point: clean `main` at `ccd82c5`.
- Created branch `codex/adversarial-story-review-pass-9`.
- Plan review gate:
  - I agree with this plan.
  - It contains enough to perform a fresh adversarial pass focused on validation traceability and contamination risk without re-litigating only prior findings.
  - The best solution is to read the story set and references, then patch only grounded defects.
  - Confidence: HECK YES that this is the right process for this review pass.
- Read AGENTS.md, PR-009, PR-010, PR-010A, PR-011 through PR-016, API routes, entity model, S3 artifact key reference, tool contracts, costing, state transitions, workflow variants, PRD comparison/acceptance sections, and ADR-039/040/049/050.
- Finding 1: PR-010 verified source-object integrity at creation time but did not make the registered `SOURCE_PDF` artifact immutable for the `Document`. If left unfixed, later evidence could compare "the same document" while the underlying source object, checksum, or artifact metadata changed. Patched PR-010 plus API, entity, and S3 references to require immutable canonical source artifacts and source-replacement-as-new-document behavior.
- Finding 2: V1/V2/V3 comparison contracts required the same fixture/document/comparison group, but not explicit matching source artifact identity/checksum in comparison and validation evidence. If left unfixed, comparison claims could be contaminated by changed source bytes under the same label or document path. Patched PR-013 through PR-016 plus API/entity references to require source-lineage evidence and mismatch blocking/labeling.
- Finding 3: `TOOL_CONTRACTS.md` listed document/job/run IDs but not explicit file input artifact references, despite repository rules requiring APIs, AgentCore requests, and Gateway tools to pass artifact IDs/S3 keys instead of raw PDFs. If left unfixed, future tools could infer file inputs from mutable document state, local files, or arbitrary keys. Patched tool contracts and PR-011 through PR-016 to require explicit artifact references for file-bearing stages.
- Plan review gate after patching:
  - I agree with the revised plan and scope.
  - It contains enough to prove this docs-only review pass.
  - The solution is narrow: source immutability, source-lineage comparison evidence, and explicit file artifact references only.
  - Confidence: HECK YES that these patches address real contamination and tool-boundary failure modes without changing PR-009 as the next task.
- Deterministic check evidence:
  - Source-lineage `rg` scan passed and found the expected immutable source artifact, source checksum, source-lineage, source replacement, and comparison-mismatch language in patched story/reference docs.
  - Tool-boundary `rg` scan passed and found the expected `ArtifactRef`, `inputArtifacts`, explicit artifact-reference, raw-byte, local-path, arbitrary-key, and documentId-only guardrail language in patched story/reference docs.
  - Comparison-prerequisite `rg` scan passed and found source artifact identity/checksum requirements alongside same-document and comparison-group language.
  - `git diff --check` passed.
  - `pnpm lint` passed.
- Deployed verification: not applicable; no runtime behavior or infrastructure changed.
- Telemetry verification: not applicable; no runtime validation run was introduced.
