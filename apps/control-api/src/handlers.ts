import {
  assertJobTransition,
  assertRunTransition,
  canCreateJobForDocumentStatus
} from "@agentcore-pdf-translator/data";
import {
  createHumanReviewLedgerItem,
  rollupJobEconomics,
  rollupRunCost
} from "@agentcore-pdf-translator/costing";
import {
  CompareQuerySchema,
  CreateTranslationJobRequestSchema,
  PutCurrentPriceBookRequestSchema,
  ReviewRunRequestSchema,
  StartRunRequestSchema,
  type AppSetting,
  type Artifact,
  type Document,
  type EvaluationResult,
  type JobStatus,
  type LedgerItem,
  type PriceBook,
  type ReviewDecision,
  type ReviewDecisionValue,
  type Run,
  type RunStatus,
  type StageEvent,
  type TranslationJob
} from "@agentcore-pdf-translator/schemas";
import {
  ControlApiError,
  jsonResponse,
  validationError
} from "./errors.js";
import type {
  ApiResponse,
  ComparisonResponse,
  ControlApiContext,
  CreatedJobResponse,
  CreatedRunResponse,
  CurrentPriceBookResponse,
  DocumentJobsResponse,
  DocumentListResponse,
  JobListResponse,
  JobRunsResponse,
  LedgerResponse,
  ReviewRunResponse,
  RunArtifactsResponse,
  RunEvaluationResponse,
  RunTimelineResponse
} from "./types.js";
import { workflowOptionsForVariant } from "./types.js";

const activeRunStatuses = new Set<RunStatus>(["QUEUED", "RUNNING", "EVALUATING"]);
const terminalJobStatuses = new Set<JobStatus>(["ACCEPTED", "REJECTED", "ESCALATED", "FAILED"]);

function validationIssues(error: { readonly issues: unknown }): Readonly<Record<string, unknown>> {
  return { issues: error.issues };
}

function parseCreateJobRequest(body: unknown): ReturnType<typeof CreateTranslationJobRequestSchema.parse> {
  const parsed = CreateTranslationJobRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError("Invalid create job request", validationIssues(parsed.error));
  }

  if (parsed.data.comparisonGroupId !== undefined && parsed.data.createComparisonGroup === true) {
    throw validationError("Provide either comparisonGroupId or createComparisonGroup, not both");
  }

  return parsed.data;
}

function parseStartRunRequest(body: unknown): ReturnType<typeof StartRunRequestSchema.parse> {
  const parsed = StartRunRequestSchema.safeParse(body === undefined ? {} : body);
  if (!parsed.success) {
    throw validationError("Invalid start run request", validationIssues(parsed.error));
  }

  return parsed.data;
}

function parseReviewRunRequest(body: unknown): ReturnType<typeof ReviewRunRequestSchema.parse> {
  const parsed = ReviewRunRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError("Invalid review request", validationIssues(parsed.error));
  }

  return parsed.data;
}

function parsePutCurrentPriceBookRequest(
  body: unknown
): ReturnType<typeof PutCurrentPriceBookRequestSchema.parse> {
  const parsed = PutCurrentPriceBookRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError("Invalid price book request", validationIssues(parsed.error));
  }

  return parsed.data;
}

async function getDocumentOrThrow(context: ControlApiContext, documentId: string): Promise<Document> {
  const document = await context.repositories.documents.get(documentId);
  if (document === undefined || document.workspaceId !== context.workspaceId) {
    throw new ControlApiError("DOCUMENT_NOT_FOUND", `Document ${documentId} was not found`);
  }

  return document;
}

async function getJobOrThrow(context: ControlApiContext, jobId: string): Promise<TranslationJob> {
  const job = await context.repositories.jobs.get(jobId);
  if (job === undefined || job.workspaceId !== context.workspaceId) {
    throw new ControlApiError("JOB_NOT_FOUND", `Job ${jobId} was not found`);
  }

  return job;
}

async function getRunOrThrow(context: ControlApiContext, runId: string): Promise<Run> {
  const run = await context.repositories.runs.get(runId);
  if (run === undefined || run.workspaceId !== context.workspaceId) {
    throw new ControlApiError("RUN_NOT_FOUND", `Run ${runId} was not found`);
  }

  return run;
}

async function getCurrentPriceBookOrThrow(
  context: ControlApiContext
): Promise<{ readonly priceBook: PriceBook; readonly setting: AppSetting }> {
  const setting = await context.repositories.appSettings.get("ACTIVE_PRICE_BOOK_VERSION");
  if (setting === undefined) {
    throw new ControlApiError("PRICE_BOOK_NOT_FOUND", "Active price book setting was not found");
  }

  const priceBook = await context.repositories.priceBooks.get(setting.settingValue);
  if (priceBook === undefined) {
    throw new ControlApiError("PRICE_BOOK_NOT_FOUND", "Active price book was not found", {
      priceBookVersion: setting.settingValue
    });
  }

  return { priceBook, setting };
}

async function getPriceBookByVersionOrThrow(
  context: ControlApiContext,
  priceBookVersion: string
): Promise<PriceBook> {
  const priceBook = await context.repositories.priceBooks.get(priceBookVersion);
  if (priceBook === undefined) {
    throw new ControlApiError("PRICE_BOOK_NOT_FOUND", "Price book was not found", {
      priceBookVersion
    });
  }

  return priceBook;
}

function requireActivePriceBook(priceBook: PriceBook): void {
  if (priceBook.status !== "ACTIVE") {
    throw validationError("Current price book must have ACTIVE status", {
      priceBookVersion: priceBook.priceBookVersion,
      status: priceBook.status
    });
  }
}

function decisionToStatus(decision: ReviewDecisionValue): "ACCEPTED" | "REJECTED" | "ESCALATED" {
  return decision;
}

function withoutAcceptedEconomics(job: TranslationJob): Omit<
  TranslationJob,
  "acceptedRunId" | "costPerVerifiedOutcomeUsd" | "unitMarginUsd"
> {
  const {
    acceptedRunId: _acceptedRunId,
    costPerVerifiedOutcomeUsd: _costPerVerifiedOutcomeUsd,
    unitMarginUsd: _unitMarginUsd,
    ...jobWithoutAcceptedEconomics
  } = job;
  return jobWithoutAcceptedEconomics;
}

function nextStageSequence(stageEvents: ReadonlyArray<StageEvent>): number {
  return stageEvents.reduce((max, stageEvent) => Math.max(max, stageEvent.sequence), 0) + 1;
}

function latestEvaluation(evaluations: ReadonlyArray<EvaluationResult>): EvaluationResult | null {
  return [...evaluations].sort((left, right) => left.createdAt.localeCompare(right.createdAt)).at(-1) ?? null;
}

function removeDuplicateArtifacts(artifacts: ReadonlyArray<Artifact>): ReadonlyArray<Artifact> {
  const byId = new Map<string, Artifact>();
  for (const artifact of artifacts) {
    byId.set(artifact.artifactId, artifact);
  }

  return [...byId.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function notImplemented(deferredUntil: string): ApiResponse {
  throw new ControlApiError("NOT_IMPLEMENTED", "This endpoint is deferred for a later implementation slice", {
    deferredUntil
  });
}

export async function listDocuments(context: ControlApiContext): Promise<ApiResponse<DocumentListResponse>> {
  const documents = await context.repositories.documents.listByWorkspace(context.workspaceId);
  return jsonResponse(200, { documents });
}

export async function getDocument(
  context: ControlApiContext,
  documentId: string
): Promise<ApiResponse<Document>> {
  return jsonResponse(200, await getDocumentOrThrow(context, documentId));
}

export async function getDocumentJobs(
  context: ControlApiContext,
  documentId: string
): Promise<ApiResponse<DocumentJobsResponse>> {
  const document = await getDocumentOrThrow(context, documentId);
  const jobs = (await context.repositories.jobs.listByDocument(document.documentId)).filter(
    (job) => job.workspaceId === context.workspaceId
  );

  return jsonResponse(200, { document, jobs });
}

export async function createJob(
  context: ControlApiContext,
  documentId: string,
  body: unknown
): Promise<ApiResponse<CreatedJobResponse>> {
  const request = parseCreateJobRequest(body);
  const document = await getDocumentOrThrow(context, documentId);
  if (!canCreateJobForDocumentStatus(document.status)) {
    throw new ControlApiError("DOCUMENT_UNSUPPORTED", "Document is not ready for job creation", {
      documentStatus: document.status
    });
  }

  const { priceBook } = await getCurrentPriceBookOrThrow(context);
  requireActivePriceBook(priceBook);

  const comparisonGroupId = await resolveComparisonGroupId(
    context,
    document,
    request.comparisonGroupId,
    request.createComparisonGroup
  );
  const now = context.now();
  const job: TranslationJob = {
    workspaceId: context.workspaceId,
    jobId: context.createId("job"),
    documentId: document.documentId,
    ...(comparisonGroupId === undefined ? {} : { comparisonGroupId }),
    workflowVariant: request.workflowVariant,
    status: "CREATED",
    sourceLanguage: document.sourceLanguage,
    targetLanguage: document.targetLanguage,
    valueModel: request.valueModel,
    options: workflowOptionsForVariant(request.workflowVariant, request.options),
    priceBookVersion: priceBook.priceBookVersion,
    totalAttemptCount: 0,
    llmOnlyCostUsd: 0,
    fullWorkflowCostUsd: 0,
    unitValueUsd: request.valueModel.valuePerAcceptedPdfUsd,
    costBasis: "TELEMETRY_DERIVED_PRICE_BOOK_ESTIMATE",
    createdAt: now,
    updatedAt: now
  };

  await context.repositories.jobs.put(job);

  return jsonResponse(201, { job });
}

async function resolveComparisonGroupId(
  context: ControlApiContext,
  document: Document,
  comparisonGroupId: string | undefined,
  createComparisonGroup: boolean | undefined
): Promise<string | undefined> {
  if (comparisonGroupId !== undefined) {
    const existingJobs = await context.repositories.jobs.listByComparisonGroup(comparisonGroupId);
    if (existingJobs.length === 0) {
      throw validationError("comparisonGroupId does not reference an existing comparison group", {
        comparisonGroupId
      });
    }

    const invalidJob = existingJobs.find(
      (job) => job.workspaceId !== context.workspaceId || job.documentId !== document.documentId
    );
    if (invalidJob !== undefined) {
      throw validationError("comparisonGroupId must belong to the same workspace and document", {
        comparisonGroupId
      });
    }

    return comparisonGroupId;
  }

  return createComparisonGroup === true ? context.createId("cmp") : undefined;
}

export async function listJobs(context: ControlApiContext): Promise<ApiResponse<JobListResponse>> {
  const statuses: ReadonlyArray<JobStatus> = [
    "CREATED",
    "RUNNING",
    "AWAITING_REVIEW",
    "ACCEPTED",
    "REJECTED",
    "ESCALATED",
    "FAILED"
  ];
  const jobs = (await Promise.all(statuses.map((status) => context.repositories.jobs.listByStatus(status))))
    .flat()
    .filter((job) => job.workspaceId === context.workspaceId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  return jsonResponse(200, { jobs });
}

export async function getJob(context: ControlApiContext, jobId: string): Promise<ApiResponse<TranslationJob>> {
  return jsonResponse(200, await getJobOrThrow(context, jobId));
}

export async function getJobRuns(
  context: ControlApiContext,
  jobId: string
): Promise<ApiResponse<JobRunsResponse>> {
  const job = await getJobOrThrow(context, jobId);
  const runs = (await context.repositories.runs.listByJob(job.jobId)).filter(
    (run) => run.workspaceId === context.workspaceId
  );

  return jsonResponse(200, { job, runs });
}

export async function getJobLedger(
  context: ControlApiContext,
  jobId: string
): Promise<ApiResponse<LedgerResponse>> {
  const job = await getJobOrThrow(context, jobId);
  const ledgerItems = (await context.repositories.ledgerItems.listByJob(job.jobId)).filter(
    (ledgerItem) => ledgerItem.workspaceId === context.workspaceId
  );

  return jsonResponse(200, { ledgerItems });
}

export async function getJobEconomics(context: ControlApiContext, jobId: string): Promise<ApiResponse> {
  const job = await getJobOrThrow(context, jobId);
  const runs = (await context.repositories.runs.listByJob(job.jobId)).filter(
    (run) => run.workspaceId === context.workspaceId
  );
  const ledgerItems = (await context.repositories.ledgerItems.listByJob(job.jobId)).filter(
    (ledgerItem) => ledgerItem.workspaceId === context.workspaceId
  );

  return jsonResponse(200, {
    job,
    economics: rollupJobEconomics({ job, runs, ledgerItems })
  });
}

export async function startRun(
  context: ControlApiContext,
  jobId: string,
  body: unknown
): Promise<ApiResponse<CreatedRunResponse>> {
  parseStartRunRequest(body);
  const job = await getJobOrThrow(context, jobId);
  if (terminalJobStatuses.has(job.status) || job.status === "AWAITING_REVIEW") {
    throw new ControlApiError("JOB_ALREADY_RUNNING", "Job cannot start a new run from its current state", {
      jobStatus: job.status
    });
  }

  const document = await getDocumentOrThrow(context, job.documentId);
  if (!canCreateJobForDocumentStatus(document.status)) {
    throw new ControlApiError("DOCUMENT_UNSUPPORTED", "Document is not ready for run creation", {
      documentStatus: document.status
    });
  }

  const existingRuns = (await context.repositories.runs.listByJob(job.jobId)).filter(
    (run) => run.workspaceId === context.workspaceId
  );
  const openRun = existingRuns.find(
    (run) => activeRunStatuses.has(run.status) || run.status === "AWAITING_REVIEW"
  );
  if (openRun !== undefined) {
    throw new ControlApiError("JOB_ALREADY_RUNNING", "Job already has an active or reviewable run", {
      runId: openRun.runId,
      runStatus: openRun.status
    });
  }

  const now = context.now();
  const attemptNumber =
    Math.max(job.totalAttemptCount, ...existingRuns.map((run) => run.attemptNumber), 0) + 1;
  const run: Run = {
    workspaceId: context.workspaceId,
    runId: context.createId("run"),
    jobId: job.jobId,
    documentId: document.documentId,
    attemptNumber,
    workflowVariant: job.workflowVariant,
    status: "QUEUED",
    sourceLanguage: job.sourceLanguage,
    targetLanguage: job.targetLanguage,
    sourcePdfArtifactId: document.sourcePdfArtifactId,
    llmOnlyCostUsd: 0,
    fullWorkflowCostUsd: 0,
    humanReviewCostUsd: 0,
    retryCostUsd: 0,
    remediationCostUsd: 0,
    warnings: [],
    createdAt: now,
    updatedAt: now
  };
  const runningJob = markJobRunning(job, run.runId, attemptNumber, now);

  await context.repositories.runs.put(run);
  await context.repositories.jobs.put(runningJob);

  try {
    await context.agentRuntimeClient.invoke({
      workspaceId: context.workspaceId,
      documentId: document.documentId,
      jobId: job.jobId,
      runId: run.runId
    });
  } catch (error) {
    const failedAt = context.now();
    const failedRun: Run = {
      ...run,
      status: "FAILED",
      failureReason: error instanceof Error ? error.message : "Agent invocation failed",
      completedAt: failedAt,
      updatedAt: failedAt
    };
    const failedJob = {
      ...runningJob,
      status: "FAILED" as const,
      updatedAt: failedAt
    };
    assertRunTransition(run.status, failedRun.status);
    assertJobTransition(runningJob.status, failedJob.status);
    await context.repositories.runs.put(failedRun);
    await context.repositories.jobs.put(failedJob);
    throw new ControlApiError("AGENT_INVOCATION_FAILED", "Agent runtime invocation failed", {
      runId: failedRun.runId,
      jobId: failedJob.jobId
    });
  }

  return jsonResponse(201, { run });
}

function markJobRunning(
  job: TranslationJob,
  runId: string,
  totalAttemptCount: number,
  updatedAt: string
): TranslationJob {
  if (job.status === "CREATED") {
    assertJobTransition(job.status, "RUNNING");
  }

  return {
    ...job,
    status: "RUNNING",
    latestRunId: runId,
    totalAttemptCount,
    updatedAt
  };
}

export async function getRun(context: ControlApiContext, runId: string): Promise<ApiResponse<Run>> {
  return jsonResponse(200, await getRunOrThrow(context, runId));
}

export async function getRunTimeline(
  context: ControlApiContext,
  runId: string
): Promise<ApiResponse<RunTimelineResponse>> {
  const run = await getRunOrThrow(context, runId);
  const stageEvents = (await context.repositories.stageEvents.listByRun(run.runId)).filter(
    (stageEvent) => stageEvent.workspaceId === context.workspaceId
  );

  return jsonResponse(200, { run, stageEvents });
}

export async function getRunArtifacts(
  context: ControlApiContext,
  runId: string
): Promise<ApiResponse<RunArtifactsResponse>> {
  const run = await getRunOrThrow(context, runId);
  const sourceArtifact = await context.repositories.artifacts.get(run.sourcePdfArtifactId);
  const runArtifacts = (await context.repositories.artifacts.listByRun(run.runId)).filter(
    (artifact) => artifact.workspaceId === context.workspaceId
  );
  const artifacts =
    sourceArtifact !== undefined && sourceArtifact.workspaceId === context.workspaceId
      ? removeDuplicateArtifacts([sourceArtifact, ...runArtifacts])
      : runArtifacts;

  return jsonResponse(200, { run, artifacts });
}

export async function getRunEvaluation(
  context: ControlApiContext,
  runId: string
): Promise<ApiResponse<RunEvaluationResponse>> {
  const run = await getRunOrThrow(context, runId);
  const evaluation = latestEvaluation(
    (await context.repositories.evaluations.listByRun(run.runId)).filter(
      (candidate) => candidate.workspaceId === context.workspaceId
    )
  );

  return jsonResponse(200, { run, evaluation });
}

export async function getRunLedger(
  context: ControlApiContext,
  runId: string
): Promise<ApiResponse<LedgerResponse>> {
  const run = await getRunOrThrow(context, runId);
  const ledgerItems = (await context.repositories.ledgerItems.listByRun(run.runId)).filter(
    (ledgerItem) => ledgerItem.workspaceId === context.workspaceId
  );

  return jsonResponse(200, { ledgerItems });
}

export async function reviewRun(
  context: ControlApiContext,
  runId: string,
  body: unknown
): Promise<ApiResponse<ReviewRunResponse>> {
  const request = parseReviewRunRequest(body);
  const run = await getRunOrThrow(context, runId);
  const job = await getJobOrThrow(context, run.jobId);
  if (
    run.status !== "AWAITING_REVIEW" ||
    job.status !== "AWAITING_REVIEW" ||
    job.latestRunId !== run.runId
  ) {
    throw new ControlApiError("RUN_NOT_REVIEWABLE", "Run is not reviewable", {
      runStatus: run.status,
      jobStatus: job.status,
      latestRunId: job.latestRunId
    });
  }

  const existingDecisions = await context.repositories.reviewDecisions.listByJob(job.jobId);
  if (existingDecisions.some((decision) => decision.runId === run.runId)) {
    throw new ControlApiError("RUN_NOT_REVIEWABLE", "Run already has a review decision", {
      runId: run.runId
    });
  }

  const evaluation = latestEvaluation(
    (await context.repositories.evaluations.listByRun(run.runId)).filter(
      (candidate) => candidate.workspaceId === context.workspaceId
    )
  );
  if (evaluation === null) {
    throw new ControlApiError("RUN_NOT_REVIEWABLE", "Run has no evaluation evidence", {
      runId: run.runId
    });
  }

  const priceBook = await getPriceBookByVersionOrThrow(context, job.priceBookVersion);
  const now = context.now();
  const stageEvents = await context.repositories.stageEvents.listByRun(run.runId);
  const sequence = nextStageSequence(stageEvents);
  const stageEvent: StageEvent = {
    workspaceId: context.workspaceId,
    runId: run.runId,
    jobId: job.jobId,
    documentId: job.documentId,
    stageEventId: context.createId("stg"),
    sequence,
    stageName: "reviewer_decision",
    status: "SUCCEEDED",
    inputArtifactIds: run.translatedPdfArtifactId === undefined ? [] : [run.translatedPdfArtifactId],
    outputArtifactIds: [],
    retryCount: 0,
    durationMs: 0,
    startedAt: now,
    completedAt: now,
    warnings: []
  };
  const pendingReviewLedgerItem = createHumanReviewLedgerItem(priceBook, {
    workspaceId: context.workspaceId,
    runId: run.runId,
    jobId: job.jobId,
    documentId: job.documentId,
    workflowVariant: job.workflowVariant,
    stageName: "reviewer_decision",
    stageSequence: sequence,
    priceBookVersion: job.priceBookVersion,
    reviewerSeconds: request.reviewerSeconds,
    hourlyRateUsd: job.valueModel.humanReviewHourlyRateUsd,
    createdAt: now
  });
  const ledgerItem: LedgerItem = {
    ...pendingReviewLedgerItem,
    ledgerItemId: context.createId("led")
  };
  const reviewDecision: ReviewDecision = {
    workspaceId: context.workspaceId,
    reviewDecisionId: context.createId("rev"),
    jobId: job.jobId,
    runId: run.runId,
    documentId: job.documentId,
    decision: request.decision,
    reviewerSeconds: request.reviewerSeconds,
    humanReviewHourlyRateUsd: job.valueModel.humanReviewHourlyRateUsd,
    estimatedReviewCostUsd: ledgerItem.estimatedCostUsd,
    ...(request.reason === undefined ? {} : { reason: request.reason }),
    createdAt: now
  };
  const nextStatus = decisionToStatus(request.decision);
  assertRunTransition(run.status, nextStatus);
  assertJobTransition(job.status, nextStatus);

  await context.repositories.stageEvents.put(stageEvent);
  await context.repositories.reviewDecisions.put(reviewDecision);
  await context.repositories.ledgerItems.put(ledgerItem);

  const runLedgerItems = await context.repositories.ledgerItems.listByRun(run.runId);
  const runRollup = rollupRunCost(run.runId, runLedgerItems);
  const updatedRun: Run = {
    ...run,
    status: nextStatus,
    llmOnlyCostUsd: runRollup.llmOnlyCostUsd,
    fullWorkflowCostUsd: runRollup.fullWorkflowCostUsd,
    humanReviewCostUsd: runRollup.humanReviewCostUsd,
    retryCostUsd: runRollup.retryCostUsd,
    remediationCostUsd: runRollup.remediationCostUsd,
    completedAt: now,
    updatedAt: now
  };
  await context.repositories.runs.put(updatedRun);

  const jobBase = withoutAcceptedEconomics(job);
  const jobForRollup: TranslationJob = {
    ...jobBase,
    status: nextStatus,
    latestRunId: updatedRun.runId,
    ...(nextStatus === "ACCEPTED" ? { acceptedRunId: updatedRun.runId } : {}),
    updatedAt: now
  };
  const runs = (await context.repositories.runs.listByJob(job.jobId)).filter(
    (candidate) => candidate.workspaceId === context.workspaceId
  );
  const jobLedgerItems = (await context.repositories.ledgerItems.listByJob(job.jobId)).filter(
    (candidate) => candidate.workspaceId === context.workspaceId
  );
  const jobRollup = rollupJobEconomics({ job: jobForRollup, runs, ledgerItems: jobLedgerItems });
  const updatedJob: TranslationJob = {
    ...jobForRollup,
    llmOnlyCostUsd: jobRollup.llmOnlyCostUsd,
    fullWorkflowCostUsd: jobRollup.fullWorkflowCostUsd,
    ...(jobRollup.costPerVerifiedOutcomeUsd === null
      ? {}
      : { costPerVerifiedOutcomeUsd: jobRollup.costPerVerifiedOutcomeUsd }),
    unitValueUsd: jobRollup.unitValueUsd,
    ...(jobRollup.unitMarginUsd === null ? {} : { unitMarginUsd: jobRollup.unitMarginUsd })
  };
  await context.repositories.jobs.put(updatedJob);

  return jsonResponse(200, {
    run: updatedRun,
    job: updatedJob,
    reviewDecision,
    stageEvent,
    ledgerItem
  });
}

export async function getComparison(context: ControlApiContext, query: unknown): Promise<ApiResponse<ComparisonResponse>> {
  const parsed = CompareQuerySchema.safeParse(query);
  if (!parsed.success) {
    throw validationError("Invalid comparison query", validationIssues(parsed.error));
  }

  const jobs = (await context.repositories.jobs.listByComparisonGroup(parsed.data.comparisonGroupId)).filter(
    (job) => job.workspaceId === context.workspaceId
  );
  const summaries = await Promise.all(
    jobs.map(async (job) => {
      const runs = (await context.repositories.runs.listByJob(job.jobId)).filter(
        (run) => run.workspaceId === context.workspaceId
      );
      const ledgerItems = (await context.repositories.ledgerItems.listByJob(job.jobId)).filter(
        (ledgerItem) => ledgerItem.workspaceId === context.workspaceId
      );
      return {
        job,
        economics: rollupJobEconomics({ job, runs, ledgerItems })
      };
    })
  );

  return jsonResponse(200, {
    comparisonGroupId: parsed.data.comparisonGroupId,
    jobs: summaries
  });
}

export async function getCurrentPriceBook(
  context: ControlApiContext
): Promise<ApiResponse<CurrentPriceBookResponse>> {
  return jsonResponse(200, await getCurrentPriceBookOrThrow(context));
}

export async function putCurrentPriceBook(
  context: ControlApiContext,
  body: unknown
): Promise<ApiResponse<CurrentPriceBookResponse>> {
  const request = parsePutCurrentPriceBookRequest(body);
  const now = context.now();

  if ("priceBook" in request) {
    requireActivePriceBook(request.priceBook);
    await context.repositories.priceBooks.put(request.priceBook);
    const setting: AppSetting = {
      settingKey: "ACTIVE_PRICE_BOOK_VERSION",
      settingValue: request.priceBook.priceBookVersion,
      updatedAt: now
    };
    await context.repositories.appSettings.put(setting);
    return jsonResponse(200, { priceBook: request.priceBook, setting });
  }

  const priceBook = await context.repositories.priceBooks.get(request.priceBookVersion);
  if (priceBook === undefined) {
    throw new ControlApiError("PRICE_BOOK_NOT_FOUND", "Price book was not found", {
      priceBookVersion: request.priceBookVersion
    });
  }
  requireActivePriceBook(priceBook);

  const setting: AppSetting = {
    settingKey: "ACTIVE_PRICE_BOOK_VERSION",
    settingValue: request.priceBookVersion,
    updatedAt: now
  };
  await context.repositories.appSettings.put(setting);

  return jsonResponse(200, { priceBook, setting });
}

export function deferredPresign(): ApiResponse {
  return notImplemented("PR-007/PR-008 storage and S3 repositories");
}

export function deferredCreateDocument(): ApiResponse {
  return notImplemented("PR-007/PR-008 storage and persistent Control API");
}

export function deferredInspectDocument(): ApiResponse {
  return notImplemented("PR-012 real V1 PDF workflow");
}
