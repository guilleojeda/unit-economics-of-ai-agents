import type { ModelPrice, PriceBook } from "@agentcore-pdf-translator/schemas";

export class PriceBookLookupError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PriceBookLookupError";
  }
}

export function findModelPrice(priceBook: PriceBook, modelId: string): ModelPrice {
  const price = priceBook.modelPrices.find((candidate) => candidate.modelId === modelId);

  if (price === undefined) {
    throw new PriceBookLookupError(`No model price found for modelId ${modelId}`);
  }

  return price;
}

export function requireGatewayOperationPrice(priceBook: PriceBook): number {
  const price = priceBook.agentCorePrices.gatewayOperationUsd;

  if (price === undefined) {
    throw new PriceBookLookupError("No AgentCore Gateway operation price configured");
  }

  return price;
}

export function getHumanReviewHourlyRate(
  priceBook: PriceBook,
  overrideHourlyRateUsd?: number
): number {
  return overrideHourlyRateUsd ?? priceBook.humanReviewHourlyRateDefaultUsd;
}
