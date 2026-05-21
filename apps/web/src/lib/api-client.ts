import type { JobEconomicsRollup } from "@agentcore-pdf-translator/costing";
import {
  ApiErrorSchema,
  ArtifactDownloadUrlResponseSchema,
  ArtifactSchema,
  CreateDocumentResponseSchema,
  CreateTranslationJobRequestSchema,
  DocumentPresignRequestSchema,
  DocumentPresignResponseSchema,
  DocumentSchema,
  EvaluationResultSchema,
  LedgerItemSchema,
  PriceBookSchema,
  ReviewDecisionSchema,
  ReviewRunRequestSchema,
  RunSchema,
  StageEventSchema,
  StartRunRequestSchema,
  TranslationJobSchema,
  type ApiError,
  type CreateDocumentRequest,
  type CreateTranslationJobRequest,
  type Document,
  type DocumentPresignRequest,
  type ReviewRunRequest,
  type StartRunRequest
} from "@agentcore-pdf-translator/schemas";
import { z } from "zod";
import { buildInfo } from "./build-info";

const DocumentListResponseSchema = z.object({
  documents: z.array(DocumentSchema)
});

const DocumentJobsResponseSchema = z.object({
  document: DocumentSchema,
  jobs: z.array(TranslationJobSchema)
});

const JobListResponseSchema = z.object({
  jobs: z.array(TranslationJobSchema)
});

const JobRunsResponseSchema = z.object({
  job: TranslationJobSchema,
  runs: z.array(RunSchema)
});

const LedgerResponseSchema = z.object({
  ledgerItems: z.array(LedgerItemSchema)
});

const RunTimelineResponseSchema = z.object({
  run: RunSchema,
  stageEvents: z.array(StageEventSchema)
});

const RunArtifactsResponseSchema = z.object({
  run: RunSchema,
  artifacts: z.array(ArtifactSchema)
});

const RunEvaluationResponseSchema = z.object({
  run: RunSchema,
  evaluation: EvaluationResultSchema.nullable()
});

const CurrentPriceBookResponseSchema = z.object({
  priceBook: PriceBookSchema,
  setting: z.object({
    settingKey: z.literal("ACTIVE_PRICE_BOOK_VERSION"),
    settingValue: z.string().min(1),
    updatedAt: z.string().datetime({ offset: true })
  })
});

const CreatedJobResponseSchema = z.object({
  job: TranslationJobSchema
});

const CreatedRunResponseSchema = z.object({
  run: RunSchema
});

const ReviewRunResponseSchema = z.object({
  run: RunSchema,
  job: TranslationJobSchema,
  reviewDecision: ReviewDecisionSchema,
  stageEvent: StageEventSchema,
  ledgerItem: LedgerItemSchema
});

const JobEconomicsRollupSchema = z.object({
  jobId: z.string().min(1),
  status: TranslationJobSchema.shape.status,
  runCount: z.number().int().nonnegative(),
  llmOnlyCostUsd: z.number().finite().nonnegative(),
  fullWorkflowCostUsd: z.number().finite().nonnegative(),
  humanReviewCostUsd: z.number().finite().nonnegative(),
  retryCostUsd: z.number().finite().nonnegative(),
  remediationCostUsd: z.number().finite().nonnegative(),
  costPerVerifiedOutcomeUsd: z.number().finite().nonnegative().nullable(),
  unitValueUsd: z.number().finite().nonnegative(),
  unitMarginUsd: z.number().finite().nullable(),
  costBasis: TranslationJobSchema.shape.costBasis
}) satisfies z.ZodType<JobEconomicsRollup>;

const JobEconomicsResponseSchema = z.object({
  job: TranslationJobSchema,
  economics: JobEconomicsRollupSchema
});

const ComparisonResponseSchema = z.object({
  comparisonGroupId: z.string().min(1),
  jobs: z.array(
    z.object({
      job: TranslationJobSchema,
      economics: JobEconomicsRollupSchema
    })
  )
});

export type ApiClientErrorInfo = {
  readonly status: number;
  readonly code: ApiError["error"]["code"] | "NETWORK_ERROR" | "INVALID_RESPONSE";
  readonly message: string;
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: ApiClientErrorInfo["code"];

  constructor(info: ApiClientErrorInfo) {
    super(info.message);
    this.name = "ApiClientError";
    this.status = info.status;
    this.code = info.code;
  }
}

type JsonRequestInit = Omit<RequestInit, "body"> & {
  readonly body?: unknown;
};

function apiUrl(path: string): string {
  return `${buildInfo.apiBasePath}${path}`;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return {};
  }

  return JSON.parse(text) as unknown;
}

async function requestJson<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: JsonRequestInit
): Promise<T> {
  let response: Response;
  try {
    const headers = new Headers(init?.headers);
    headers.set("accept", "application/json");
    const { body, ...requestOptions } = init ?? {};
    if (body !== undefined) {
      headers.set("content-type", "application/json");
    }
    const requestInit: RequestInit = {
      ...requestOptions,
      headers,
      credentials: "same-origin"
    };
    if (body !== undefined) {
      requestInit.body = JSON.stringify(body);
    }
    response = await fetch(apiUrl(path), requestInit);
  } catch (error) {
    throw new ApiClientError({
      status: 0,
      code: "NETWORK_ERROR",
      message: error instanceof Error ? error.message : "Network request failed"
    });
  }

  const json = await readJson(response);
  if (!response.ok) {
    const parsedError = ApiErrorSchema.safeParse(json);
    throw new ApiClientError({
      status: response.status,
      code: parsedError.success ? parsedError.data.error.code : "INVALID_RESPONSE",
      message: parsedError.success ? parsedError.data.error.message : "API request failed"
    });
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiClientError({
      status: response.status,
      code: "INVALID_RESPONSE",
      message: "API response did not match the expected contract"
    });
  }

  return parsed.data;
}

function encode(value: string): string {
  return encodeURIComponent(value);
}

export const apiClient = {
  listDocuments() {
    return requestJson("/documents", DocumentListResponseSchema);
  },
  presignDocumentUpload(request: DocumentPresignRequest) {
    return requestJson("/documents/presign", DocumentPresignResponseSchema, {
      method: "POST",
      body: DocumentPresignRequestSchema.parse(request)
    });
  },
  createDocument(request: CreateDocumentRequest) {
    return requestJson("/documents", CreateDocumentResponseSchema, {
      method: "POST",
      body: request
    });
  },
  inspectDocument(documentId: string) {
    return requestJson(`/documents/${encode(documentId)}/inspect`, DocumentSchema, {
      method: "POST",
      body: {}
    });
  },
  getDocument(documentId: string) {
    return requestJson(`/documents/${encode(documentId)}`, DocumentSchema);
  },
  getDocumentJobs(documentId: string) {
    return requestJson(`/documents/${encode(documentId)}/jobs`, DocumentJobsResponseSchema);
  },
  createJob(documentId: string, request: CreateTranslationJobRequest) {
    return requestJson(`/documents/${encode(documentId)}/jobs`, CreatedJobResponseSchema, {
      method: "POST",
      body: CreateTranslationJobRequestSchema.parse(request)
    });
  },
  listJobs() {
    return requestJson("/jobs", JobListResponseSchema);
  },
  getJob(jobId: string) {
    return requestJson(`/jobs/${encode(jobId)}`, TranslationJobSchema);
  },
  getJobRuns(jobId: string) {
    return requestJson(`/jobs/${encode(jobId)}/runs`, JobRunsResponseSchema);
  },
  getJobLedger(jobId: string) {
    return requestJson(`/jobs/${encode(jobId)}/ledger`, LedgerResponseSchema);
  },
  getJobEconomics(jobId: string) {
    return requestJson(`/jobs/${encode(jobId)}/economics`, JobEconomicsResponseSchema);
  },
  startRun(jobId: string, request: StartRunRequest = {}) {
    return requestJson(`/jobs/${encode(jobId)}/runs`, CreatedRunResponseSchema, {
      method: "POST",
      body: StartRunRequestSchema.parse(request)
    });
  },
  getRun(runId: string) {
    return requestJson(`/runs/${encode(runId)}`, RunSchema);
  },
  getRunTimeline(runId: string) {
    return requestJson(`/runs/${encode(runId)}/timeline`, RunTimelineResponseSchema);
  },
  getRunArtifacts(runId: string) {
    return requestJson(`/runs/${encode(runId)}/artifacts`, RunArtifactsResponseSchema);
  },
  getRunEvaluation(runId: string) {
    return requestJson(`/runs/${encode(runId)}/evaluation`, RunEvaluationResponseSchema);
  },
  getRunLedger(runId: string) {
    return requestJson(`/runs/${encode(runId)}/ledger`, LedgerResponseSchema);
  },
  reviewRun(runId: string, request: ReviewRunRequest) {
    return requestJson(`/runs/${encode(runId)}/review`, ReviewRunResponseSchema, {
      method: "POST",
      body: ReviewRunRequestSchema.parse(request)
    });
  },
  getArtifactDownloadUrl(artifactId: string) {
    return requestJson(`/artifacts/${encode(artifactId)}/download-url`, ArtifactDownloadUrlResponseSchema);
  },
  getCurrentPriceBook() {
    return requestJson("/price-books/current", CurrentPriceBookResponseSchema);
  },
  getComparison(comparisonGroupId: string) {
    return requestJson(`/compare?comparisonGroupId=${encode(comparisonGroupId)}`, ComparisonResponseSchema);
  },
  async uploadSourcePdf(
    uploadUrl: string,
    file: File,
    requiredHeaders: Readonly<Record<string, string>>
  ): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: requiredHeaders,
      body: file,
      credentials: "omit"
    });

    if (!response.ok) {
      throw new ApiClientError({
        status: response.status,
        code: "NETWORK_ERROR",
        message: "Source PDF upload failed"
      });
    }
  }
};

export function isReadyDocument(document: Document): boolean {
  return document.status === "READY";
}
