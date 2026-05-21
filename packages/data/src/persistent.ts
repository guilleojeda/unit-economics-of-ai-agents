export {
  createDynamoDbDocumentSender,
  type DynamoCommand,
  type DynamoDbSender,
  type DynamoTableNames,
  type PersistentRepositoryConfig,
  validatePersistentRepositoryConfig
} from "./dynamodb/client.js";
export {
  createDynamoRepositories,
  DynamoAppSettingRepository,
  DynamoArtifactRepository,
  DynamoDocumentRepository,
  DynamoEvaluationResultRepository,
  DynamoLedgerItemRepository,
  DynamoPriceBookRepository,
  DynamoReviewDecisionRepository,
  DynamoRunRepository,
  DynamoStageEventRepository,
  DynamoTranslationJobRepository
} from "./dynamodb/repositories.js";
export {
  S3ArtifactObjectStore,
  createS3ClientPresigner,
  createS3ClientSender,
  validateArtifactS3Key,
  type ArtifactKeyContext,
  type ArtifactObjectMetadata,
  type ArtifactObjectStore,
  type GetArtifactObjectOptions,
  type PresignGetOptions,
  type PresignPutOptions,
  type PresignUrl,
  type PutArtifactJsonOptions,
  type PutArtifactObjectOptions,
  type S3Command,
  type S3Sender
} from "./s3-artifacts.js";
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
} from "./repositories.js";
import {
  createDynamoDbDocumentSender,
  type DynamoDbSender,
  type PersistentRepositoryConfig,
  validatePersistentRepositoryConfig
} from "./dynamodb/client.js";
import { createDynamoRepositories } from "./dynamodb/repositories.js";
import {
  createS3ClientPresigner,
  createS3ClientSender,
  S3ArtifactObjectStore,
  type ArtifactObjectStore,
  type PresignUrl,
  type S3Sender
} from "./s3-artifacts.js";

export type PersistentRepositories = {
  readonly documents: DocumentRepository;
  readonly translationJobs: TranslationJobRepository;
  readonly runs: RunRepository;
  readonly stageEvents: StageEventRepository;
  readonly artifacts: ArtifactRepository;
  readonly artifactObjects: ArtifactObjectStore;
  readonly ledgerItems: LedgerItemRepository;
  readonly evaluationResults: EvaluationResultRepository;
  readonly reviewDecisions: ReviewDecisionRepository;
  readonly priceBooks: PriceBookRepository;
  readonly appSettings: AppSettingRepository;
};

export type PersistentRepositoryFactoryOptions = {
  readonly config: PersistentRepositoryConfig;
  readonly dynamoClient?: DynamoDbSender;
  readonly s3Client?: S3Sender;
  readonly presignUrl?: PresignUrl;
};

export function createPersistentRepositories(
  options: PersistentRepositoryFactoryOptions
): PersistentRepositories {
  const config = validatePersistentRepositoryConfig(options.config);
  const dynamoClient = options.dynamoClient ?? createDynamoDbDocumentSender(config.region);
  const s3Client = options.s3Client ?? createS3ClientSender(config.region);
  const presignUrl = options.presignUrl ?? createS3ClientPresigner(config.region);
  const dynamoRepositories = createDynamoRepositories(dynamoClient, config.tableNames);

  return {
    ...dynamoRepositories,
    artifactObjects: new S3ArtifactObjectStore(
      s3Client,
      config.artifactBucketName,
      presignUrl
    )
  };
}
