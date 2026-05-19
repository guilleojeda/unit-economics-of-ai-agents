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

export interface DocumentRepository {
  put(document: Document): Promise<void>;
  get(documentId: string): Promise<Document | undefined>;
  listByWorkspace(workspaceId: string): Promise<ReadonlyArray<Document>>;
}

export interface TranslationJobRepository {
  put(job: TranslationJob): Promise<void>;
  get(jobId: string): Promise<TranslationJob | undefined>;
  listByDocument(documentId: string): Promise<ReadonlyArray<TranslationJob>>;
  listByComparisonGroup(comparisonGroupId: string): Promise<ReadonlyArray<TranslationJob>>;
  listByStatus(status: JobStatus): Promise<ReadonlyArray<TranslationJob>>;
}

export interface RunRepository {
  put(run: Run): Promise<void>;
  get(runId: string): Promise<Run | undefined>;
  listByJob(jobId: string): Promise<ReadonlyArray<Run>>;
  listByDocument(documentId: string): Promise<ReadonlyArray<Run>>;
  listByStatus(status: RunStatus): Promise<ReadonlyArray<Run>>;
}

export interface StageEventRepository {
  put(stageEvent: StageEvent): Promise<void>;
  listByRun(runId: string): Promise<ReadonlyArray<StageEvent>>;
}

export interface ArtifactRepository {
  put(artifact: Artifact): Promise<void>;
  get(artifactId: string): Promise<Artifact | undefined>;
  listByRun(runId: string): Promise<ReadonlyArray<Artifact>>;
  listByDocument(documentId: string): Promise<ReadonlyArray<Artifact>>;
  listByJob(jobId: string): Promise<ReadonlyArray<Artifact>>;
}

export interface LedgerItemRepository {
  put(ledgerItem: LedgerItem): Promise<void>;
  listByRun(runId: string): Promise<ReadonlyArray<LedgerItem>>;
  listByJob(jobId: string): Promise<ReadonlyArray<LedgerItem>>;
  listByDocument(documentId: string): Promise<ReadonlyArray<LedgerItem>>;
  listByComponentType(componentType: ComponentType): Promise<ReadonlyArray<LedgerItem>>;
}

export interface EvaluationResultRepository {
  put(evaluationResult: EvaluationResult): Promise<void>;
  listByRun(runId: string): Promise<ReadonlyArray<EvaluationResult>>;
}

export interface ReviewDecisionRepository {
  put(reviewDecision: ReviewDecision): Promise<void>;
  listByJob(jobId: string): Promise<ReadonlyArray<ReviewDecision>>;
}

export interface PriceBookRepository {
  put(priceBook: PriceBook): Promise<void>;
  get(priceBookVersion: string): Promise<PriceBook | undefined>;
  getActive(): Promise<PriceBook | undefined>;
}

export interface AppSettingRepository {
  put(appSetting: AppSetting): Promise<void>;
  get(settingKey: AppSetting["settingKey"]): Promise<AppSetting | undefined>;
}
