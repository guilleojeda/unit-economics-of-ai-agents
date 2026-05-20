import type {
  Artifact,
  EvaluationResult,
  LedgerItem,
  PriceBook,
  ReviewDecision,
  Run,
  StageEvent,
  TranslationJob,
  WorkflowVariant
} from "@agentcore-pdf-translator/schemas";

const workflowVariantOrder: Record<WorkflowVariant, number> = {
  V1_TEXT_ONLY: 1,
  V2_TEXT_AND_IMAGE_ANNOTATION: 2,
  V3_OPTIMIZED: 3
};

function compareText(left: string, right: string): number {
  return left.localeCompare(right);
}

function compareNumber(left: number, right: number): number {
  return left - right;
}

export function sortByCreatedAt<T extends { readonly createdAt: string }>(
  items: ReadonlyArray<T>
): ReadonlyArray<T> {
  return [...items].sort((left, right) => compareText(left.createdAt, right.createdAt));
}

export function sortJobsByComparisonDisplay(
  items: ReadonlyArray<TranslationJob>
): ReadonlyArray<TranslationJob> {
  return [...items].sort(
    (left, right) =>
      compareNumber(
        workflowVariantOrder[left.workflowVariant],
        workflowVariantOrder[right.workflowVariant]
      ) ||
      compareText(left.createdAt, right.createdAt) ||
      compareText(left.jobId, right.jobId)
  );
}

export function sortRunsByAttempt(items: ReadonlyArray<Run>): ReadonlyArray<Run> {
  return [...items].sort(
    (left, right) =>
      compareNumber(left.attemptNumber, right.attemptNumber) ||
      compareText(left.createdAt, right.createdAt) ||
      compareText(left.runId, right.runId)
  );
}

export function sortStageEventsBySequence(
  items: ReadonlyArray<StageEvent>
): ReadonlyArray<StageEvent> {
  return [...items].sort(
    (left, right) =>
      compareNumber(left.sequence, right.sequence) ||
      compareText(left.stageName, right.stageName) ||
      compareText(left.stageEventId, right.stageEventId)
  );
}

export function sortLedgerByRunDisplay(items: ReadonlyArray<LedgerItem>): ReadonlyArray<LedgerItem> {
  return [...items].sort(
    (left, right) =>
      compareNumber(left.stageSequence, right.stageSequence) ||
      compareText(left.createdAt, right.createdAt) ||
      compareText(left.ledgerItemId, right.ledgerItemId)
  );
}

export function sortLedgerByCreatedAt(items: ReadonlyArray<LedgerItem>): ReadonlyArray<LedgerItem> {
  return [...items].sort(
    (left, right) =>
      compareText(left.createdAt, right.createdAt) ||
      compareNumber(left.stageSequence, right.stageSequence) ||
      compareText(left.ledgerItemId, right.ledgerItemId)
  );
}

export function sortArtifactsByCreatedAt(items: ReadonlyArray<Artifact>): ReadonlyArray<Artifact> {
  return [...items].sort(
    (left, right) =>
      compareText(left.createdAt, right.createdAt) || compareText(left.artifactId, right.artifactId)
  );
}

export function sortEvaluationsByCreatedAt(
  items: ReadonlyArray<EvaluationResult>
): ReadonlyArray<EvaluationResult> {
  return [...items].sort(
    (left, right) =>
      compareText(left.createdAt, right.createdAt) ||
      compareText(left.evaluationResultId, right.evaluationResultId)
  );
}

export function sortReviewDecisionsByCreatedAt(
  items: ReadonlyArray<ReviewDecision>
): ReadonlyArray<ReviewDecision> {
  return [...items].sort(
    (left, right) =>
      compareText(left.createdAt, right.createdAt) ||
      compareText(left.reviewDecisionId, right.reviewDecisionId)
  );
}

export function sortPriceBooksByUpdatedAt(items: ReadonlyArray<PriceBook>): ReadonlyArray<PriceBook> {
  return [...items].sort(
    (left, right) =>
      compareText(left.updatedAt, right.updatedAt) ||
      compareText(left.priceBookVersion, right.priceBookVersion)
  );
}
