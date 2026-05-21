import type { App, Environment } from "aws-cdk-lib";

const DEFAULT_STAGE = "dev";
const DEFAULT_WORKSPACE_ID = "ws_default";
const DEFAULT_ACTIVE_PRICE_BOOK_VERSION = "pricebook_default";
const STAGE_MAX_LENGTH = 15;
const STAGE_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u;

export type AppConfig = {
  readonly stage: string;
  readonly region: "us-east-1";
  readonly workspaceId: string;
  readonly activePriceBookVersion: string;
  readonly priceBookHumanReviewHourlyRateUsd: string;
  readonly allowUnauthenticatedPlaceholderApi: boolean;
  readonly resourcePrefix: string;
  readonly env: Environment;
};

function stringContext(app: App, key: string, fallback: string): string {
  const value = app.node.tryGetContext(key) as unknown;

  if (value === undefined) {
    return fallback;
  }

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Context value ${key} must be a non-empty string.`);
  }

  return value;
}

function booleanContext(app: App, key: string, fallback: boolean): boolean {
  const value = app.node.tryGetContext(key) as unknown;

  if (value === undefined) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`Context value ${key} must be a boolean.`);
}

function positiveUsdContext(app: App, key: string): string {
  const value = stringContext(app, key, "");
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 1_000_000) {
    throw new Error(`Context value ${key} must be a positive USD amount no greater than 1000000.`);
  }

  if (!Number.isInteger(parsed * 10_000)) {
    throw new Error(`Context value ${key} must use at most 4 decimal places.`);
  }

  return value;
}

export function validateStage(stage: string): string {
  if (stage.length > STAGE_MAX_LENGTH) {
    throw new Error(`Stage must be ${STAGE_MAX_LENGTH} characters or fewer.`);
  }

  if (!STAGE_PATTERN.test(stage)) {
    throw new Error(
      "Stage must use lowercase letters, numbers, and hyphens, and must start and end with a letter or number."
    );
  }

  return stage;
}

export function resolveConfig(app: App): AppConfig {
  const stage = validateStage(stringContext(app, "stage", DEFAULT_STAGE));
  const allowUnauthenticatedPlaceholderApi = booleanContext(
    app,
    "allowUnauthenticatedPlaceholderApi",
    false
  );

  if (allowUnauthenticatedPlaceholderApi) {
    throw new Error(
      "Anonymous placeholder API routes are not allowed after PR-010A; use protected dev access."
    );
  }

  return {
    stage,
    region: "us-east-1",
    workspaceId: stringContext(app, "workspaceId", DEFAULT_WORKSPACE_ID),
    activePriceBookVersion: stringContext(
      app,
      "activePriceBookVersion",
      DEFAULT_ACTIVE_PRICE_BOOK_VERSION
    ),
    priceBookHumanReviewHourlyRateUsd: positiveUsdContext(
      app,
      "priceBookHumanReviewHourlyRateUsd"
    ),
    allowUnauthenticatedPlaceholderApi,
    resourcePrefix: `agentcore-pdf-translator-${stage}`,
    env: {
      region: "us-east-1"
    }
  };
}
