# Initial Codex Prompt

Build the first vertical slice of an AWS AgentCore PDF translation unit-economics app.

Do not build AWS integration yet. Start with the local monorepo foundation, shared schemas, costing package, repository interfaces, in-memory repositories, state transition guards, and tests.

The product model is:

```text
Document → TranslationJob → Run → StageEvent / Artifact / LedgerItem → EvaluationResult → ReviewDecision → Job economics.
```

TranslationJob is the business unit. Run is a technical attempt. LedgerItems are the source of truth for economics. ReviewDecision converts a completed run into an accepted/rejected/escalated business outcome. LLM-only cost and full workflow cost must be calculated separately. Human review must create cost. Rejected work must still show cost but no verified outcome.

Use TypeScript and pnpm workspaces. Create the repo structure described in `docs/11-codex-implementation-brief-v1.0.md`. Implement:

```text
1. /packages/schemas with Zod schemas for Document, TranslationJob, Run, StageEvent, Artifact, LedgerItem, EvaluationResult, ReviewDecision, PriceBook, AppSetting, API errors, and tool contracts.
2. /packages/costing with price-book lookup, model/tool/review ledger helpers, rollupRunCost, and rollupJobEconomics.
3. /packages/data with repository interfaces, in-memory repository implementations, state transition guards, ID generation, and S3 key builder.
4. Unit tests for schemas, state transitions, S3 key generation, cost rollups, accepted/rejected job economics, and multi-attempt jobs.
```

Do not implement AgentCore Runtime, Gateway, Bedrock calls, PDF extraction, or frontend yet. Do not add replay mode, synthetic-run mode, live-capture mode, or presentation mode. Development fixtures are allowed only for tests and local scaffolding, not as product features.

The first deliverable is a passing TypeScript workspace where:

```text
pnpm install
pnpm typecheck
pnpm test
pnpm lint
```

all succeed.
