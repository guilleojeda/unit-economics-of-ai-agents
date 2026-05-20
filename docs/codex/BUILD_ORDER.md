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
