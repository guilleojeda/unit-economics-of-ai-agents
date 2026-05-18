import type { LedgerItem } from "@agentcore-pdf-translator/schemas";
import type { JobEconomicsOptions, JobEconomicsRollup, RunCostRollup } from "./types.js";

function sumEstimatedCost(items: ReadonlyArray<LedgerItem>): number {
  return items.reduce((total, item) => total + item.estimatedCostUsd, 0);
}

export function rollupRunCost(runId: string, ledgerItems: ReadonlyArray<LedgerItem>): RunCostRollup {
  const runLedgerItems = ledgerItems.filter((item) => item.runId === runId);

  return {
    runId,
    llmOnlyCostUsd: sumEstimatedCost(
      runLedgerItems.filter((item) => item.componentType === "MODEL_INFERENCE")
    ),
    fullWorkflowCostUsd: sumEstimatedCost(runLedgerItems),
    humanReviewCostUsd: sumEstimatedCost(
      runLedgerItems.filter((item) => item.componentType === "HUMAN_REVIEW")
    ),
    retryCostUsd: sumEstimatedCost(runLedgerItems.filter((item) => item.componentType === "RETRY")),
    remediationCostUsd: sumEstimatedCost(
      runLedgerItems.filter((item) => item.componentType === "REMEDIATION")
    )
  };
}

export function rollupJobEconomics(options: JobEconomicsOptions): JobEconomicsRollup {
  const runIds = new Set(options.runs.map((run) => run.runId));
  const jobLedgerItems = options.ledgerItems.filter(
    (item) => item.jobId === options.job.jobId && runIds.has(item.runId)
  );
  const llmOnlyCostUsd = sumEstimatedCost(
    jobLedgerItems.filter((item) => item.componentType === "MODEL_INFERENCE")
  );
  const fullWorkflowCostUsd = sumEstimatedCost(jobLedgerItems);
  const humanReviewCostUsd = sumEstimatedCost(
    jobLedgerItems.filter((item) => item.componentType === "HUMAN_REVIEW")
  );
  const retryCostUsd = sumEstimatedCost(jobLedgerItems.filter((item) => item.componentType === "RETRY"));
  const remediationCostUsd = sumEstimatedCost(
    jobLedgerItems.filter((item) => item.componentType === "REMEDIATION")
  );
  const costPerVerifiedOutcomeUsd =
    options.job.status === "ACCEPTED" ? fullWorkflowCostUsd : null;
  const unitMarginUsd =
    costPerVerifiedOutcomeUsd === null
      ? null
      : options.job.valueModel.valuePerAcceptedPdfUsd - costPerVerifiedOutcomeUsd;

  return {
    jobId: options.job.jobId,
    status: options.job.status,
    runCount: options.runs.length,
    llmOnlyCostUsd,
    fullWorkflowCostUsd,
    humanReviewCostUsd,
    retryCostUsd,
    remediationCostUsd,
    costPerVerifiedOutcomeUsd,
    unitValueUsd: options.job.valueModel.valuePerAcceptedPdfUsd,
    unitMarginUsd,
    costBasis: options.job.costBasis
  };
}
