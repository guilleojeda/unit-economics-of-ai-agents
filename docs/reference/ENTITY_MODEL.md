# Entity Model Reference

```text
Document:
  source Spanish PDF and inspection cache

TranslationJob:
  business unit: produce one accepted English PDF

Run:
  one technical attempt under a TranslationJob

StageEvent:
  persisted workflow timeline row

Artifact:
  durable S3-backed file/JSON output

LedgerItem:
  normalized cost row and economics source of truth

EvaluationResult:
  automated verification output

ReviewDecision:
  human accept/reject/escalate decision and economic event

PriceBook:
  append-only configured prices used to convert telemetry into estimated cost

AppSetting:
  configuration such as ACTIVE_PRICE_BOOK_VERSION

Workflow/model configuration evidence:
  persisted model IDs and prompt/configuration versions or labels needed to support V1/V2/V3 comparison claims
```

Core relationship:

```text
Document 1 → many TranslationJobs
TranslationJob 1 → many Runs
Run 1 → many StageEvents
Run 1 → many Artifacts
Run 1 → many LedgerItems
Run 1 → many EvaluationResults
TranslationJob 1 → many ReviewDecisions
```
