import { describe, expect, it } from "vitest";
import type {
  ApiError,
  Artifact,
  Document,
  EvaluationResult,
  LedgerItem,
  PriceBook,
  Run,
  StageEvent,
  TranslationJob,
  WorkflowVariant
} from "@agentcore-pdf-translator/schemas";
import type { AgentRuntimeClient, ApiResponse, RunExecutionRequest } from "../src/index.js";
import {
  RecordingAgentRuntimeClient,
  createInMemoryControlApiContext,
  dispatch
} from "../src/index.js";

const now = "2026-05-18T12:00:00.000Z";

class FailingAgentRuntimeClient implements AgentRuntimeClient {
  public async invoke(_request: RunExecutionRequest): Promise<void> {
    throw new Error("runtime unavailable");
  }
}

function responseBody<TBody>(response: ApiResponse): TBody {
  return response.body as TBody;
}

function apiError(response: ApiResponse): ApiError {
  return responseBody<ApiError>(response);
}

function makeContext(options: { readonly runtime?: AgentRuntimeClient; readonly workspaceId?: string } = {}) {
  let sequence = 0;
  return createInMemoryControlApiContext({
    ...(options.workspaceId === undefined ? {} : { workspaceId: options.workspaceId }),
    ...(options.runtime === undefined ? {} : { agentRuntimeClient: options.runtime }),
    now: () => now,
    createId: (prefix) => `${prefix}_${String(++sequence).padStart(2, "0")}`
  });
}

function priceBook(overrides: Partial<PriceBook> = {}): PriceBook {
  return {
    priceBookVersion: "pb_test",
    status: "ACTIVE",
    currency: "USD",
    modelPrices: [],
    agentCorePrices: {},
    externalServicePrices: [],
    humanReviewHourlyRateDefaultUsd: 90,
    sourceNotes: ["test fixture only"],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

async function seedCurrentPriceBook(context = makeContext(), activePriceBook = priceBook()) {
  await context.repositories.priceBooks.put(activePriceBook);
  await context.repositories.appSettings.put({
    settingKey: "ACTIVE_PRICE_BOOK_VERSION",
    settingValue: activePriceBook.priceBookVersion,
    updatedAt: now
  });
  return context;
}

function documentFixture(overrides: Partial<Document> = {}): Document {
  return {
    workspaceId: "ws_default",
    documentId: "doc_01",
    title: "Procedimiento de Reembolsos y Elegibilidad",
    sourceLanguage: "es",
    targetLanguage: "en",
    status: "READY",
    sourcePdfArtifactId: "art_source",
    sourcePdfS3Bucket: "bucket",
    sourcePdfS3Key: "workspaces/ws_default/documents/doc_01/source/source.pdf",
    fileName: "source.pdf",
    fileSizeBytes: 1024,
    sha256: "hash",
    pageCount: 4,
    imageCount: 1,
    inspectionWarnings: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function jobFixture(overrides: Partial<TranslationJob> = {}): TranslationJob {
  return {
    workspaceId: "ws_default",
    jobId: "job_01",
    documentId: "doc_01",
    workflowVariant: "V1_TEXT_ONLY",
    status: "CREATED",
    sourceLanguage: "es",
    targetLanguage: "en",
    valueModel: {
      valuePerAcceptedPdfUsd: 100,
      humanReviewHourlyRateUsd: 120
    },
    options: {
      enableImageTranslation: false,
      enablePolicyChecks: true,
      enableMemory: false,
      preserveLayout: "APPROXIMATE"
    },
    priceBookVersion: "pb_test",
    totalAttemptCount: 0,
    llmOnlyCostUsd: 0,
    fullWorkflowCostUsd: 0,
    unitValueUsd: 100,
    costBasis: "TELEMETRY_DERIVED_PRICE_BOOK_ESTIMATE",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function runFixture(overrides: Partial<Run> = {}): Run {
  return {
    workspaceId: "ws_default",
    runId: "run_01",
    jobId: "job_01",
    documentId: "doc_01",
    attemptNumber: 1,
    workflowVariant: "V1_TEXT_ONLY",
    status: "QUEUED",
    sourceLanguage: "es",
    targetLanguage: "en",
    sourcePdfArtifactId: "art_source",
    llmOnlyCostUsd: 0,
    fullWorkflowCostUsd: 0,
    humanReviewCostUsd: 0,
    retryCostUsd: 0,
    remediationCostUsd: 0,
    warnings: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function evaluationFixture(overrides: Partial<EvaluationResult> = {}): EvaluationResult {
  return {
    workspaceId: "ws_default",
    evaluationResultId: "eval_01",
    runId: "run_01",
    jobId: "job_01",
    documentId: "doc_01",
    score: 0.9,
    passed: true,
    semanticCoverageScore: 0.9,
    terminologyScore: 0.9,
    layoutScore: 0.9,
    untranslatedSpanishCount: 0,
    missingChunkCount: 0,
    layoutWarnings: [],
    terminologyWarnings: [],
    imageWarnings: [],
    notes: "fixture evaluation",
    createdAt: now,
    ...overrides
  };
}

function ledgerFixture(overrides: Partial<LedgerItem> = {}): LedgerItem {
  return {
    workspaceId: "ws_default",
    ledgerItemId: "led_model",
    runId: "run_01",
    jobId: "job_01",
    documentId: "doc_01",
    workflowVariant: "V1_TEXT_ONLY",
    stageName: "translate_text_chunks",
    stageSequence: 5,
    componentType: "MODEL_INFERENCE",
    componentName: "fixture-model",
    billableUnit: "INPUT_TOKEN",
    unitCount: 100,
    unitPriceUsd: 0.01,
    estimatedCostUsd: 1,
    costSource: "PRICE_BOOK_ESTIMATE",
    priceBookVersion: "pb_test",
    createdAt: now,
    ...overrides
  };
}

function artifactFixture(overrides: Partial<Artifact> = {}): Artifact {
  return {
    workspaceId: "ws_default",
    artifactId: "art_source",
    documentId: "doc_01",
    artifactType: "SOURCE_PDF",
    s3Bucket: "bucket",
    s3Key: "workspaces/ws_default/documents/doc_01/source/source.pdf",
    contentType: "application/pdf",
    createdAt: now,
    ...overrides
  };
}

async function seedReviewableRun() {
  const context = await seedCurrentPriceBook();
  await context.repositories.documents.put(documentFixture());
  await context.repositories.jobs.put(
    jobFixture({
      status: "AWAITING_REVIEW",
      latestRunId: "run_01",
      totalAttemptCount: 1
    })
  );
  await context.repositories.runs.put(
    runFixture({
      status: "AWAITING_REVIEW"
    })
  );
  await context.repositories.evaluations.put(evaluationFixture());
  await context.repositories.ledgerItems.put(ledgerFixture());
  return context;
}

describe("Control API job creation", () => {
  it("creates jobs for ready documents, derives image translation from workflow variant, and rejects caller-supplied image flags", async () => {
    const context = await seedCurrentPriceBook();
    await context.repositories.documents.put(documentFixture());

    const created = await dispatch(context, {
      method: "POST",
      path: "/api/documents/doc_01/jobs",
      body: {
        workflowVariant: "V2_TEXT_AND_IMAGE_ANNOTATION",
        valueModel: {
          valuePerAcceptedPdfUsd: 75,
          humanReviewHourlyRateUsd: 90
        },
        options: {
          enablePolicyChecks: true,
          enableMemory: false,
          preserveLayout: "APPROXIMATE"
        },
        createComparisonGroup: true
      }
    });

    expect(created.statusCode).toBe(201);
    const body = responseBody<{ readonly job: TranslationJob }>(created);
    expect(body.job.workflowVariant).toBe("V2_TEXT_AND_IMAGE_ANNOTATION");
    expect(body.job.options.enableImageTranslation).toBe(true);
    expect(body.job.comparisonGroupId).toMatch(/^cmp_/u);

    const rejected = await dispatch(context, {
      method: "POST",
      path: "/api/documents/doc_01/jobs",
      body: {
        workflowVariant: "V1_TEXT_ONLY",
        valueModel: {
          valuePerAcceptedPdfUsd: 75,
          humanReviewHourlyRateUsd: 90
        },
        options: {
          enableImageTranslation: true,
          enablePolicyChecks: true,
          enableMemory: false,
          preserveLayout: "APPROXIMATE"
        }
      }
    });

    expect(rejected.statusCode).toBe(400);
    expect(apiError(rejected).error.code).toBe("VALIDATION_ERROR");
  });

  it("applies comparison-group rules and rejects unsupported documents without writes", async () => {
    const context = await seedCurrentPriceBook();
    await context.repositories.documents.put(documentFixture());
    await context.repositories.documents.put(
      documentFixture({
        documentId: "doc_02",
        sourcePdfArtifactId: "art_source_02"
      })
    );
    await context.repositories.jobs.put(
      jobFixture({
        jobId: "job_existing",
        comparisonGroupId: "cmp_existing"
      })
    );
    await context.repositories.jobs.put(
      jobFixture({
        jobId: "job_other_document",
        documentId: "doc_02",
        comparisonGroupId: "cmp_other_document"
      })
    );

    const joined = await dispatch(context, {
      method: "POST",
      path: "/api/documents/doc_01/jobs",
      body: createJobBody("V1_TEXT_ONLY", { comparisonGroupId: "cmp_existing" })
    });
    expect(joined.statusCode).toBe(201);
    expect(responseBody<{ readonly job: TranslationJob }>(joined).job.comparisonGroupId).toBe(
      "cmp_existing"
    );

    const rejectedCrossDocument = await dispatch(context, {
      method: "POST",
      path: "/api/documents/doc_01/jobs",
      body: createJobBody("V1_TEXT_ONLY", { comparisonGroupId: "cmp_other_document" })
    });
    expect(rejectedCrossDocument.statusCode).toBe(400);

    await context.repositories.documents.put(
      documentFixture({
        documentId: "doc_unsupported",
        status: "UNSUPPORTED"
      })
    );
    const before = await context.repositories.jobs.listByDocument("doc_unsupported");
    const unsupported = await dispatch(context, {
      method: "POST",
      path: "/api/documents/doc_unsupported/jobs",
      body: createJobBody("V1_TEXT_ONLY")
    });
    const after = await context.repositories.jobs.listByDocument("doc_unsupported");
    expect(unsupported.statusCode).toBe(400);
    expect(apiError(unsupported).error.code).toBe("DOCUMENT_UNSUPPORTED");
    expect(after).toEqual(before);
  });
});

describe("Control API run creation", () => {
  it("starts a run, assigns the next attempt, and records only IDs for runtime invocation", async () => {
    const runtime = new RecordingAgentRuntimeClient();
    const context = await seedCurrentPriceBook(makeContext({ runtime }));
    await context.repositories.documents.put(documentFixture());
    await context.repositories.jobs.put(jobFixture());

    const response = await dispatch(context, {
      method: "POST",
      path: "/api/jobs/job_01/runs",
      body: {}
    });

    expect(response.statusCode).toBe(201);
    const run = responseBody<{ readonly run: Run }>(response).run;
    expect(run.status).toBe("QUEUED");
    expect(run.attemptNumber).toBe(1);
    expect(runtime.invocations).toEqual([
      {
        workspaceId: "ws_default",
        documentId: "doc_01",
        jobId: "job_01",
        runId: run.runId
      }
    ]);
  });

  it("rejects non-empty run-start bodies and active, reviewable, and terminal jobs", async () => {
    const context = await seedCurrentPriceBook();
    await context.repositories.documents.put(documentFixture());
    await context.repositories.jobs.put(jobFixture());

    const invalidBody = await dispatch(context, {
      method: "POST",
      path: "/api/jobs/job_01/runs",
      body: { reason: "manual retry" }
    });
    expect(invalidBody.statusCode).toBe(400);

    const nullBody = await dispatch(context, {
      method: "POST",
      path: "/api/jobs/job_01/runs",
      body: null
    });
    expect(nullBody.statusCode).toBe(400);

    await context.repositories.runs.put(runFixture({ status: "RUNNING" }));
    const alreadyRunning = await dispatch(context, {
      method: "POST",
      path: "/api/jobs/job_01/runs",
      body: {}
    });
    expect(alreadyRunning.statusCode).toBe(409);
    expect(apiError(alreadyRunning).error.code).toBe("JOB_ALREADY_RUNNING");

    await context.repositories.jobs.put(jobFixture({ jobId: "job_done", status: "ACCEPTED" }));
    const terminal = await dispatch(context, {
      method: "POST",
      path: "/api/jobs/job_done/runs",
      body: {}
    });
    expect(terminal.statusCode).toBe(409);
  });

  it("returns AGENT_INVOCATION_FAILED and persists failed state when runtime invocation fails", async () => {
    const context = await seedCurrentPriceBook(makeContext({ runtime: new FailingAgentRuntimeClient() }));
    await context.repositories.documents.put(documentFixture());
    await context.repositories.jobs.put(jobFixture());

    const response = await dispatch(context, {
      method: "POST",
      path: "/api/jobs/job_01/runs",
      body: {}
    });

    expect(response.statusCode).toBe(502);
    expect(apiError(response).error.code).toBe("AGENT_INVOCATION_FAILED");
    const runs = await context.repositories.runs.listByJob("job_01");
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe("FAILED");
    await expect(context.repositories.jobs.get("job_01")).resolves.toMatchObject({
      status: "FAILED"
    });
  });
});

describe("Control API review decisions", () => {
  it("creates review, reviewer_decision stage event, human review ledger, and accepted economics from ledger rows", async () => {
    const context = await seedReviewableRun();
    const response = await dispatch(context, {
      method: "POST",
      path: "/api/runs/run_01/review",
      body: {
        decision: "ACCEPTED",
        reviewerSeconds: 180,
        reason: "Output accepted"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = responseBody<{
      readonly job: TranslationJob;
      readonly run: Run;
      readonly ledgerItem: LedgerItem;
      readonly stageEvent: StageEvent;
    }>(response);
    expect(body.run.status).toBe("ACCEPTED");
    expect(body.job.status).toBe("ACCEPTED");
    expect(body.ledgerItem.componentType).toBe("HUMAN_REVIEW");
    expect(body.ledgerItem.estimatedCostUsd).toBeCloseTo(6);
    expect(body.stageEvent.stageName).toBe("reviewer_decision");
    expect(body.stageEvent.sequence).toBe(body.ledgerItem.stageSequence);
    expect(body.job.fullWorkflowCostUsd).toBeCloseTo(7);
    expect(body.job.costPerVerifiedOutcomeUsd).toBeCloseTo(7);
    expect(body.job.unitMarginUsd).toBeCloseTo(93);
  });

  it("rejects stale, duplicate, missing-evaluation, and hourly-rate override review requests without writes", async () => {
    const context = await seedReviewableRun();
    await context.repositories.runs.put(
      runFixture({
        runId: "run_stale",
        status: "AWAITING_REVIEW"
      })
    );
    const stale = await dispatch(context, {
      method: "POST",
      path: "/api/runs/run_stale/review",
      body: {
        decision: "REJECTED",
        reviewerSeconds: 60
      }
    });
    expect(stale.statusCode).toBe(409);

    const override = await dispatch(context, {
      method: "POST",
      path: "/api/runs/run_01/review",
      body: {
        decision: "ACCEPTED",
        reviewerSeconds: 60,
        humanReviewHourlyRateUsd: 1
      }
    });
    expect(override.statusCode).toBe(400);
    expect(await context.repositories.reviewDecisions.listByJob("job_01")).toEqual([]);

    await context.repositories.evaluations.put(
      evaluationFixture({
        evaluationResultId: "eval_other",
        runId: "run_other"
      })
    );
    await context.repositories.jobs.put(
      jobFixture({
        jobId: "job_no_eval",
        status: "AWAITING_REVIEW",
        latestRunId: "run_no_eval"
      })
    );
    await context.repositories.runs.put(
      runFixture({
        runId: "run_no_eval",
        jobId: "job_no_eval",
        status: "AWAITING_REVIEW"
      })
    );
    const missingEvaluation = await dispatch(context, {
      method: "POST",
      path: "/api/runs/run_no_eval/review",
      body: {
        decision: "REJECTED",
        reviewerSeconds: 60
      }
    });
    expect(missingEvaluation.statusCode).toBe(409);

    const accepted = await dispatch(context, {
      method: "POST",
      path: "/api/runs/run_01/review",
      body: {
        decision: "ACCEPTED",
        reviewerSeconds: 60
      }
    });
    expect(accepted.statusCode).toBe(200);
    const duplicate = await dispatch(context, {
      method: "POST",
      path: "/api/runs/run_01/review",
      body: {
        decision: "ACCEPTED",
        reviewerSeconds: 60
      }
    });
    expect(duplicate.statusCode).toBe(409);
  });
});

describe("Control API reads, errors, and deferred routes", () => {
  it("keeps run-level and job-level ledgers distinct, returns evaluation null, and exposes artifact metadata without URLs", async () => {
    const context = await seedCurrentPriceBook();
    await context.repositories.documents.put(documentFixture());
    await context.repositories.jobs.put(jobFixture());
    await context.repositories.runs.put(runFixture({ runId: "run_01" }));
    await context.repositories.runs.put(runFixture({ runId: "run_02", attemptNumber: 2 }));
    await context.repositories.ledgerItems.put(ledgerFixture({ runId: "run_01", ledgerItemId: "led_01" }));
    await context.repositories.ledgerItems.put(ledgerFixture({ runId: "run_02", ledgerItemId: "led_02" }));
    await context.repositories.artifacts.put(artifactFixture());
    await context.repositories.artifacts.put(
      artifactFixture({
        artifactId: "art_translated",
        jobId: "job_01",
        runId: "run_01",
        artifactType: "TRANSLATED_PDF",
        s3Key: "workspaces/ws_default/jobs/job_01/runs/run_01/stages/007-recompose_pdf/translated.pdf"
      })
    );

    const runLedger = await dispatch(context, {
      method: "GET",
      path: "/api/runs/run_01/ledger"
    });
    expect(responseBody<{ readonly ledgerItems: ReadonlyArray<LedgerItem> }>(runLedger).ledgerItems).toHaveLength(1);

    const jobLedger = await dispatch(context, {
      method: "GET",
      path: "/api/jobs/job_01/ledger"
    });
    expect(responseBody<{ readonly ledgerItems: ReadonlyArray<LedgerItem> }>(jobLedger).ledgerItems).toHaveLength(2);

    const evaluation = await dispatch(context, {
      method: "GET",
      path: "/api/runs/run_01/evaluation"
    });
    expect(responseBody<{ readonly evaluation: EvaluationResult | null }>(evaluation).evaluation).toBeNull();

    const artifacts = await dispatch(context, {
      method: "GET",
      path: "/api/runs/run_01/artifacts"
    });
    const artifactRows = responseBody<{ readonly artifacts: ReadonlyArray<Artifact> }>(artifacts).artifacts;
    expect(artifactRows.map((artifact) => artifact.artifactId)).toEqual(["art_source", "art_translated"]);
    expect(artifactRows).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ url: expect.any(String) })])
    );
  });

  it("scopes reads by workspace and validates route dispatch, deferred routes, and error status mapping", async () => {
    const context = await seedCurrentPriceBook();
    await context.repositories.documents.put(documentFixture({ workspaceId: "other_ws" }));

    const hidden = await dispatch(context, {
      method: "GET",
      path: "/api/documents/doc_01"
    });
    expect(hidden.statusCode).toBe(404);
    expect(apiError(hidden).error.code).toBe("DOCUMENT_NOT_FOUND");

    const invalidMethod = await dispatch(context, {
      method: "PUT",
      path: "/api/jobs/job_01/runs",
      body: {}
    });
    expect(invalidMethod.statusCode).toBe(400);

    const deferred = await dispatch(context, {
      method: "POST",
      path: "/api/documents/presign",
      body: {}
    });
    expect(deferred.statusCode).toBe(501);
    expect(apiError(deferred).error.code).toBe("NOT_IMPLEMENTED");

    const invalidQuery = await dispatch(context, {
      method: "GET",
      path: "/api/compare",
      query: {}
    });
    expect(invalidQuery.statusCode).toBe(400);

    const invalidPathParam = await dispatch(context, {
      method: "GET",
      path: "/api/documents/%E0%A4%A"
    });
    expect(invalidPathParam.statusCode).toBe(400);
    expect(apiError(invalidPathParam).error.code).toBe("VALIDATION_ERROR");
  });
});

describe("Control API price books", () => {
  it("uses ACTIVE_PRICE_BOOK_VERSION and does not mutate historical job price-book versions", async () => {
    const context = await seedCurrentPriceBook(undefined, priceBook({ priceBookVersion: "pb_initial" }));
    await context.repositories.jobs.put(jobFixture({ priceBookVersion: "pb_initial" }));
    await context.repositories.priceBooks.put(priceBook({ priceBookVersion: "pb_next" }));

    const selected = await dispatch(context, {
      method: "PUT",
      path: "/api/price-books/current",
      body: {
        priceBookVersion: "pb_next"
      }
    });

    expect(selected.statusCode).toBe(200);
    const current = await dispatch(context, {
      method: "GET",
      path: "/api/price-books/current"
    });
    expect(responseBody<{ readonly priceBook: PriceBook }>(current).priceBook.priceBookVersion).toBe("pb_next");
    await expect(context.repositories.jobs.get("job_01")).resolves.toMatchObject({
      priceBookVersion: "pb_initial"
    });
  });

  it("uses the job price-book version for review ledger rows after the current price book changes", async () => {
    const context = await seedCurrentPriceBook(undefined, priceBook({ priceBookVersion: "pb_initial" }));
    await context.repositories.priceBooks.put(priceBook({ priceBookVersion: "pb_next" }));
    await context.repositories.jobs.put(
      jobFixture({
        status: "AWAITING_REVIEW",
        latestRunId: "run_01",
        priceBookVersion: "pb_initial",
        totalAttemptCount: 1
      })
    );
    await context.repositories.runs.put(runFixture({ status: "AWAITING_REVIEW" }));
    await context.repositories.evaluations.put(evaluationFixture());
    await context.repositories.ledgerItems.put(ledgerFixture({ priceBookVersion: "pb_initial" }));
    await dispatch(context, {
      method: "PUT",
      path: "/api/price-books/current",
      body: {
        priceBookVersion: "pb_next"
      }
    });

    const reviewed = await dispatch(context, {
      method: "POST",
      path: "/api/runs/run_01/review",
      body: {
        decision: "ACCEPTED",
        reviewerSeconds: 180
      }
    });

    expect(reviewed.statusCode).toBe(200);
    expect(responseBody<{ readonly ledgerItem: LedgerItem }>(reviewed).ledgerItem.priceBookVersion).toBe(
      "pb_initial"
    );
    const current = await dispatch(context, {
      method: "GET",
      path: "/api/price-books/current"
    });
    expect(responseBody<{ readonly priceBook: PriceBook }>(current).priceBook.priceBookVersion).toBe("pb_next");
  });
});

function createJobBody(
  workflowVariant: WorkflowVariant,
  overrides: {
    readonly comparisonGroupId?: string;
    readonly createComparisonGroup?: boolean;
  } = {}
) {
  return {
    workflowVariant,
    valueModel: {
      valuePerAcceptedPdfUsd: 75,
      humanReviewHourlyRateUsd: 90
    },
    options: {
      enablePolicyChecks: true,
      enableMemory: false,
      preserveLayout: "APPROXIMATE"
    },
    ...overrides
  };
}
