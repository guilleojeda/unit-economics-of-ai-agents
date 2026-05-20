# AgentCore PDF Translation Unit Economics App — Repo-Ready Specification Bundle

This bundle contains the product, architecture, implementation, and Codex guidance generated during the planning conversation for the AWS AgentCore PDF translation unit-economics app.

The product is an AWS-native application that translates controlled Spanish PDFs into English and measures the full cost of producing one accepted translated document. It is not a generic PDF translation app. The central product question is:

```text
Is the value of solving this document-translation task greater than the full cost of solving it?
```

The expected repository workflow is:

```text
Document → TranslationJob → Run → StageEvents / Artifacts / LedgerItems → EvaluationResult → ReviewDecision → Job economics
```

## How to use this bundle

Place the contents of this zip at the root of the repo. Start with:

```text
README.md
docs/09-prd-v0.8.md
docs/10-adrs-v0.9.md
docs/11-codex-implementation-brief-v1.0.md
```

Then use the detailed design docs as references while Codex implements the app in vertical slices:

```text
docs/04-data-model-and-contracts-v0.3.md
docs/05-workflow-implementation-spec-v0.4.md
docs/06-frontend-api-contract-v0.5.md
docs/07-infrastructure-cdk-spec-v0.6.md
docs/08-implementation-backlog-v0.7.md
```

The original talk notes and the uploaded pipeline diagram are included under:

```text
docs/00-original-inputs/talk-notes.md
docs/00-original-inputs/pipeline-diagram.png
```

## Most important implementation rules

Codex must preserve these rules:

```text
1. TranslationJob is the business unit.
2. Run is a technical attempt.
3. StageEvent is the persisted workflow timeline.
4. Artifact is the durable output record.
5. LedgerItem is the source of truth for economics.
6. ReviewDecision converts a completed run into an accepted/rejected/escalated outcome.
7. LLM-only cost and full workflow cost must be shown separately.
8. Human review is always costed.
9. Rejected work still has cost but no verified outcome.
10. PriceBook controls cost assumptions; prices are not hard-coded.
11. PDF bytes are stored in S3; requests pass artifact IDs and S3 keys.
12. The product has no replay mode, synthetic-run mode, live-capture mode, or presentation mode.
13. Development fixtures are allowed only as scaffolding and tests, not as product behavior.
14. MVP supports controlled digitally generated Spanish PDFs, not arbitrary scanned PDFs.
15. V1 must work before V2/V3 are implemented.
```

## Locked decisions

```text
AWS region: us-east-1

Primary implementation language:
  TypeScript

Agent framework:
  Strands, deployed to Amazon Bedrock AgentCore Runtime

Tool boundary:
  Amazon Bedrock AgentCore Gateway

Tool targets:
  Lambda-backed Gateway targets

PDF tooling:
  Python Lambda container is allowed if TypeScript PDF libraries are insufficient

Storage:
  S3 for artifact bytes

Database:
  DynamoDB with separate tables for MVP clarity

Infrastructure:
  AWS CDK TypeScript

Model calls:
  Amazon Bedrock Converse API through a shared wrapper

Observability:
  AgentCore Observability + CloudWatch

No product recording mode:
  The product performs real runs and stores normal historical results. Any recorded video records the product operating normally.
```

## Recommended repo structure

```text
/apps
  /web
  /control-api
  /agent-runtime
  /tools
    /pdf-pipeline-lambda
    /translation-lambda
    /evaluation-lambda

/packages
  /schemas
  /data
  /costing
  /bedrock
  /gateway
  /ui

/infra
  CDK TypeScript app and stacks

/demo-data
  controlled Spanish PDF content and generated fixtures

/scripts
  seed-price-book.ts
  generate-demo-pdf.ts

/docs
  this specification bundle
```

## Recommended first Codex task

Use `docs/codex/INITIAL_CODEX_PROMPT.md` as the first prompt. The first slice should implement only:

```text
monorepo foundation
shared schemas
costing package
repository interfaces
in-memory repositories
state transition guards
S3 key builder
basic tests
```

Do not start AWS integration before the economic/data model is working.

## File map

```text
docs/00-original-inputs/
  talk-notes.md
  pipeline-diagram.png

docs/01-initial-framing-and-recommendations.md
docs/02-locked-decisions-and-build-plan-v0.1.md
docs/03-product-ui-and-workflow-spec-v0.2.md
docs/04-data-model-and-contracts-v0.3.md
docs/05-workflow-implementation-spec-v0.4.md
docs/06-frontend-api-contract-v0.5.md
docs/07-infrastructure-cdk-spec-v0.6.md
docs/08-implementation-backlog-v0.7.md
docs/09-prd-v0.8.md
docs/10-adrs-v0.9.md
docs/11-codex-implementation-brief-v1.0.md

docs/codex/
  INITIAL_CODEX_PROMPT.md
  GUARDRAILS.md
  BUILD_ORDER.md
  FIRST_SLICE_CHECKLIST.md
  PR-009-CI-DEPLOYMENT-PIPELINE.md
  PR-010-PERSISTENT-CONTROL-API.md
  PR-011-AGENT-RUNTIME-STAGE-RUNNER.md
  PR-012-AGENTCORE-RUNTIME-GATEWAY-INFRA.md
  PR-013-REAL-V1-PDF-WORKFLOW.md
  PR-014-V2-IMAGE-ANNOTATION.md
  PR-015-V3-OPTIMIZATION.md
  PR-016-OBSERVABILITY-HARDENING.md

docs/reference/
  ENTITY_MODEL.md
  STATE_TRANSITIONS.md
  WORKFLOW_VARIANTS.md
  TOOL_CONTRACTS.md
  COSTING_RULES.md
  API_ROUTES.md
  S3_ARTIFACT_KEYS.md
  OPEN_DECISIONS.md
```

For PR-009 and later, use the `docs/codex/PR-*.md` story contracts as the acceptance source for post-merge CI deployment, deploy artifacts, direct deployed verification, telemetry status, and forbidden outcomes.

## Talk alignment

The talk’s thesis is preserved throughout this bundle:

```text
Unit economics starts with problem value.
The cost is end-to-end workflow cost, not token cost.
Architecture determines margins.
```

The app exists to show that method through one concrete workflow:

```text
controlled Spanish PDF → AgentCore workflow → translated English PDF → evaluation → reviewer decision → full ledger → unit margin
```
