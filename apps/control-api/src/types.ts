import type {
  ApiError,
  AppSetting,
  Artifact,
  Document,
  EvaluationResult,
  LedgerItem,
  PriceBook,
  ReviewDecision,
  Run,
  StageEvent,
  TranslationJob,
  WorkflowVariant
} from "@agentcore-pdf-translator/schemas";
import type { JobEconomicsRollup } from "@agentcore-pdf-translator/costing";
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
  TranslationJobRepository,
  EntityIdPrefix
} from "@agentcore-pdf-translator/data";

export type HttpMethod = "GET" | "POST" | "PUT";

export type ApiRequest = {
  readonly method: HttpMethod;
  readonly path: string;
  readonly workspaceId?: string;
  readonly query?: Readonly<Record<string, string | undefined>>;
  readonly body?: unknown;
};

export type ApiResponse<TBody = unknown> = {
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: TBody;
};

export type ApiFailureResponse = ApiResponse<ApiError>;

export type ControlApiRepositories = {
  readonly documents: DocumentRepository;
  readonly jobs: TranslationJobRepository;
  readonly runs: RunRepository;
  readonly stageEvents: StageEventRepository;
  readonly artifacts: ArtifactRepository;
  readonly ledgerItems: LedgerItemRepository;
  readonly evaluations: EvaluationResultRepository;
  readonly reviewDecisions: ReviewDecisionRepository;
  readonly priceBooks: PriceBookRepository;
  readonly appSettings: AppSettingRepository;
};

export type RunExecutionRequest = {
  readonly workspaceId: string;
  readonly documentId: string;
  readonly jobId: string;
  readonly runId: string;
};

export interface AgentRuntimeClient {
  invoke(request: RunExecutionRequest): Promise<void>;
}

export type ControlApiContext = {
  readonly workspaceId: string;
  readonly repositories: ControlApiRepositories;
  readonly agentRuntimeClient: AgentRuntimeClient;
  readonly now: () => string;
  readonly createId: (prefix: EntityIdPrefix) => string;
};

export type DocumentListResponse = {
  readonly documents: ReadonlyArray<Document>;
};

export type DocumentJobsResponse = {
  readonly document: Document;
  readonly jobs: ReadonlyArray<TranslationJob>;
};

export type JobListResponse = {
  readonly jobs: ReadonlyArray<TranslationJob>;
};

export type JobRunsResponse = {
  readonly job: TranslationJob;
  readonly runs: ReadonlyArray<Run>;
};

export type LedgerResponse = {
  readonly ledgerItems: ReadonlyArray<LedgerItem>;
};

export type RunTimelineResponse = {
  readonly run: Run;
  readonly stageEvents: ReadonlyArray<StageEvent>;
};

export type RunArtifactsResponse = {
  readonly run: Run;
  readonly artifacts: ReadonlyArray<Artifact>;
};

export type RunEvaluationResponse = {
  readonly run: Run;
  readonly evaluation: EvaluationResult | null;
};

export type ComparisonJobSummary = {
  readonly job: TranslationJob;
  readonly economics: JobEconomicsRollup;
};

export type ComparisonResponse = {
  readonly comparisonGroupId: string;
  readonly jobs: ReadonlyArray<ComparisonJobSummary>;
};

export type CurrentPriceBookResponse = {
  readonly priceBook: PriceBook;
  readonly setting: AppSetting;
};

export type CreatedJobResponse = {
  readonly job: TranslationJob;
};

export type CreatedRunResponse = {
  readonly run: Run;
};

export type ReviewRunResponse = {
  readonly run: Run;
  readonly job: TranslationJob;
  readonly reviewDecision: ReviewDecision;
  readonly stageEvent: StageEvent;
  readonly ledgerItem: LedgerItem;
};

export type WorkflowOptionsForVariant = {
  readonly enableImageTranslation: boolean;
  readonly enablePolicyChecks: boolean;
  readonly enableMemory: boolean;
  readonly preserveLayout: "APPROXIMATE";
};

export function workflowOptionsForVariant(
  workflowVariant: WorkflowVariant,
  options: Omit<WorkflowOptionsForVariant, "enableImageTranslation">
): WorkflowOptionsForVariant {
  return {
    ...options,
    enableImageTranslation: workflowVariant !== "V1_TEXT_ONLY"
  };
}
