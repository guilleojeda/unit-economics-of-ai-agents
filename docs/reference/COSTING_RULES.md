# Costing Rules Reference

## Source of truth

```text
LedgerItems are the product source of truth for economics.
Logs and traces are for debugging and reconciliation, not the only source of cost truth.
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
  reviewerSeconds / 3600 * humanReviewHourlyRateUsd

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
