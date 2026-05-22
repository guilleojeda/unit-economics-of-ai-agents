import { Aws } from "aws-cdk-lib";
import type { AppConfig } from "./config.js";

export type TableKey =
  | "Documents"
  | "TranslationJobs"
  | "Runs"
  | "StageEvents"
  | "Artifacts"
  | "LedgerItems"
  | "EvaluationResults"
  | "ReviewDecisions"
  | "PriceBooks"
  | "AppSettings";

const tableNameSuffixes: Readonly<Record<TableKey, string>> = {
  Documents: "documents",
  TranslationJobs: "translation-jobs",
  Runs: "runs",
  StageEvents: "stage-events",
  Artifacts: "artifacts",
  LedgerItems: "ledger-items",
  EvaluationResults: "evaluation-results",
  ReviewDecisions: "review-decisions",
  PriceBooks: "price-books",
  AppSettings: "app-settings"
};

export function stackName(config: AppConfig, suffix: string): string {
  return `AgentCorePdfTranslator-${config.stage}-${suffix}Stack`;
}

export function artifactBucketName(config: AppConfig): string {
  return `${config.resourcePrefix}-${Aws.ACCOUNT_ID}-${config.region}`;
}

export function frontendBucketName(config: AppConfig): string {
  return `${config.resourcePrefix}-frontend-${Aws.ACCOUNT_ID}-${config.region}`;
}

export function tableName(config: AppConfig, key: TableKey): string {
  return `${config.resourcePrefix}-${tableNameSuffixes[key]}`;
}

export function controlApiLambdaName(config: AppConfig): string {
  return `${config.resourcePrefix}-control-api`;
}

export function controlApiName(config: AppConfig): string {
  return `${config.resourcePrefix}-control-api`;
}

export function agentCoreRuntimeName(config: AppConfig): string {
  return `AgentCorePdfTranslator_${config.stage.replace(/-/gu, "_")}`;
}

export function agentCoreGatewayName(config: AppConfig): string {
  return `${config.resourcePrefix}-gateway`;
}

export function gatewayToolLambdaName(config: AppConfig, toolGroup: string): string {
  return `${config.resourcePrefix}-${toolGroup}-gateway-tool`;
}
