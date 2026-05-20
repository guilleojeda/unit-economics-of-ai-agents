# PLAN

## Objective

Perform a third adversarial review of all remaining story contracts and patch any clear defects that could let future implementation pass while bypassing locked architecture or contract discipline.

## Scope and non-goals

In scope:

- Review PR-009 through PR-016 from current `main`.
- Challenge architecture assumptions, fallback paths, and V3 contract gaps.
- Patch story contracts where the defect is grounded in existing ADRs, AGENTS.md, or reference docs.

Out of scope:

- Do not edit `/Users/guille/.codex/AGENTS.md`.
- Do not implement application, infrastructure, CI, AgentCore, Bedrock, PDF, or frontend code.
- Do not run `cdk deploy` or manually modify AWS resources.
- Do not choose unresolved implementation options unless existing docs already require a choice.
- Do not introduce replay, synthetic-run, live-capture, recording, or presentation behavior.

## Assumptions and open questions

- PR-009 remains the next implementation task.
- ADR-004 and ADR-005 make AgentCore Runtime plus TypeScript Strands non-optional for the real agent runtime.
- After PR-012 moves execution to AgentCore Runtime/Gateway, product runs must not silently fall back to the pre-Gateway runner path.
- V3 optimization introduces route/selective/batch stage behavior that needs explicit schema/contract handling, not ad hoc logic.

## Expected outcomes

- PR-012 requires the TypeScript Strands AgentCore runtime layer and proves no hidden pre-Gateway product fallback remains.
- PR-012 keeps local/test scaffolding possible without allowing a product runtime bypass.
- PR-015 requires V3 route/selective/batch behavior to be represented in shared schemas/contracts or explicitly documented internal stages before acceptance.
- No runtime behavior changes are made in this patch.

## Product design

The intended product is an AWS AgentCore-based unit-economics app. The architecture is part of the product proof: after PR-012, workflow execution must be through AgentCore Runtime and Gateway, with Strands as the AgentCore-compatible agent layer. A fallback runner can remain only as local/test scaffolding, not as deployed product behavior.

V3 exists to demonstrate architecture-driven margin changes. Its routing, selective image work, batch translation, skipped stages, and ledger effects must be contract-visible enough that evaluation and economics remain auditable.

## Deterministic checks

- `rg` verifies PR-012 includes Strands and no pre-Gateway fallback language.
- `rg` verifies PR-015 includes V3 contract/schema requirements.
- `git diff --check`.
- `pnpm lint`.

## Deployed verification

Not applicable for this task. This is a documentation/story-contract review and patch only; it introduces no deployed runtime path.

## Telemetry verification

Not applicable for this task. No runtime validation run is introduced.

## Implementation steps

1. Patch PR-012 architecture bypass gaps.
   - Done when Strands and no product fallback to the pre-Gateway runner are explicit.

2. Patch PR-015 V3 contract gaps.
   - Done when route/selective/batch stages require shared schema/contract coverage or explicit internal-stage documentation.

3. Run deterministic checks and record evidence.
   - Done when planned checks pass or blockers are recorded.

## Risks and constraints

- Do not overconstrain the PDF tool runtime decision that PR-013 owns.
- Do not require Strands where only deterministic Gateway tool Lambdas are being implemented.
- Do not turn V3 into a broad auto-optimizer; keep it controlled and auditable.

## Progress, blockers, and evidence

- Loaded `review-plan` and `review-plan-adversarial` skills.
- Created branch `codex/adversarial-story-review-pass-3`.
- Read story contracts PR-009 through PR-016, AGENTS.md, ADR references, open decisions, and workflow/tool references.
- Adversarial review findings:
  - PR-012 referenced AgentCore Runtime but did not explicitly require the TypeScript Strands runtime layer locked by ADR-004/ADR-005 and AGENTS.md.
  - PR-012 rejected using the pre-Gateway path as acceptance evidence but did not clearly forbid a hidden deployed product fallback after migration.
  - PR-015 relied on V3 route/selective/batch stages but did not require shared schemas/contracts or explicit internal-stage documentation for those stages.
- Plan review gate:
  - I agree with the plan.
  - It addresses the concrete defects from this review without changing PR-009's position or implementing runtime code.
  - The best solution is narrow story-contract edits because the defects are acceptance and architecture-proof gaps.
  - Confidence: HECK YES that this patch will reduce the chance of future work bypassing locked AgentCore/Strands architecture or implementing V3 with unreviewable ad hoc stages.
- Patched PR-012 to require the TypeScript Strands AgentCore runtime layer, deployed runtime metadata/evidence, and no deployed fallback path that bypasses AgentCore Runtime or Gateway.
- Patched PR-015 to require shared schemas/contracts or explicit internal-stage contracts for V3 route, selective, batch, and skipped-stage behavior.
- Deterministic evidence:
  - `rg -n "Strands|pre-Gateway runner|fallback|bypass AgentCore|TypeScript Strands" docs/codex/PR-012-AGENTCORE-RUNTIME-GATEWAY-INFRA.md` passed.
  - `rg -n "schema|contract|route|selective|batch|internal-stage|ad hoc" docs/codex/PR-015-V3-OPTIMIZATION.md` passed.
  - `git diff --check` passed.
  - `pnpm lint` passed.
- Deployed verification:
  - Not applicable. This task patches documentation/story contracts only and introduces no runtime path.
- Telemetry verification:
  - Not applicable. This task patches documentation/story contracts only and introduces no validation run.
- Current blockers:
  - None.
