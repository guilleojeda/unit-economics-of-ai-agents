# PLAN

## Objective

Perform an eighth adversarial review of all current story contracts and patch any clear defects that could let future slices pass while failing the intended AWS AgentCore unit-economics product.

## Scope and non-goals

In scope:

- Review PR-009, PR-010, PR-010A, and PR-011 through PR-016 from current `main`.
- Challenge artifact access, private S3 boundaries, deployed app usability, validation evidence, access controls, telemetry selectors, data leakage, and operational failure modes.
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
- Prior passes tightened deployment, fixture ownership, review cost, comparison assumptions, idempotency, artifact integrity, price-book versioning, and model/configuration comparison evidence.
- Fresh adversarial assumption under review: future stories require Codex and users to open source and translated PDF artifacts, but the current API/story contracts may not explicitly define a safe private-artifact access path.
- Finding under review: ADR-012 says artifact access goes through Control API-generated presigned URLs, but the story/API contracts must make that explicit so later stories do not satisfy PDF viewing through public S3 objects, raw API bytes, fixture files, or arbitrary-key signing.

## Expected outcomes

- Any new high-confidence story-contract defects found by this pass are fixed narrowly.
- Reviewer-visible source, translated, preview, evaluation, image, route, and skipped-stage artifacts are required to use private, authorized, short-lived artifact access.
- API and story contracts reject public S3, arbitrary-key, raw JSON bytes, fixture-file, or localhost shortcuts for deployed artifact viewing.
- If no new defects are found, the review evidence explains why no story edits were made.
- No runtime behavior changes are made.
- PR-009 remains the next implementation task.

## Product design

The product is an AWS AgentCore-based unit-economics app for controlled Spanish-to-English PDF workflow measurement. `TranslationJob` is the business unit, `Run` is a technical attempt, and `LedgerItem` records are the economics source of truth. The app must let reviewers inspect source and generated artifacts without exposing raw PDFs through APIs, making buckets public, bypassing workspace checks, or relying on local files.

## Deterministic checks

- Targeted `rg` checks for any patched contract language.
- Targeted `rg` checks for public/raw artifact access wording.
- `git diff --check`.
- `pnpm lint`.

## Deployed verification

Not applicable for this task. This is a documentation/story-contract review and patch only; it introduces no deployed runtime path.

## Telemetry verification

Not applicable for this task. No runtime validation run is introduced.

## Implementation steps

1. Read the governing instructions, story contracts, and relevant reference docs.
   - Done when AGENTS.md, PR-009 through PR-016, API/S3/artifact references, and relevant code shape have been inspected.

2. Perform adversarial review.
   - Done when artifact access, app usability, data leakage, and verification gaps have been challenged.

3. Patch grounded defects if found.
   - Done when required story/reference changes are made narrowly and recorded.

4. Run deterministic checks and record evidence.
   - Done when checks pass or blockers are recorded.

## Risks and constraints

- Do not add process weight without a concrete failure mode.
- Do not obscure PR-009 as the next task.
- Do not create contradictions with repository-local AGENTS.md or global delivery rules.
- Do not overconstrain implementation choices that later stories intentionally own.

## Progress, blockers, and evidence

- Loaded `review-plan` and `review-plan-adversarial` skills.
- Confirmed starting point: clean `main` at `4601093`.
- Created branch `codex/adversarial-story-review-pass-8`.
- Plan review gate:
  - I agree with this plan.
  - It contains enough to perform a fresh adversarial pass focused on artifact access and deployed usability.
  - The best solution is to read the story set and references, then patch only grounded defects.
  - Confidence: HECK YES that this is the right process for this review pass.
- Read AGENTS.md, PR-009, PR-010, PR-010A, PR-011 through PR-016, API routes, S3 artifact key reference, PRD artifact journeys, ADR-011, ADR-012, and implementation brief artifact/API sections.
- Finding 1: PR-010 did not explicitly define a Control API artifact-read route even though ADR-012 requires private artifacts accessed through presigned URLs generated by the Control API. If left unfixed, later stories could make buckets or objects public to satisfy "open/download PDF" verification. Patched PR-010 plus API/S3 references.
- Finding 2: PR-010A required rendered-app verification but did not require source artifact preview/open behavior to use PR-010 private artifact access. If left unfixed, the deployed frontend could pass by using fixtures, localhost files, public S3 URLs, or raw bytes. Patched PR-010A.
- Finding 3: PR-013 through PR-015 required opening translated PDFs and related artifacts but did not explicitly tie those actions to private artifact access. If left unfixed, V1/V2/V3 acceptance could rely on public objects or ad hoc download paths. Patched PR-013, PR-014, and PR-015.
- Finding 4: PR-016 needed a final cross-variant artifact-access audit, not only artifact integrity. If left unfixed, the hardening pass could verify metadata while still leaving public or unscoped reviewer links. Patched PR-016.
- Plan review gate after patching:
  - I agree with the revised plan and scope.
  - It contains enough to prove this docs-only review pass.
  - The solution is narrow: private artifact-access contract language only, no implementation.
  - Confidence: HECK YES that these patches address the identified artifact-access failure mode without changing PR-009 as the next task.
- Deterministic check evidence:
  - Targeted artifact-access `rg` scan passed and found the expected private access, short-lived URL, authorization, public S3, raw bytes, and arbitrary-key guardrail language in the patched story/reference docs.
  - Public/raw shortcut `rg` scan passed; hits are guardrail/negative contexts or the new `GET /api/artifacts/{artifactId}/download-url` contract, not positive permission to expose artifacts publicly.
  - `git diff --check` passed.
  - `pnpm lint` passed.
- Deployed verification: not applicable; no runtime behavior or infrastructure changed.
- Telemetry verification: not applicable; no runtime validation run was introduced.
