import type {
  CostBasis,
  LedgerItem,
  PriceBook,
  Run,
  StageName,
  TranslationJob,
  WorkflowVariant
} from "@agentcore-pdf-translator/schemas";

export type LedgerItemBase = {
  readonly workspaceId: string;
  readonly runId: string;
  readonly jobId: string;
  readonly documentId: string;
  readonly workflowVariant: WorkflowVariant;
  readonly stageName: StageName;
  readonly stageSequence: number;
  readonly priceBookVersion: string;
  readonly createdAt: string;
  readonly traceId?: string;
  readonly spanId?: string;
};

export type ModelInferenceLedgerOptions = LedgerItemBase & {
  readonly modelId: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
};

export type GatewayLedgerOptions = LedgerItemBase & {
  readonly toolName: string;
  readonly operationCount: number;
};

export type HumanReviewLedgerOptions = LedgerItemBase & {
  readonly reviewerSeconds: number;
  readonly hourlyRateUsd?: number;
};

export type RunCostRollup = {
  readonly runId: string;
  readonly llmOnlyCostUsd: number;
  readonly fullWorkflowCostUsd: number;
  readonly humanReviewCostUsd: number;
  readonly retryCostUsd: number;
  readonly remediationCostUsd: number;
};

export type JobEconomicsRollup = {
  readonly jobId: string;
  readonly status: TranslationJob["status"];
  readonly runCount: number;
  readonly llmOnlyCostUsd: number;
  readonly fullWorkflowCostUsd: number;
  readonly humanReviewCostUsd: number;
  readonly retryCostUsd: number;
  readonly remediationCostUsd: number;
  readonly costPerVerifiedOutcomeUsd: number | null;
  readonly unitValueUsd: number;
  readonly unitMarginUsd: number | null;
  readonly costBasis: CostBasis;
};

export type JobEconomicsOptions = {
  readonly job: TranslationJob;
  readonly runs: ReadonlyArray<Run>;
  readonly ledgerItems: ReadonlyArray<LedgerItem>;
};

export type PriceBookLookup = {
  readonly priceBook: PriceBook;
};
