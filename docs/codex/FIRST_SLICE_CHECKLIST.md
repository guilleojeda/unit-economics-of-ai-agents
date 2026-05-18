# First Slice Checklist

## PR-001 — Monorepo foundation

```text
pnpm workspace exists
TypeScript config exists
lint/test/typecheck scripts exist
basic package structure exists
empty Next.js app exists
empty CDK app exists
CI workflow exists
pnpm install succeeds
pnpm typecheck succeeds
pnpm test succeeds
pnpm lint succeeds
pnpm cdk synth succeeds
```

## PR-002 — Shared schemas

```text
/packages/schemas exists
Document schema
TranslationJob schema
Run schema
StageEvent schema
Artifact schema
LedgerItem schema
EvaluationResult schema
ReviewDecision schema
PriceBook schema
AppSetting schema
API error schema
tool contracts
schema fixtures
schema tests
```

## PR-003 — Costing package

```text
/packages/costing exists
price book lookup
model inference ledger helpers
gateway ledger helpers
human review cost helper
rollupRunCost
rollupJobEconomics
unit tests
```

## PR-004 — In-memory repositories and state transitions

```text
/packages/data exists
repository interfaces
in-memory implementations
state transition guards
ID generation
S3 key builder
tests
```

## First slice must prove

```text
TranslationJob is the business unit.
Run is a technical attempt.
LedgerItems are economics source of truth.
LLM-only cost and full workflow cost are separate.
Human review creates cost.
Rejected work shows cost but no verified outcome.
Multi-attempt accepted jobs include failed attempt costs.
```
