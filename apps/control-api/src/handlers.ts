import {
  assertDocumentTransition,
  assertJobTransition,
  assertRunTransition,
  canCreateJobForDocumentStatus,
  sourcePdfKey
} from "@agentcore-pdf-translator/data";
import {
  createHumanReviewLedgerItem,
  rollupJobEconomics,
  rollupRunCost
} from "@agentcore-pdf-translator/costing";
import {
  CompareQuerySchema,
  CreateDocumentRequestSchema,
  DocumentPresignRequestSchema,
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
import { createHash } from "node:crypto";
import {
  conflictError,
  ControlApiError,
  jsonResponse,
  validationError
} from "./errors.js";
import type {
  ArtifactDownloadUrlResponse,
  ApiResponse,
  ComparisonResponse,
  ControlApiContext,
  CreatedDocumentResponse,
  CreatedJobResponse,
  CreatedRunResponse,
  CurrentPriceBookResponse,
  DocumentPresignResponse,
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

const activeRunStatuses = new Set<RunStatus>(["CREATED", "QUEUED", "RUNNING", "EVALUATING"]);
const terminalJobStatuses = new Set<JobStatus>(["ACCEPTED", "REJECTED", "ESCALATED", "FAILED"]);
const sourcePdfContentType = "application/pdf";
const maxListItems = 100;

function validationIssues(error: { readonly issues: unknown }): Readonly<Record<string, unknown>> {
  return { issues: error.issues };
}

function parseDocumentPresignRequest(body: unknown): ReturnType<typeof DocumentPresignRequestSchema.parse> {
  const parsed = DocumentPresignRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError("Invalid document presign request", validationIssues(parsed.error));
  }

  return parsed.data;
}

function parseCreateDocumentRequest(body: unknown): ReturnType<typeof CreateDocumentRequestSchema.parse> {
  const parsed = CreateDocumentRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw validationError("Invalid create document request", validationIssues(parsed.error));
  }

  return parsed.data;
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

  if (priceBook.humanReviewHourlyRateDefaultUsd <= 0) {
    throw validationError("Current price book must use a positive human review hourly rate", {
      priceBookVersion: priceBook.priceBookVersion
    });
  }
}

function validateValueModel(valueModel: TranslationJob["valueModel"]): void {
  if (valueModel.humanReviewHourlyRateUsd <= 0) {
    throw validationError("Job value model must use a positive human review hourly rate");
  }
}

function requireV1WorkflowVariant(workflowVariant: TranslationJob["workflowVariant"]): void {
  if (workflowVariant !== "V1_TEXT_ONLY") {
    throw new ControlApiError(
      "NOT_IMPLEMENTED",
      "Only V1_TEXT_ONLY job creation is enabled in PR-010",
      {
        workflowVariant,
        deferredUntil: workflowVariant === "V2_TEXT_AND_IMAGE_ANNOTATION" ? "PR-014" : "PR-015"
      }
    );
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }

  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function boundedItems<T>(items: ReadonlyArray<T>): ReadonlyArray<T> {
  return items.slice(0, maxListItems);
}

function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function hasPdfMagic(bytes: Uint8Array): boolean {
  return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
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

export async function presignDocumentUpload(
  context: ControlApiContext,
  body: unknown
): Promise<ApiResponse<DocumentPresignResponse>> {
  const request = parseDocumentPresignRequest(body);
  const documentId = context.createId("doc");
  const s3Key = sourcePdfKey({ workspaceId: context.workspaceId, documentId });
  const uploadUrl = await context.artifactObjects.createPresignedPutUrl({
    key: s3Key,
    contentType: request.contentType,
    expiresInSeconds: context.config.sourceUploadExpiresInSeconds,
    context: {
      workspaceId: context.workspaceId,
      documentId
    }
  });

  return jsonResponse(200, {
    documentId,
    s3Key,
    uploadUrl,
    expiresInSeconds: context.config.sourceUploadExpiresInSeconds,
    requiredHeaders: {
      "content-type": sourcePdfContentType
    },
    maxSizeBytes: context.config.maxSourcePdfBytes
  });
}

function objectNotFoundError(documentId: string): ControlApiError {
  return validationError("Uploaded source PDF object was not found or could not be read", {
    documentId
  });
}

export async function createDocument(
  context: ControlApiContext,
  body: unknown
): Promise<ApiResponse<CreatedDocumentResponse>> {
  const request = parseCreateDocumentRequest(body);
  const expectedKey = sourcePdfKey({ workspaceId: context.workspaceId, documentId: request.documentId });
  if (request.s3Key !== expectedKey) {
    throw validationError("Source PDF key does not match the generated document key", {
      expectedKey
    });
  }

  const existingDocument = await context.repositories.documents.get(request.documentId);
  if (existingDocument !== undefined) {
    if (existingDocument.workspaceId !== context.workspaceId) {
      throw new ControlApiError("DOCUMENT_NOT_FOUND", `Document ${request.documentId} was not found`);
    }

    const sourceArtifact = (await context.repositories.artifacts.listByDocument(existingDocument.documentId)).find(
      (artifact) => artifact.workspaceId === context.workspaceId && artifact.artifactType === "SOURCE_PDF"
    );
    if (sourceArtifact === undefined) {
      throw new ControlApiError("INTERNAL_ERROR", "Existing document is missing its source artifact");
    }

    if (
      sourceArtifact.s3Key !== request.s3Key ||
      (request.sha256 !== undefined && existingDocument.sha256 !== request.sha256)
    ) {
      throw conflictError("Document source registration conflicts with the existing source artifact", {
        documentId: existingDocument.documentId
      });
    }

    return jsonResponse(200, { document: existingDocument, sourceArtifact });
  }

  let metadata;
  let bytes;
  try {
    metadata = await context.artifactObjects.getObjectMetadata({
      key: request.s3Key,
      context: { workspaceId: context.workspaceId, documentId: request.documentId }
    });
    bytes = await context.artifactObjects.getObjectBytes({
      key: request.s3Key,
      ...(metadata.versionId === undefined ? {} : { versionId: metadata.versionId }),
      context: { workspaceId: context.workspaceId, documentId: request.documentId }
    });
  } catch {
    throw objectNotFoundError(request.documentId);
  }

  const contentLength = metadata.contentLength ?? bytes.byteLength;
  if (contentLength <= 0 || contentLength > context.config.maxSourcePdfBytes) {
    throw validationError("Uploaded source PDF size is outside the supported PR-010 limit", {
      maxSizeBytes: context.config.maxSourcePdfBytes,
      sizeBytes: contentLength
    });
  }

  if (metadata.contentType !== sourcePdfContentType || request.contentType !== sourcePdfContentType) {
    throw validationError("Uploaded source PDF must use application/pdf content type", {
      contentType: metadata.contentType
    });
  }

  if (!hasPdfMagic(bytes)) {
    throw validationError("Uploaded source object does not look like a PDF");
  }

  const observedSha256 = sha256Hex(bytes);
  if (request.sha256 !== undefined && request.sha256 !== observedSha256) {
    throw validationError("Uploaded source PDF checksum does not match the registration request");
  }

  if (request.sizeBytes !== undefined && request.sizeBytes !== contentLength) {
    throw validationError("Uploaded source PDF size does not match the registration request", {
      expectedSizeBytes: request.sizeBytes,
      observedSizeBytes: contentLength
    });
  }

  const now = context.now();
  const sourceArtifact: Artifact = {
    workspaceId: context.workspaceId,
    artifactId: context.createId("art"),
    documentId: request.documentId,
    artifactType: "SOURCE_PDF",
    s3Bucket: context.config.artifactBucketName,
    s3Key: request.s3Key,
    ...(metadata.versionId === undefined ? {} : { s3VersionId: metadata.versionId }),
    contentType: sourcePdfContentType,
    sizeBytes: contentLength,
    sha256: observedSha256,
    language: "es",
    createdAt: now
  };
  const document: Document = {
    workspaceId: context.workspaceId,
    documentId: request.documentId,
    title: request.title,
    sourceLanguage: "es",
    targetLanguage: "en",
    status: "UPLOADED",
    sourcePdfArtifactId: sourceArtifact.artifactId,
    sourcePdfS3Bucket: context.config.artifactBucketName,
    sourcePdfS3Key: request.s3Key,
    ...(metadata.versionId === undefined ? {} : { sourcePdfS3VersionId: metadata.versionId }),
    fileName: request.fileName,
    fileSizeBytes: contentLength,
    sha256: observedSha256,
    inspectionWarnings: [],
    createdAt: now,
    updatedAt: now
  };

  await context.repositories.artifacts.put(sourceArtifact);
  await context.repositories.documents.put(document);

  return jsonResponse(201, { document, sourceArtifact });
}

export async function inspectDocument(
  context: ControlApiContext,
  documentId: string
): Promise<ApiResponse<Document>> {
  const document = await getDocumentOrThrow(context, documentId);
  if (document.status === "READY" || document.status === "UNSUPPORTED" || document.status === "FAILED_INSPECTION") {
    return jsonResponse(200, document);
  }

  if (document.status === "UPLOADED") {
    assertDocumentTransition(document.status, "INSPECTING");
    await context.repositories.documents.put({
      ...document,
      status: "INSPECTING",
      updatedAt: context.now()
    });
  }

  const current = await getDocumentOrThrow(context, documentId);
  const isControlledFixture = current.sha256 === context.config.controlledFixtureSha256;
  const nextStatus = isControlledFixture ? "READY" : "UNSUPPORTED";
  assertDocumentTransition(current.status, nextStatus);
  const inspected: Document = {
    ...current,
    status: nextStatus,
    ...(isControlledFixture
      ? {
          pageCount: 4,
          textBlockCount: 16,
          imageCount: 1,
          detectedSourceLanguage: "es",
          inspectionWarnings: [
            "PR-010 placeholder readiness based on controlled fixture checksum; real PDF inspection is deferred."
          ]
        }
      : {
          inspectionWarnings: [
            "PR-010 placeholder inspection only supports the controlled MVP fixture; real PDF inspection is deferred."
          ]
        }),
    updatedAt: context.now()
  };
  await context.repositories.documents.put(inspected);

  return jsonResponse(200, inspected);
}

export async function listDocuments(context: ControlApiContext): Promise<ApiResponse<DocumentListResponse>> {
  const documents = await context.repositories.documents.listByWorkspace(context.workspaceId);
  return jsonResponse(200, { documents: boundedItems(documents) });
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

  return jsonResponse(200, { document, jobs: boundedItems(jobs) });
}

export async function createJob(
  context: ControlApiContext,
  documentId: string,
  body: unknown
): Promise<ApiResponse<CreatedJobResponse>> {
  const request = parseCreateJobRequest(body);
  requireV1WorkflowVariant(request.workflowVariant);
  validateValueModel(request.valueModel);
  const document = await getDocumentOrThrow(context, documentId);
  if (!canCreateJobForDocumentStatus(document.status)) {
    throw new ControlApiError("DOCUMENT_UNSUPPORTED", "Document is not ready for job creation", {
      documentStatus: document.status
    });
  }

  const { priceBook } = await getCurrentPriceBookOrThrow(context);
  requireActivePriceBook(priceBook);
  const options = workflowOptionsForVariant(request.workflowVariant, request.options);
  const existingJobs = (await context.repositories.jobs.listByDocument(document.documentId)).filter(
    (job) => job.workspaceId === context.workspaceId && job.workflowVariant === request.workflowVariant
  );
  const existingJob = existingJobs.find(
    (job) =>
      stableJson(job.valueModel) === stableJson(request.valueModel) &&
      stableJson(job.options) === stableJson(options)
  );
  if (existingJob !== undefined) {
    return jsonResponse(200, { job: existingJob });
  }

  if (existingJobs.length > 0) {
    throw conflictError("Document already has a V1 job with a different request fingerprint", {
      documentId: document.documentId,
      workflowVariant: request.workflowVariant
    });
  }

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
    options,
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

  return jsonResponse(200, { jobs: boundedItems(jobs) });
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

  return jsonResponse(200, { job, runs: boundedItems(runs) });
}

export async function getJobLedger(
  context: ControlApiContext,
  jobId: string
): Promise<ApiResponse<LedgerResponse>> {
  const job = await getJobOrThrow(context, jobId);
  const ledgerItems = (await context.repositories.ledgerItems.listByJob(job.jobId)).filter(
    (ledgerItem) => ledgerItem.workspaceId === context.workspaceId
  );

  return jsonResponse(200, { ledgerItems: boundedItems(ledgerItems) });
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
  const request = parseStartRunRequest(body);
  const job = await getJobOrThrow(context, jobId);
  if (job.workflowVariant !== "V1_TEXT_ONLY") {
    throw new ControlApiError(
      "NOT_IMPLEMENTED",
      "Only V1_TEXT_ONLY run execution is enabled in PR-011",
      {
        workflowVariant: job.workflowVariant,
        deferredUntil: job.workflowVariant === "V2_TEXT_AND_IMAGE_ANNOTATION" ? "PR-014" : "PR-015"
      }
    );
  }
  if (terminalJobStatuses.has(job.status)) {
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
    return jsonResponse(200, { run: openRun });
  }

  if (job.status === "AWAITING_REVIEW") {
    throw new ControlApiError("JOB_ALREADY_RUNNING", "Job cannot start a new run from its current state", {
      jobStatus: job.status
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
    status: "CREATED",
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
  const updatedJob: TranslationJob = {
    ...job,
    latestRunId: run.runId,
    totalAttemptCount: attemptNumber,
    updatedAt: now
  };

  await context.repositories.runs.put(run);
  await context.repositories.jobs.put(updatedJob);

  await context.agentRuntimeClient.invoke({
    workspaceId: context.workspaceId,
    documentId: document.documentId,
    jobId: job.jobId,
    runId: run.runId,
    workflowVariant: job.workflowVariant,
    priceBookVersion: job.priceBookVersion,
    ...(request.validationRunId === undefined ? {} : { validationRunId: request.validationRunId })
  });

  return jsonResponse(201, {
    run: (await context.repositories.runs.get(run.runId)) ?? run
  });
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

  return jsonResponse(200, { run, stageEvents: boundedItems(stageEvents) });
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

  return jsonResponse(200, { run, artifacts: boundedItems(artifacts) });
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

  return jsonResponse(200, { ledgerItems: boundedItems(ledgerItems) });
}

export async function getArtifactDownloadUrl(
  context: ControlApiContext,
  artifactId: string
): Promise<ApiResponse<ArtifactDownloadUrlResponse>> {
  const artifact = await context.repositories.artifacts.get(artifactId);
  if (artifact === undefined || artifact.workspaceId !== context.workspaceId) {
    throw new ControlApiError("ARTIFACT_NOT_FOUND", `Artifact ${artifactId} was not found`);
  }

  const downloadUrl = await context.artifactObjects.createPresignedGetUrl({
    key: artifact.s3Key,
    ...(artifact.s3VersionId === undefined ? {} : { versionId: artifact.s3VersionId }),
    expiresInSeconds: context.config.sourceUploadExpiresInSeconds,
    context: {
      workspaceId: context.workspaceId,
      documentId: artifact.documentId,
      ...(artifact.jobId === undefined ? {} : { jobId: artifact.jobId }),
      ...(artifact.runId === undefined ? {} : { runId: artifact.runId })
    }
  });

  return jsonResponse(200, {
    artifactId: artifact.artifactId,
    s3Key: artifact.s3Key,
    downloadUrl,
    expiresInSeconds: context.config.sourceUploadExpiresInSeconds
  });
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
    jobs: boundedItems(summaries)
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
