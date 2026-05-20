# PLAN

## Objective

Perform another adversarial review of the remaining story contracts and patch any acceptance gaps that could still let future work pass without proving the intended product.

## Scope and non-goals

In scope:

- Review PR-009 through PR-016 from the current `main`.
- Challenge implicit assumptions around fake costs, review outcomes, image-text quality, final product acceptance, deployment failure handling, and evidence.
- Patch documentation/story contracts where the gap is clear and supported by existing product docs.

Out of scope:

- Do not edit `/Users/guille/.codex/AGENTS.md`.
- Do not implement application, infrastructure, CI, AgentCore, Bedrock, PDF, or frontend code.
- Do not run `cdk deploy` or manually modify AWS resources.
- Do not choose unresolved implementation options unless existing docs already require a choice.
- Do not introduce replay, synthetic-run, live-capture, recording, or presentation behavior.

## Assumptions and open questions

- PR-009 remains the next implementation task.
- Story contracts should be strong enough that a future PR cannot pass by producing plausible-looking but economically false records.
- Review-decision behavior is core product behavior and should not be left until final hardening.
- V2 image handling should prove the controlled page 4 process diagram is handled, not merely that some annotation exists.

## Expected outcomes

- PR-009 explicitly handles failed post-merge deployments as blockers and requires rollback/retry evidence where applicable.
- PR-011 cannot create deployed fake `MODEL_INFERENCE` ledger rows before real model calls exist and must verify accept/reject/escalate semantics, not only acceptance.
- PR-014 must verify controlled page 4 image text is translated/represented and decorative images are not costed as mandatory text translation work.
- PR-016 final acceptance must include accepted, rejected, escalated, and failed/technical-failure evidence where feasible, with consumed cost and no verified outcome for non-accepted work.
- No runtime behavior changes are made in this patch.

## Product design

The product exists to measure full workflow cost per accepted translated PDF. That means false economics are worse than missing features. Stories must force implementation to prove costs come from explicit ledger rows tied to real events, that reviewer decisions are product events with economic impact, and that V1/V2/V3 comparisons come from real persisted jobs rather than plausible UI states.

The controlled PDF includes material image text on page 4 and a decorative image. V2 should demonstrate added image-text capability and cost. V3 should demonstrate selective skipping of non-material work. Both must remain honest about costs and quality.

## Deterministic checks

- `rg` verifies PR-009 includes failed-deploy/rollback evidence language.
- `rg` verifies PR-011 forbids fake `MODEL_INFERENCE` rows and requires accept/reject/escalate coverage.
- `rg` verifies PR-014 mentions page 4 process diagram and decorative image cost behavior.
- `rg` verifies PR-016 requires accepted/rejected/escalated/failed evidence.
- `git diff --check`.
- `pnpm lint`.

## Deployed verification

Not applicable for this task. This is a documentation/story-contract review and patch only; it introduces no deployed runtime path.

## Telemetry verification

Not applicable for this task. No runtime validation run is introduced.

## Implementation steps

1. Patch PR-009 deployment-failure evidence gaps.
   - Done when failed post-merge deployment handling and rollback/retry evidence expectations are explicit.

2. Patch PR-011 fake-cost and review-decision coverage gaps.
   - Done when pre-Gateway runner economics cannot imply real model inference and deployed verification covers accept/reject/escalate semantics.

3. Patch PR-014 and PR-016 product-evidence gaps.
   - Done when V2 controlled image-text verification and final non-accepted outcome evidence are explicit.

4. Run deterministic checks and record evidence.
   - Done when planned checks pass or blockers are recorded.

## Risks and constraints

- Requiring every outcome path in every story could make slices too large; the patch should focus on the earliest story that owns each behavior.
- The pre-Gateway runner must prove contracts without creating a permanent fake execution mode.
- V2 should not become scanned-PDF OCR or image inpainting.
- Final hardening should not become production auth or billing reconciliation.

## Progress, blockers, and evidence

- Loaded `review-plan` and `review-plan-adversarial` skills.
- Created branch `codex/adversarial-story-review-pass-2`.
- Read story contracts PR-009 through PR-016 plus supporting state, workflow, and tool references.
- Adversarial review findings:
  - PR-009 blocked fake completion on failed deploys but did not require rollback/retry evidence if deployment partially failed.
  - PR-011 had the same fake model-cost risk that PR-012 now blocks.
  - PR-011's deployed verification only required acceptance even though accept/reject/escalate are core reviewer product events.
  - PR-014 could pass by showing generic image annotations without proving the controlled page 4 process diagram text was handled or that decorative images were treated honestly.
  - PR-016 final pass said rejected/failed work should remain visible, but did not force explicit rejected, escalated, and failed/technical-failure validation evidence.
- Plan review gate:
  - I agree with the plan.
  - It covers the concrete remaining defects found in this second adversarial pass without broadening PR-009 or implementing product code.
  - The best solution is targeted story-contract edits, because the failures are acceptance-definition gaps.
  - Confidence: HECK YES that the patch will materially reduce the chance of future slices passing with fake economics, weak review evidence, or incomplete product acceptance.
- Patched PR-009 to require recorded rollback/retry evidence for failed or partially failed post-merge deployments and to forbid manual AWS repair as the completion path.
- Patched PR-011 to forbid fake `MODEL_INFERENCE` rows before real model calls and require accept plus non-accepted reviewer-decision evidence.
- Patched PR-014 to require specific controlled page 4 process-diagram image-text handling and honest decorative-image cost treatment.
- Patched PR-016 to require final accepted, rejected, escalated, and failed/technical-failure evidence or a precise blocker for safe failure injection.
- Deterministic evidence:
  - `rg -n "failed|partially failed|rollback|retry evidence|deployment fails" docs/codex/PR-009-CI-DEPLOYMENT-PIPELINE.md` passed.
  - `rg -n "MODEL_INFERENCE|fake model inference|accept.*reject|reject.*escalate|non-accepted|verified outcome" docs/codex/PR-011-AGENT-RUNTIME-STAGE-RUNNER.md` passed.
  - `rg -n "page 4|process diagram|decorative image|generic annotations|mandatory image-text" docs/codex/PR-014-V2-IMAGE-ANNOTATION.md` passed.
  - `rg -n "ACCEPTED|REJECTED|ESCALATED|technical failure|failure injection|reject, escalate" docs/codex/PR-016-OBSERVABILITY-HARDENING.md` passed.
  - `git diff --check` passed.
  - `pnpm lint` passed.
- Deployed verification:
  - Not applicable. This task patches documentation/story contracts only and introduces no runtime path.
- Telemetry verification:
  - Not applicable. This task patches documentation/story contracts only and introduces no validation run.
- Current blockers:
  - None.
