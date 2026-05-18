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

function sortByCreatedAt<T extends { readonly createdAt: string }>(items: ReadonlyArray<T>): ReadonlyArray<T> {
  return [...items].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export class InMemoryDocumentRepository implements DocumentRepository {
  private readonly documents = new Map<string, Document>();

  public async put(document: Document): Promise<void> {
    this.documents.set(document.documentId, document);
  }

  public async get(documentId: string): Promise<Document | undefined> {
    return this.documents.get(documentId);
  }

  public async listByWorkspace(workspaceId: string): Promise<ReadonlyArray<Document>> {
    return sortByCreatedAt(
      [...this.documents.values()].filter((document) => document.workspaceId === workspaceId)
    );
  }
}

export class InMemoryTranslationJobRepository implements TranslationJobRepository {
  private readonly jobs = new Map<string, TranslationJob>();

  public async put(job: TranslationJob): Promise<void> {
    this.jobs.set(job.jobId, job);
  }

  public async get(jobId: string): Promise<TranslationJob | undefined> {
    return this.jobs.get(jobId);
  }

  public async listByDocument(documentId: string): Promise<ReadonlyArray<TranslationJob>> {
    return sortByCreatedAt([...this.jobs.values()].filter((job) => job.documentId === documentId));
  }

  public async listByComparisonGroup(comparisonGroupId: string): Promise<ReadonlyArray<TranslationJob>> {
    return sortByCreatedAt(
      [...this.jobs.values()].filter((job) => job.comparisonGroupId === comparisonGroupId)
    );
  }

  public async listByStatus(status: JobStatus): Promise<ReadonlyArray<TranslationJob>> {
    return sortByCreatedAt([...this.jobs.values()].filter((job) => job.status === status));
  }
}

export class InMemoryRunRepository implements RunRepository {
  private readonly runs = new Map<string, Run>();

  public async put(run: Run): Promise<void> {
    this.runs.set(run.runId, run);
  }

  public async get(runId: string): Promise<Run | undefined> {
    return this.runs.get(runId);
  }

  public async listByJob(jobId: string): Promise<ReadonlyArray<Run>> {
    return [...this.runs.values()]
      .filter((run) => run.jobId === jobId)
      .sort((left, right) => left.attemptNumber - right.attemptNumber);
  }

  public async listByDocument(documentId: string): Promise<ReadonlyArray<Run>> {
    return sortByCreatedAt([...this.runs.values()].filter((run) => run.documentId === documentId));
  }

  public async listByStatus(status: RunStatus): Promise<ReadonlyArray<Run>> {
    return sortByCreatedAt([...this.runs.values()].filter((run) => run.status === status));
  }
}

export class InMemoryStageEventRepository implements StageEventRepository {
  private readonly stageEventsByRun = new Map<string, StageEvent[]>();

  public async put(stageEvent: StageEvent): Promise<void> {
    const existing = this.stageEventsByRun.get(stageEvent.runId) ?? [];
    const withoutDuplicate = existing.filter((candidate) => candidate.stageEventId !== stageEvent.stageEventId);
    this.stageEventsByRun.set(stageEvent.runId, [...withoutDuplicate, stageEvent]);
  }

  public async listByRun(runId: string): Promise<ReadonlyArray<StageEvent>> {
    return [...(this.stageEventsByRun.get(runId) ?? [])].sort(
      (left, right) => left.sequence - right.sequence
    );
  }
}

export class InMemoryArtifactRepository implements ArtifactRepository {
  private readonly artifacts = new Map<string, Artifact>();

  public async put(artifact: Artifact): Promise<void> {
    this.artifacts.set(artifact.artifactId, artifact);
  }

  public async get(artifactId: string): Promise<Artifact | undefined> {
    return this.artifacts.get(artifactId);
  }

  public async listByRun(runId: string): Promise<ReadonlyArray<Artifact>> {
    return sortByCreatedAt([...this.artifacts.values()].filter((artifact) => artifact.runId === runId));
  }

  public async listByDocument(documentId: string): Promise<ReadonlyArray<Artifact>> {
    return sortByCreatedAt(
      [...this.artifacts.values()].filter((artifact) => artifact.documentId === documentId)
    );
  }

  public async listByJob(jobId: string): Promise<ReadonlyArray<Artifact>> {
    return sortByCreatedAt([...this.artifacts.values()].filter((artifact) => artifact.jobId === jobId));
  }
}

export class InMemoryLedgerItemRepository implements LedgerItemRepository {
  private readonly ledgerItemsByRun = new Map<string, LedgerItem[]>();

  public async put(ledgerItem: LedgerItem): Promise<void> {
    const existing = this.ledgerItemsByRun.get(ledgerItem.runId) ?? [];
    const withoutDuplicate = existing.filter(
      (candidate) => candidate.ledgerItemId !== ledgerItem.ledgerItemId
    );
    this.ledgerItemsByRun.set(ledgerItem.runId, [...withoutDuplicate, ledgerItem]);
  }

  public async listByRun(runId: string): Promise<ReadonlyArray<LedgerItem>> {
    return sortByCreatedAt(this.ledgerItemsByRun.get(runId) ?? []);
  }

  public async listByJob(jobId: string): Promise<ReadonlyArray<LedgerItem>> {
    return sortByCreatedAt(
      [...this.ledgerItemsByRun.values()].flat().filter((ledgerItem) => ledgerItem.jobId === jobId)
    );
  }

  public async listByDocument(documentId: string): Promise<ReadonlyArray<LedgerItem>> {
    return sortByCreatedAt(
      [...this.ledgerItemsByRun.values()]
        .flat()
        .filter((ledgerItem) => ledgerItem.documentId === documentId)
    );
  }

  public async listByComponentType(componentType: ComponentType): Promise<ReadonlyArray<LedgerItem>> {
    return sortByCreatedAt(
      [...this.ledgerItemsByRun.values()]
        .flat()
        .filter((ledgerItem) => ledgerItem.componentType === componentType)
    );
  }
}

export class InMemoryEvaluationResultRepository implements EvaluationResultRepository {
  private readonly evaluationResultsByRun = new Map<string, EvaluationResult[]>();

  public async put(evaluationResult: EvaluationResult): Promise<void> {
    const existing = this.evaluationResultsByRun.get(evaluationResult.runId) ?? [];
    const withoutDuplicate = existing.filter(
      (candidate) => candidate.evaluationResultId !== evaluationResult.evaluationResultId
    );
    this.evaluationResultsByRun.set(evaluationResult.runId, [...withoutDuplicate, evaluationResult]);
  }

  public async listByRun(runId: string): Promise<ReadonlyArray<EvaluationResult>> {
    return sortByCreatedAt(this.evaluationResultsByRun.get(runId) ?? []);
  }
}

export class InMemoryReviewDecisionRepository implements ReviewDecisionRepository {
  private readonly reviewDecisionsByJob = new Map<string, ReviewDecision[]>();

  public async put(reviewDecision: ReviewDecision): Promise<void> {
    const existing = this.reviewDecisionsByJob.get(reviewDecision.jobId) ?? [];
    const withoutDuplicate = existing.filter(
      (candidate) => candidate.reviewDecisionId !== reviewDecision.reviewDecisionId
    );
    this.reviewDecisionsByJob.set(reviewDecision.jobId, [...withoutDuplicate, reviewDecision]);
  }

  public async listByJob(jobId: string): Promise<ReadonlyArray<ReviewDecision>> {
    return sortByCreatedAt(this.reviewDecisionsByJob.get(jobId) ?? []);
  }
}

export class InMemoryPriceBookRepository implements PriceBookRepository {
  private readonly priceBooks = new Map<string, PriceBook>();

  public async put(priceBook: PriceBook): Promise<void> {
    this.priceBooks.set(priceBook.priceBookVersion, priceBook);
  }

  public async get(priceBookVersion: string): Promise<PriceBook | undefined> {
    return this.priceBooks.get(priceBookVersion);
  }

  public async getActive(): Promise<PriceBook | undefined> {
    return [...this.priceBooks.values()].find((priceBook) => priceBook.status === "ACTIVE");
  }
}

export class InMemoryAppSettingRepository implements AppSettingRepository {
  private readonly appSettings = new Map<AppSetting["settingKey"], AppSetting>();

  public async put(appSetting: AppSetting): Promise<void> {
    this.appSettings.set(appSetting.settingKey, appSetting);
  }

  public async get(settingKey: AppSetting["settingKey"]): Promise<AppSetting | undefined> {
    return this.appSettings.get(settingKey);
  }
}
