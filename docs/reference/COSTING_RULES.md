# Costing Rules Reference

## Source of truth

```text
LedgerItems are the product source of truth for economics.
Logs and traces are for debugging and reconciliation, not the only source of cost truth.
```

## Price book versioning

```text
PriceBook versions are append-only economics configuration.
Do not mutate or overwrite a PriceBook version once it is referenced by a TranslationJob, LedgerItem, or ReviewDecision.
Changing the current price book means creating/selecting another version and updating ACTIVE_PRICE_BOOK_VERSION.
TranslationJob.priceBookVersion and TranslationJob.valueModel are recorded at job creation.
LedgerItems record the priceBookVersion, unitPriceUsd, estimatedCostUsd, costSource, and model/tool/review basis used when the economic event occurred.
Historical job economics are rolled up from persisted LedgerItems and the job's recorded value model, not repriced from the current PriceBook.
```

## Consistency requirements

```text
LedgerItem rows must be committed consistently with the product event they price.
MODEL_INFERENCE, Gateway/tool, retry, remediation, evaluation, and human-review LedgerItems must reference the run/job/stage/review context that caused them.
Review acceptance cannot become terminal unless its ReviewDecision and HUMAN_REVIEW LedgerItem are both committed.
Accepted job economics, cost per verified outcome, and unit margin must not be shown from incomplete or orphaned ledger groups.
If a persistence failure leaves economics incomplete, the UI/API must label or block the aggregate until recovery or a failed/incomplete state is recorded.
```

## Component types

```text
MODEL_INFERENCE
AGENTCORE_RUNTIME
AGENTCORE_GATEWAY
AGENTCORE_POLICY
AGENTCORE_MEMORY
EXTERNAL_SERVICE
HUMAN_REVIEW
RETRY
REMEDIATION
```

## Cost sources

```text
BEDROCK_RESPONSE_USAGE
AGENTCORE_RUNTIME_METRIC
AGENTCORE_GATEWAY_METRIC
AGENTCORE_POLICY_METRIC
AGENTCORE_MEMORY_METRIC
EXTERNAL_SERVICE_METRIC
HUMAN_REVIEW_TIMER
PRICE_BOOK_ESTIMATE
AWS_BILL_RECONCILED
```

## Formulas

```text
llmOnlyCostUsd =
  sum(ledger.estimatedCostUsd where componentType = MODEL_INFERENCE)

fullWorkflowCostUsd =
  sum(all ledger.estimatedCostUsd)

humanReviewCostUsd =
  reviewerSeconds / 3600 * humanReviewHourlyRateUsd from the job's recorded price book/value model

jobCostUsd =
  sum(full workflow costs for every run under job)

costPerVerifiedOutcomeUsd =
  jobCostUsd if job.status = ACCEPTED
  null otherwise

unitMarginUsd =
  valuePerAcceptedPdfUsd - costPerVerifiedOutcomeUsd
```

## Required display distinction

```text
LLM-only cost != full workflow cost
completed run != accepted outcome
estimated cost != bill-reconciled actual
rejected work still consumed cost
```
