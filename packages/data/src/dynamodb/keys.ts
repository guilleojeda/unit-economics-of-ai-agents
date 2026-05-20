import type { WorkflowVariant } from "@agentcore-pdf-translator/schemas";
import { RepositorySerializationError } from "../errors.js";

const workflowVariantSortPrefix: Record<WorkflowVariant, string> = {
  V1_TEXT_ONLY: "01",
  V2_TEXT_AND_IMAGE_ANNOTATION: "02",
  V3_OPTIMIZED: "03"
};

export const dynamoIndexes = {
  byWorkspace: "byWorkspace",
  byDocument: "byDocument",
  byComparisonGroup: "byComparisonGroup",
  byStatus: "byStatus",
  byJob: "byJob",
  byRun: "byRun",
  byComponentType: "byComponentType"
} as const;

export function canonicalIsoDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RepositorySerializationError(`Invalid ISO timestamp for DynamoDB key: ${value}`);
  }

  return date.toISOString();
}

export function padPositiveInteger(value: number, width: number): string {
  if (!Number.isInteger(value) || value < 0) {
    throw new RepositorySerializationError(`Invalid integer for DynamoDB key: ${value}`);
  }

  return value.toString().padStart(width, "0");
}

export function createdAtEntityKey(createdAt: string, entityId: string): string {
  return `${canonicalIsoDateTime(createdAt)}#${entityId}`;
}

export function updatedAtEntityKey(updatedAt: string, entityId: string): string {
  return `${canonicalIsoDateTime(updatedAt)}#${entityId}`;
}

export function workflowVariantCreatedAtJobKey(
  workflowVariant: WorkflowVariant,
  createdAt: string,
  jobId: string
): string {
  return `${workflowVariantSortPrefix[workflowVariant]}#${canonicalIsoDateTime(createdAt)}#${jobId}`;
}

export function attemptNumberRunKey(
  attemptNumber: number,
  createdAt: string,
  runId: string
): string {
  return `${padPositiveInteger(attemptNumber, 6)}#${canonicalIsoDateTime(createdAt)}#${runId}`;
}

export function sequenceStageEventKey(
  sequence: number,
  stageName: string,
  stageEventId: string
): string {
  return `${padPositiveInteger(sequence, 6)}#${stageName}#${stageEventId}`;
}

export function artifactTypeCreatedAtKey(
  artifactType: string,
  createdAt: string,
  artifactId: string
): string {
  return `${artifactType}#${canonicalIsoDateTime(createdAt)}#${artifactId}`;
}

export function stageSequenceLedgerKey(
  stageSequence: number,
  createdAt: string,
  ledgerItemId: string
): string {
  return `${padPositiveInteger(stageSequence, 6)}#${canonicalIsoDateTime(createdAt)}#${ledgerItemId}`;
}
