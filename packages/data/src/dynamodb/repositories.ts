import { PutCommand, type QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import type {
  AppSetting,
  Artifact,
  ComponentType,
  Document,
  EvaluationResult,
  JobStatus,
  LedgerItem,
  PriceBook,
  ReviewDecision,
  Run,
  RunStatus,
  StageEvent,
  TranslationJob
} from "@agentcore-pdf-translator/schemas";
import { RepositoryConflictError, RepositoryInvariantError } from "../errors.js";
import type {
  AppSettingRepository,
  ArtifactRepository,
  DocumentRepository,
  EvaluationResultRepository,
  LedgerItemRepository,
  PriceBookRepository,
  ReviewDecisionRepository,
  RunRepository,
  StageEventRepository,
  TranslationJobRepository
} from "../repositories.js";
import {
  sortArtifactsByCreatedAt,
  sortByCreatedAt,
  sortEvaluationsByCreatedAt,
  sortJobsByComparisonDisplay,
  sortLedgerByCreatedAt,
  sortLedgerByRunDisplay,
  sortReviewDecisionsByCreatedAt,
  sortRunsByAttempt,
  sortStageEventsBySequence
} from "../sort.js";
import { type DynamoDbSender, getOne, queryAll, sendPut, type DynamoTableNames } from "./client.js";
import { dynamoIndexes } from "./keys.js";
import {
  appSettingToItem,
  artifactToItem,
  documentToItem,
  evaluationResultToItem,
  itemToAppSetting,
  itemToArtifact,
  itemToDocument,
  itemToEvaluationResult,
  itemToLedgerItem,
  itemToPriceBook,
  itemToReviewDecision,
  itemToRun,
  itemToStageEvent,
  itemToTranslationJob,
  ledgerItemToItem,
  priceBookToItem,
  reviewDecisionToItem,
  runToItem,
  stageEventToItem,
  translationJobToItem,
  type DynamoDbItem
} from "./mappers.js";

type ItemParser<T> = (item: unknown) => T;

function queryByPartitionInput(
  tableName: string,
  partitionKeyName: string,
  partitionKeyValue: string,
  indexName?: string
): QueryCommandInput {
  return {
    TableName: tableName,
    ...(indexName === undefined ? {} : { IndexName: indexName }),
    KeyConditionExpression: "#partitionKey = :partitionKey",
    ExpressionAttributeNames: {
      "#partitionKey": partitionKeyName
    },
    ExpressionAttributeValues: {
      ":partitionKey": partitionKeyValue
    },
    ...(indexName === undefined ? { ConsistentRead: true } : {})
  };
}

async function queryParsed<T>(
  client: DynamoDbSender,
  input: QueryCommandInput,
  parse: ItemParser<T>
): Promise<ReadonlyArray<T>> {
  const items = await queryAll(client, input);
  return items.map(parse);
}

function putUpsert(tableName: string, item: DynamoDbItem): PutCommand {
  return new PutCommand({
    TableName: tableName,
    Item: item
  });
}

function putCreateIfAbsent(
  tableName: string,
  item: DynamoDbItem,
  partitionKeyName: string
): PutCommand {
  return new PutCommand({
    TableName: tableName,
    Item: item,
    ConditionExpression: "attribute_not_exists(#partitionKey)",
    ExpressionAttributeNames: {
      "#partitionKey": partitionKeyName
    }
  });
}

export class DynamoDocumentRepository implements DocumentRepository {
  public constructor(
    private readonly client: DynamoDbSender,
    private readonly tableName: string
  ) {}

  public async put(document: Document): Promise<void> {
    await sendPut(
      this.client,
      putUpsert(this.tableName, documentToItem(document)),
      `Document write failed: ${document.documentId}`
    );
  }

  public async get(documentId: string): Promise<Document | undefined> {
    const item = await getOne(this.client, this.tableName, { documentId });
    return item === undefined ? undefined : itemToDocument(item);
  }

  public async listByWorkspace(workspaceId: string): Promise<ReadonlyArray<Document>> {
    const documents = await queryParsed(
      this.client,
      queryByPartitionInput(this.tableName, "workspaceId", workspaceId, dynamoIndexes.byWorkspace),
      itemToDocument
    );
    return sortByCreatedAt(documents);
  }
}

export class DynamoTranslationJobRepository implements TranslationJobRepository {
  public constructor(
    private readonly client: DynamoDbSender,
    private readonly tableName: string
  ) {}

  public async put(job: TranslationJob): Promise<void> {
    await sendPut(
      this.client,
      putUpsert(this.tableName, translationJobToItem(job)),
      `Translation job write failed: ${job.jobId}`
    );
  }

  public async get(jobId: string): Promise<TranslationJob | undefined> {
    const item = await getOne(this.client, this.tableName, { jobId });
    return item === undefined ? undefined : itemToTranslationJob(item);
  }

  public async listByDocument(documentId: string): Promise<ReadonlyArray<TranslationJob>> {
    const jobs = await queryParsed(
      this.client,
      queryByPartitionInput(this.tableName, "documentId", documentId, dynamoIndexes.byDocument),
      itemToTranslationJob
    );
    return sortByCreatedAt(jobs);
  }

  public async listByComparisonGroup(
    comparisonGroupId: string
  ): Promise<ReadonlyArray<TranslationJob>> {
    const jobs = await queryParsed(
      this.client,
      queryByPartitionInput(
        this.tableName,
        "comparisonGroupId",
        comparisonGroupId,
        dynamoIndexes.byComparisonGroup
      ),
      itemToTranslationJob
    );
    return sortJobsByComparisonDisplay(jobs);
  }

  public async listByStatus(status: JobStatus): Promise<ReadonlyArray<TranslationJob>> {
    const jobs = await queryParsed(
      this.client,
      queryByPartitionInput(this.tableName, "status", status, dynamoIndexes.byStatus),
      itemToTranslationJob
    );
    return sortByCreatedAt(jobs);
  }
}

export class DynamoRunRepository implements RunRepository {
  public constructor(
    private readonly client: DynamoDbSender,
    private readonly tableName: string
  ) {}

  public async put(run: Run): Promise<void> {
    await sendPut(this.client, putUpsert(this.tableName, runToItem(run)), `Run write failed: ${run.runId}`);
  }

  public async get(runId: string): Promise<Run | undefined> {
    const item = await getOne(this.client, this.tableName, { runId });
    return item === undefined ? undefined : itemToRun(item);
  }

  public async listByJob(jobId: string): Promise<ReadonlyArray<Run>> {
    const runs = await queryParsed(
      this.client,
      queryByPartitionInput(this.tableName, "jobId", jobId, dynamoIndexes.byJob),
      itemToRun
    );
    return sortRunsByAttempt(runs);
  }

  public async listByDocument(documentId: string): Promise<ReadonlyArray<Run>> {
    const runs = await queryParsed(
      this.client,
      queryByPartitionInput(this.tableName, "documentId", documentId, dynamoIndexes.byDocument),
      itemToRun
    );
    return sortByCreatedAt(runs);
  }

  public async listByStatus(status: RunStatus): Promise<ReadonlyArray<Run>> {
    const runs = await queryParsed(
      this.client,
      queryByPartitionInput(this.tableName, "status", status, dynamoIndexes.byStatus),
      itemToRun
    );
    return sortByCreatedAt(runs);
  }
}

export class DynamoStageEventRepository implements StageEventRepository {
  public constructor(
    private readonly client: DynamoDbSender,
    private readonly tableName: string
  ) {}

  public async put(stageEvent: StageEvent): Promise<void> {
    await sendPut(
      this.client,
      putUpsert(this.tableName, stageEventToItem(stageEvent)),
      `Stage event write failed: ${stageEvent.stageEventId}`
    );
  }

  public async listByRun(runId: string): Promise<ReadonlyArray<StageEvent>> {
    const stageEvents = await queryParsed(
      this.client,
      queryByPartitionInput(this.tableName, "runId", runId),
      itemToStageEvent
    );
    return sortStageEventsBySequence(stageEvents);
  }
}

export class DynamoArtifactRepository implements ArtifactRepository {
  public constructor(
    private readonly client: DynamoDbSender,
    private readonly tableName: string
  ) {}

  public async put(artifact: Artifact): Promise<void> {
    await sendPut(
      this.client,
      putCreateIfAbsent(this.tableName, artifactToItem(artifact), "artifactId"),
      `Artifact already exists: ${artifact.artifactId}`
    );
  }

  public async get(artifactId: string): Promise<Artifact | undefined> {
    const item = await getOne(this.client, this.tableName, { artifactId });
    return item === undefined ? undefined : itemToArtifact(item);
  }

  public async listByRun(runId: string): Promise<ReadonlyArray<Artifact>> {
    const artifacts = await queryParsed(
      this.client,
      queryByPartitionInput(this.tableName, "runId", runId, dynamoIndexes.byRun),
      itemToArtifact
    );
    return sortArtifactsByCreatedAt(artifacts);
  }

  public async listByDocument(documentId: string): Promise<ReadonlyArray<Artifact>> {
    const artifacts = await queryParsed(
      this.client,
      queryByPartitionInput(this.tableName, "documentId", documentId, dynamoIndexes.byDocument),
      itemToArtifact
    );
    return sortArtifactsByCreatedAt(artifacts);
  }

  public async listByJob(jobId: string): Promise<ReadonlyArray<Artifact>> {
    const artifacts = await queryParsed(
      this.client,
      queryByPartitionInput(this.tableName, "jobId", jobId, dynamoIndexes.byJob),
      itemToArtifact
    );
    return sortArtifactsByCreatedAt(artifacts);
  }
}

export class DynamoLedgerItemRepository implements LedgerItemRepository {
  public constructor(
    private readonly client: DynamoDbSender,
    private readonly tableName: string
  ) {}

  public async put(ledgerItem: LedgerItem): Promise<void> {
    const existingLedgerItems = await this.listByRun(ledgerItem.runId);
    if (existingLedgerItems.some((candidate) => candidate.ledgerItemId === ledgerItem.ledgerItemId)) {
      throw new RepositoryConflictError(`Ledger item already exists: ${ledgerItem.ledgerItemId}`);
    }

    await sendPut(
      this.client,
      putCreateIfAbsent(this.tableName, ledgerItemToItem(ledgerItem), "runId"),
      `Ledger item already exists: ${ledgerItem.ledgerItemId}`
    );
  }

  public async listByRun(runId: string): Promise<ReadonlyArray<LedgerItem>> {
    const ledgerItems = await queryParsed(
      this.client,
      queryByPartitionInput(this.tableName, "runId", runId),
      itemToLedgerItem
    );
    return sortLedgerByRunDisplay(ledgerItems);
  }

  public async listByJob(jobId: string): Promise<ReadonlyArray<LedgerItem>> {
    const ledgerItems = await queryParsed(
      this.client,
      queryByPartitionInput(this.tableName, "jobId", jobId, dynamoIndexes.byJob),
      itemToLedgerItem
    );
    return sortLedgerByCreatedAt(ledgerItems);
  }

  public async listByDocument(documentId: string): Promise<ReadonlyArray<LedgerItem>> {
    const ledgerItems = await queryParsed(
      this.client,
      queryByPartitionInput(this.tableName, "documentId", documentId, dynamoIndexes.byDocument),
      itemToLedgerItem
    );
    return sortLedgerByCreatedAt(ledgerItems);
  }

  public async listByComponentType(
    componentType: ComponentType
  ): Promise<ReadonlyArray<LedgerItem>> {
    const ledgerItems = await queryParsed(
      this.client,
      queryByPartitionInput(
        this.tableName,
        "componentType",
        componentType,
        dynamoIndexes.byComponentType
      ),
      itemToLedgerItem
    );
    return sortLedgerByCreatedAt(ledgerItems);
  }
}

export class DynamoEvaluationResultRepository implements EvaluationResultRepository {
  public constructor(
    private readonly client: DynamoDbSender,
    private readonly tableName: string
  ) {}

  public async put(evaluationResult: EvaluationResult): Promise<void> {
    const existingEvaluationResults = await this.listByRun(evaluationResult.runId);
    if (
      existingEvaluationResults.some(
        (candidate) => candidate.evaluationResultId === evaluationResult.evaluationResultId
      )
    ) {
      throw new RepositoryConflictError(
        `Evaluation result already exists: ${evaluationResult.evaluationResultId}`
      );
    }

    await sendPut(
      this.client,
      putCreateIfAbsent(this.tableName, evaluationResultToItem(evaluationResult), "runId"),
      `Evaluation result already exists: ${evaluationResult.evaluationResultId}`
    );
  }

  public async listByRun(runId: string): Promise<ReadonlyArray<EvaluationResult>> {
    const evaluations = await queryParsed(
      this.client,
      queryByPartitionInput(this.tableName, "runId", runId),
      itemToEvaluationResult
    );
    return sortEvaluationsByCreatedAt(evaluations);
  }
}

export class DynamoReviewDecisionRepository implements ReviewDecisionRepository {
  public constructor(
    private readonly client: DynamoDbSender,
    private readonly tableName: string
  ) {}

  public async put(reviewDecision: ReviewDecision): Promise<void> {
    const existingReviewDecisions = await this.listByJob(reviewDecision.jobId);
    if (
      existingReviewDecisions.some(
        (candidate) => candidate.reviewDecisionId === reviewDecision.reviewDecisionId
      )
    ) {
      throw new RepositoryConflictError(
        `Review decision already exists: ${reviewDecision.reviewDecisionId}`
      );
    }

    await sendPut(
      this.client,
      putCreateIfAbsent(this.tableName, reviewDecisionToItem(reviewDecision), "jobId"),
      `Review decision already exists: ${reviewDecision.reviewDecisionId}`
    );
  }

  public async listByJob(jobId: string): Promise<ReadonlyArray<ReviewDecision>> {
    const reviewDecisions = await queryParsed(
      this.client,
      queryByPartitionInput(this.tableName, "jobId", jobId),
      itemToReviewDecision
    );
    return sortReviewDecisionsByCreatedAt(reviewDecisions);
  }
}

export class DynamoPriceBookRepository implements PriceBookRepository {
  public constructor(
    private readonly client: DynamoDbSender,
    private readonly tableName: string
  ) {}

  public async put(priceBook: PriceBook): Promise<void> {
    await sendPut(
      this.client,
      putUpsert(this.tableName, priceBookToItem(priceBook)),
      `Price book write failed: ${priceBook.priceBookVersion}`
    );
  }

  public async get(priceBookVersion: string): Promise<PriceBook | undefined> {
    const item = await getOne(this.client, this.tableName, { priceBookVersion });
    return item === undefined ? undefined : itemToPriceBook(item);
  }

  public async getActive(): Promise<PriceBook | undefined> {
    const activePriceBooks = await queryParsed(
      this.client,
      queryByPartitionInput(this.tableName, "status", "ACTIVE", dynamoIndexes.byStatus),
      itemToPriceBook
    );

    if (activePriceBooks.length > 1) {
      throw new RepositoryInvariantError("Multiple active price books found");
    }

    return activePriceBooks[0];
  }
}

export class DynamoAppSettingRepository implements AppSettingRepository {
  public constructor(
    private readonly client: DynamoDbSender,
    private readonly tableName: string
  ) {}

  public async put(appSetting: AppSetting): Promise<void> {
    await sendPut(
      this.client,
      putUpsert(this.tableName, appSettingToItem(appSetting)),
      `App setting write failed: ${appSetting.settingKey}`
    );
  }

  public async get(settingKey: AppSetting["settingKey"]): Promise<AppSetting | undefined> {
    const item = await getOne(this.client, this.tableName, { settingKey });
    return item === undefined ? undefined : itemToAppSetting(item);
  }
}

export function createDynamoRepositories(
  client: DynamoDbSender,
  tableNames: DynamoTableNames
): {
  readonly documents: DocumentRepository;
  readonly translationJobs: TranslationJobRepository;
  readonly runs: RunRepository;
  readonly stageEvents: StageEventRepository;
  readonly artifacts: ArtifactRepository;
  readonly ledgerItems: LedgerItemRepository;
  readonly evaluationResults: EvaluationResultRepository;
  readonly reviewDecisions: ReviewDecisionRepository;
  readonly priceBooks: PriceBookRepository;
  readonly appSettings: AppSettingRepository;
} {
  return {
    documents: new DynamoDocumentRepository(client, tableNames.documents),
    translationJobs: new DynamoTranslationJobRepository(client, tableNames.translationJobs),
    runs: new DynamoRunRepository(client, tableNames.runs),
    stageEvents: new DynamoStageEventRepository(client, tableNames.stageEvents),
    artifacts: new DynamoArtifactRepository(client, tableNames.artifacts),
    ledgerItems: new DynamoLedgerItemRepository(client, tableNames.ledgerItems),
    evaluationResults: new DynamoEvaluationResultRepository(client, tableNames.evaluationResults),
    reviewDecisions: new DynamoReviewDecisionRepository(client, tableNames.reviewDecisions),
    priceBooks: new DynamoPriceBookRepository(client, tableNames.priceBooks),
    appSettings: new DynamoAppSettingRepository(client, tableNames.appSettings)
  };
}
