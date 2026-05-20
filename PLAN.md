# PLAN

## Objective

Perform a twelfth adversarial review of all current story contracts and patch any clear defects that could let future slices pass while failing the intended AWS AgentCore unit-economics product.

## Scope and non-goals

In scope:

- Review PR-009, PR-010, PR-010A, and PR-011 through PR-016 from current `main`.
- Re-check the story set against repository instructions, reference contracts, and the intended controlled Spanish-to-English PDF economics workflow.
- Challenge the stories from a fresh failure perspective: evidence hygiene, secret handling, private artifact access, CI/deploy artifacts, logs, telemetry, and persisted validation records.
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
- Prior passes tightened deployment, fixture ownership, review cost, comparison assumptions, idempotency, artifact integrity, price-book versioning, model/configuration evidence, private artifact access, immutable source lineage, explicit artifact-bearing tool requests, implementation provenance, and environment/validation scoping.
- Open question to resolve by reading: do the story contracts prevent future deploy artifacts, CI logs, telemetry, PLAN evidence, and validation records from leaking credentials, presigned URLs, raw PDF bytes, extracted/translated document content, prompts, model responses, or other private artifacts?

## Expected outcomes

- Any new high-confidence story-contract defects found by this pass are fixed narrowly.
- Future validation evidence should remain useful while avoiding credentials, signed URLs, raw document bytes, and unnecessary document content exposure.
- If no new defects are found, the review evidence explains why no story edits were made.
- No runtime behavior changes are made.
- PR-009 remains the next implementation task.

## Product design

The product is an AWS AgentCore-based unit-economics app for controlled Spanish-to-English PDF workflow measurement. `TranslationJob` is the business unit, `Run` is a technical attempt, and `LedgerItem` records are the economics source of truth. The app keeps artifacts private and uses short-lived access for review. Verification evidence must prove deployed behavior without turning private artifact access, model prompts/responses, signed URLs, or credentials into durable project records.

## Deterministic checks

- Targeted `rg` checks for any patched contract language.
- Targeted `rg` checks for evidence hygiene, secret handling, presigned URL handling, raw bytes/content logging, and private artifact wording.
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
   - Done when evidence hygiene, secret handling, artifact access, logs, telemetry, and deploy artifact risks have been challenged from a fresh angle.

3. Patch grounded defects if found.
   - Done when required story/reference changes are made narrowly and recorded.

4. Run deterministic checks and record evidence.
   - Done when checks pass or blockers are recorded.

## Risks and constraints

- Do not add process weight without a concrete failure mode.
- Do not obscure PR-009 as the next task.
- Do not create contradictions with repository-local AGENTS.md or global delivery rules.
- Do not weaken the requirement to record evidence in `PLAN.md`; require sanitized evidence instead.
- Avoid repeating previous passes unless the repeated concern reveals a new concrete contract hole.

## Progress, blockers, and evidence

- Loaded `planning`, `review-plan`, `review-plan-adversarial`, and `testing` skills.
- Confirmed starting point: clean `main` at `c8ea4e9`.
- Created branch `codex/adversarial-story-review-pass-12`.
- Read the governing local instructions, PR-009 through PR-016 story contracts, `docs/reference/API_ROUTES.md`, `docs/reference/TOOL_CONTRACTS.md`, `docs/reference/S3_ARTIFACT_KEYS.md`, and relevant product-doc excerpts.
- Adversarial finding: the story set required rich evidence in `PLAN.md`, CI artifacts, deploy artifacts, job summaries, logs, telemetry, browser evidence, and validation records, but did not consistently require redaction of credentials, auth headers, cookies, full presigned URLs, signed query strings, raw artifact bytes, full prompts, raw model responses, or full extracted/translated document text.
- Patched reference contracts to define sanitized evidence as resource IDs, artifact IDs, S3 bucket/key pairs, checksums/hashes, trace/request IDs, status codes, route names, timestamps, cost totals, token usage, latency, and short summaries while forbidding durable storage of secrets, signed URLs, raw bytes, full document content, prompts, and raw model responses.
- Patched PR-009 through PR-016 so future implementation slices must prove evidence hygiene in scope, deterministic checks, deployed verification, telemetry verification, acceptance criteria, and review traps where applicable.
- Verified forbidden mode wording remains present across story/reference contracts with `rg -n 'replay|synthetic|live-capture|recording|presentation|product mode|correlation only|must not become a product mode|must not create' docs/codex docs/reference`.
- Verified evidence-hygiene wording is present across story/reference contracts with `rg -n 'evidence hygiene|secret redaction|sanitized|redact|presigned|signed query|auth headers|cookies|raw PDF|raw image|raw artifacts|full prompts|raw model responses|full extracted|full translated|PLAN.md|CI artifacts|browser evidence' docs/codex docs/reference PLAN.md`.
- `git diff --check` passed.
- `pnpm lint` passed.
- `pnpm typecheck` passed.
- `pnpm test` passed.
- No blockers.
- Plan review gate:
  - I agree with this plan.
  - It contains enough to perform a fresh adversarial pass focused on evidence hygiene and private-data leakage without re-litigating only prior findings.
  - The best solution is to read the story set and references, then patch only grounded defects.
  - Confidence: HECK YES that this is the right process for this review pass.
