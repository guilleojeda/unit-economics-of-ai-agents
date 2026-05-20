# Entity Model Reference

```text
Document:
  source Spanish PDF and inspection cache; stores the immutable canonical source artifact identity, S3 key, and checksum/hash for the document

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

Workflow implementation provenance:
  persisted deployed commit SHA, CI/deploy artifact identity, runtime image tag/digest, and tool Lambda version/alias when available; needed to support or label/block V1/V2/V3 comparison claims that could be affected by implementation changes

Environment and validation evidence:
  deployed environment identity for acceptance evidence, including stage, AWS region, AWS account ID, deploy artifact identity, merged commit SHA, and validationRunId when supplied; used to prevent wrong-environment, wrong-account, stale, or cross-workspace records from satisfying deployed verification
```

Comparison responses that present V1/V2/V3 claims must be able to prove or label/block mismatches in source document, canonical source artifact identity/checksum, comparison-group lineage, workspace/environment identity, price-book version, business value assumptions, workflow/model configuration evidence, and workflow implementation provenance.

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

Multi-record product events must preserve relationship consistency. A `Document` registration includes the `Document` and canonical `SOURCE_PDF` `Artifact`; a stage result includes its StageEvent, Artifacts, EvaluationResult where applicable, and LedgerItems; a review decision includes the ReviewDecision, HUMAN_REVIEW LedgerItem, and terminal run/job state. These groups must be committed atomically or through a recoverable staged workflow that prevents incomplete groups from being displayed as successful product outcomes.
