# Build Order

```text
PR-001 — Monorepo foundation
PR-002 — Shared schemas
PR-003 — Costing package
PR-004 — In-memory repositories and state transitions
PR-005 — Frontend with API-shaped fixtures
PR-006 — Control API skeleton
PR-007 — CDK storage/database/API basics
PR-008 — DynamoDB and S3 repositories
PR-009 — CI-backed dev deployment pipeline
PR-010 — Persistent Control API
PR-011 — Agent runtime stage runner without real Gateway
PR-012 — AgentCore Runtime and Gateway infrastructure
PR-013 — Real V1 PDF workflow
PR-014 — V2 image annotation
PR-015 — V3 optimization
PR-016 — Observability and hardening
```

The first Codex session should implement only PR-001 through PR-004.

Do not start AWS integration before these are done:

```text
schemas
costing
repository interfaces
in-memory repositories
state transition guards
S3 key builder
basic tests
```

Do not wire additional deployed behavior until PR-009 creates a CI-backed AWS dev deployment path. Deployment must run through CI and CDK/IaC, never through local `cdk deploy` or manual AWS console changes.

## Immediate Next Task

The next task is `PR-009 - CI-backed dev deployment pipeline`.

Use `docs/codex/PR-009-CI-DEPLOYMENT-PIPELINE.md` as the implementation contract. PR-009 must be completed before `PR-010 - Persistent Control API` or any later product/runtime slice starts.

PR-009 is accepted only after:

```text
merged SHA on main
normal post-merge CI deployment to us-east-1
deploy artifact exists for the merged SHA
deployed stack outputs captured
deployed Control API/app directly exercised by Codex
evidence recorded in PLAN.md
```

PR-009 is not a per-PR preview environment story. Do not treat `pnpm cdk synth`, local checks, CI logs, screenshots, or a branch-only deployment as acceptance evidence.

## Story Contracts

Use these contracts when implementing each remaining slice:

```text
PR-009 — docs/codex/PR-009-CI-DEPLOYMENT-PIPELINE.md
PR-010 — docs/codex/PR-010-PERSISTENT-CONTROL-API.md
PR-011 — docs/codex/PR-011-AGENT-RUNTIME-STAGE-RUNNER.md
PR-012 — docs/codex/PR-012-AGENTCORE-RUNTIME-GATEWAY-INFRA.md
PR-013 — docs/codex/PR-013-REAL-V1-PDF-WORKFLOW.md
PR-014 — docs/codex/PR-014-V2-IMAGE-ANNOTATION.md
PR-015 — docs/codex/PR-015-V3-OPTIMIZATION.md
PR-016 — docs/codex/PR-016-OBSERVABILITY-HARDENING.md
```

After PR-009 exists, every later story contract requires post-merge CI deployment, a deploy artifact for the merged SHA, direct deployed app/API use by Codex, and evidence in `PLAN.md`.
