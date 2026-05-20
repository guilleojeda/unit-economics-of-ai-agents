import {
  AppSettingSchema,
  ArtifactSchema,
  DocumentSchema,
  EvaluationResultSchema,
  LedgerItemSchema,
  PriceBookSchema,
  ReviewDecisionSchema,
  RunSchema,
  StageEventSchema,
  TranslationJobSchema,
  type AppSetting,
  type Artifact,
  type Document,
  type EvaluationResult,
  type LedgerItem,
  type PriceBook,
  type ReviewDecision,
  type Run,
  type StageEvent,
  type TranslationJob
} from "@agentcore-pdf-translator/schemas";
import { RepositorySerializationError } from "../errors.js";
import {
  artifactTypeCreatedAtKey,
  attemptNumberRunKey,
  createdAtEntityKey,
  sequenceStageEventKey,
  stageSequenceLedgerKey,
  updatedAtEntityKey,
  workflowVariantCreatedAtJobKey
} from "./keys.js";

export type DynamoDbItem = Record<string, unknown>;

const forbiddenPayloadKeys = new Set([
  "base64",
  "body",
  "bytes",
  "content",
  "pdf",
  "pdfBytes",
  "rawPdf"
]);

function assertNoInlinePayload(value: object, entityName: string): void {
  for (const key of Object.keys(value)) {
    if (forbiddenPayloadKeys.has(key)) {
      throw new RepositorySerializationError(
        `${entityName} DynamoDB item cannot contain inline artifact payload field: ${key}`
      );
    }
  }
}

function removeUndefinedProperties(item: DynamoDbItem): DynamoDbItem {
  return Object.fromEntries(
    Object.entries(item).filter((entry): entry is [string, unknown] => entry[1] !== undefined)
  );
}

function assertItem(value: unknown, entityName: string): DynamoDbItem {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new RepositorySerializationError(`${entityName} DynamoDB item is not an object`);
  }

  return value as DynamoDbItem;
}

export function documentToItem(document: Document): DynamoDbItem {
  assertNoInlinePayload(document, "Document");
  return removeUndefinedProperties({
    ...DocumentSchema.parse(document),
    createdAtDocumentId: createdAtEntityKey(document.createdAt, document.documentId)
  });
}

export function itemToDocument(item: unknown): Document {
  return DocumentSchema.parse(assertItem(item, "Document"));
}

export function translationJobToItem(job: TranslationJob): DynamoDbItem {
  assertNoInlinePayload(job, "TranslationJob");
  const parsed = TranslationJobSchema.parse(job);

  return removeUndefinedProperties({
    ...parsed,
    createdAtJobId: createdAtEntityKey(parsed.createdAt, parsed.jobId),
    workflowVariantCreatedAtJobId:
      parsed.comparisonGroupId === undefined
        ? undefined
        : workflowVariantCreatedAtJobKey(parsed.workflowVariant, parsed.createdAt, parsed.jobId),
    updatedAtJobId: updatedAtEntityKey(parsed.updatedAt, parsed.jobId)
  });
}

export function itemToTranslationJob(item: unknown): TranslationJob {
  return TranslationJobSchema.parse(assertItem(item, "TranslationJob"));
}

export function runToItem(run: Run): DynamoDbItem {
  assertNoInlinePayload(run, "Run");
  const parsed = RunSchema.parse(run);

  return removeUndefinedProperties({
    ...parsed,
    attemptNumberPaddedCreatedAtRunId: attemptNumberRunKey(
      parsed.attemptNumber,
      parsed.createdAt,
      parsed.runId
    ),
    createdAtRunId: createdAtEntityKey(parsed.createdAt, parsed.runId),
    updatedAtRunId: updatedAtEntityKey(parsed.updatedAt, parsed.runId)
  });
}

export function itemToRun(item: unknown): Run {
  return RunSchema.parse(assertItem(item, "Run"));
}

export function stageEventToItem(stageEvent: StageEvent): DynamoDbItem {
  assertNoInlinePayload(stageEvent, "StageEvent");
  const parsed = StageEventSchema.parse(stageEvent);

  return removeUndefinedProperties({
    ...parsed,
    sequencePaddedStageNameStageEventId: sequenceStageEventKey(
      parsed.sequence,
      parsed.stageName,
      parsed.stageEventId
    )
  });
}

export function itemToStageEvent(item: unknown): StageEvent {
  return StageEventSchema.parse(assertItem(item, "StageEvent"));
}

export function artifactToItem(artifact: Artifact): DynamoDbItem {
  assertNoInlinePayload(artifact, "Artifact");
  const parsed = ArtifactSchema.parse(artifact);
  const artifactCreatedAtKey = artifactTypeCreatedAtKey(
    parsed.artifactType,
    parsed.createdAt,
    parsed.artifactId
  );

  return removeUndefinedProperties({
    ...parsed,
    artifactTypeCreatedAtArtifactId: artifactCreatedAtKey,
    createdAtArtifactId:
      parsed.jobId === undefined ? undefined : createdAtEntityKey(parsed.createdAt, parsed.artifactId)
  });
}

export function itemToArtifact(item: unknown): Artifact {
  return ArtifactSchema.parse(assertItem(item, "Artifact"));
}

export function ledgerItemToItem(ledgerItem: LedgerItem): DynamoDbItem {
  assertNoInlinePayload(ledgerItem, "LedgerItem");
  const parsed = LedgerItemSchema.parse(ledgerItem);

  return removeUndefinedProperties({
    ...parsed,
    stageSequencePaddedCreatedAtLedgerItemId: stageSequenceLedgerKey(
      parsed.stageSequence,
      parsed.createdAt,
      parsed.ledgerItemId
    ),
    createdAtLedgerItemId: createdAtEntityKey(parsed.createdAt, parsed.ledgerItemId)
  });
}

export function itemToLedgerItem(item: unknown): LedgerItem {
  return LedgerItemSchema.parse(assertItem(item, "LedgerItem"));
}

export function evaluationResultToItem(evaluationResult: EvaluationResult): DynamoDbItem {
  assertNoInlinePayload(evaluationResult, "EvaluationResult");
  const parsed = EvaluationResultSchema.parse(evaluationResult);

  return removeUndefinedProperties({
    ...parsed,
    createdAtEvaluationResultId: createdAtEntityKey(
      parsed.createdAt,
      parsed.evaluationResultId
    )
  });
}

export function itemToEvaluationResult(item: unknown): EvaluationResult {
  return EvaluationResultSchema.parse(assertItem(item, "EvaluationResult"));
}

export function reviewDecisionToItem(reviewDecision: ReviewDecision): DynamoDbItem {
  assertNoInlinePayload(reviewDecision, "ReviewDecision");
  const parsed = ReviewDecisionSchema.parse(reviewDecision);

  return removeUndefinedProperties({
    ...parsed,
    createdAtReviewDecisionId: createdAtEntityKey(parsed.createdAt, parsed.reviewDecisionId)
  });
}

export function itemToReviewDecision(item: unknown): ReviewDecision {
  return ReviewDecisionSchema.parse(assertItem(item, "ReviewDecision"));
}

export function priceBookToItem(priceBook: PriceBook): DynamoDbItem {
  assertNoInlinePayload(priceBook, "PriceBook");
  const parsed = PriceBookSchema.parse(priceBook);

  return removeUndefinedProperties({
    ...parsed,
    updatedAtPriceBookVersion: updatedAtEntityKey(parsed.updatedAt, parsed.priceBookVersion)
  });
}

export function itemToPriceBook(item: unknown): PriceBook {
  return PriceBookSchema.parse(assertItem(item, "PriceBook"));
}

export function appSettingToItem(appSetting: AppSetting): DynamoDbItem {
  assertNoInlinePayload(appSetting, "AppSetting");
  return removeUndefinedProperties(AppSettingSchema.parse(appSetting));
}

export function itemToAppSetting(item: unknown): AppSetting {
  return AppSettingSchema.parse(assertItem(item, "AppSetting"));
}
