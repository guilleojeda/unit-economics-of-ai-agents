import type { LedgerItem, PriceBook } from "@agentcore-pdf-translator/schemas";
import { findModelPrice, getHumanReviewHourlyRate, requireGatewayOperationPrice } from "./price-book.js";
import type {
  GatewayLedgerOptions,
  HumanReviewLedgerOptions,
  LedgerItemBase,
  ModelInferenceLedgerOptions
} from "./types.js";

type LedgerItemBaseFields = Pick<
  LedgerItem,
  | "workspaceId"
  | "ledgerItemId"
  | "runId"
  | "jobId"
  | "documentId"
  | "workflowVariant"
  | "stageName"
  | "stageSequence"
  | "priceBookVersion"
  | "createdAt"
  | "traceId"
  | "spanId"
>;

function baseLedgerItem(options: LedgerItemBase): LedgerItemBaseFields {
  return {
    workspaceId: options.workspaceId,
    ledgerItemId: "pending",
    runId: options.runId,
    jobId: options.jobId,
    documentId: options.documentId,
    workflowVariant: options.workflowVariant,
    stageName: options.stageName,
    stageSequence: options.stageSequence,
    priceBookVersion: options.priceBookVersion,
    createdAt: options.createdAt,
    ...(options.traceId === undefined ? {} : { traceId: options.traceId }),
    ...(options.spanId === undefined ? {} : { spanId: options.spanId })
  };
}

export function createModelInferenceLedgerItems(
  priceBook: PriceBook,
  options: ModelInferenceLedgerOptions
): ReadonlyArray<LedgerItem> {
  const price = findModelPrice(priceBook, options.modelId);
  const rows: LedgerItem[] = [];

  if (options.inputTokens > 0) {
    const unitPriceUsd = price.inputTokenPricePer1K / 1000;
    rows.push({
      ...baseLedgerItem(options),
      componentType: "MODEL_INFERENCE",
      componentName: options.modelId,
      billableUnit: "INPUT_TOKEN",
      unitCount: options.inputTokens,
      unitPriceUsd,
      estimatedCostUsd: options.inputTokens * unitPriceUsd,
      costSource: "BEDROCK_RESPONSE_USAGE",
      modelId: options.modelId,
      inputTokens: options.inputTokens
    });
  }

  if (options.outputTokens > 0) {
    const unitPriceUsd = price.outputTokenPricePer1K / 1000;
    rows.push({
      ...baseLedgerItem(options),
      componentType: "MODEL_INFERENCE",
      componentName: options.modelId,
      billableUnit: "OUTPUT_TOKEN",
      unitCount: options.outputTokens,
      unitPriceUsd,
      estimatedCostUsd: options.outputTokens * unitPriceUsd,
      costSource: "BEDROCK_RESPONSE_USAGE",
      modelId: options.modelId,
      outputTokens: options.outputTokens
    });
  }

  return rows;
}

export function createGatewayOperationLedgerItem(
  priceBook: PriceBook,
  options: GatewayLedgerOptions
): LedgerItem {
  const unitPriceUsd = requireGatewayOperationPrice(priceBook);

  return {
    ...baseLedgerItem(options),
    componentType: "AGENTCORE_GATEWAY",
    componentName: options.toolName,
    billableUnit: "TOOL_OPERATION",
    unitCount: options.operationCount,
    unitPriceUsd,
    estimatedCostUsd: options.operationCount * unitPriceUsd,
    costSource: "AGENTCORE_GATEWAY_METRIC",
    toolName: options.toolName,
    gatewayOperations: options.operationCount
  };
}

export function createHumanReviewLedgerItem(
  priceBook: PriceBook,
  options: HumanReviewLedgerOptions
): LedgerItem {
  const hourlyRateUsd = getHumanReviewHourlyRate(priceBook, options.hourlyRateUsd);
  const estimatedCostUsd = (options.reviewerSeconds / 3600) * hourlyRateUsd;

  return {
    ...baseLedgerItem(options),
    componentType: "HUMAN_REVIEW",
    componentName: "human-review",
    billableUnit: "SECOND",
    unitCount: options.reviewerSeconds,
    unitPriceUsd: hourlyRateUsd / 3600,
    estimatedCostUsd,
    costSource: "HUMAN_REVIEW_TIMER",
    humanReviewSeconds: options.reviewerSeconds
  };
}
