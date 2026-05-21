import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
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
import type { ApiResponse } from "../src/index.js";
import { buildPreGatewayStagePlan, createInMemoryControlApiContext, dispatch } from "../src/index.js";

const now = "2026-05-18T12:00:00.000Z";
const controlledPdfBytes = new TextEncoder().encode("%PDF-1.4\ncontrolled fixture\n%%EOF\n");
const controlledPdfSha256 = createHash("sha256").update(controlledPdfBytes).digest("hex");

function responseBody<TBody>(response: ApiResponse): TBody {
  return response.body as TBody;
}

function apiError(response: ApiResponse): ApiError {
  return responseBody<ApiError>(response);
}

function makeContext(options: { readonly workspaceId?: string; readonly controlledFixtureSha256?: string } = {}) {
  let sequence = 0;
  return createInMemoryControlApiContext({
    ...(options.workspaceId === undefined ? {} : { workspaceId: options.workspaceId }),
    ...(options.controlledFixtureSha256 === undefined
      ? {}
      : { controlledFixtureSha256: options.controlledFixtureSha256 }),
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

describe("Control API document registration", () => {
  it("presigns source upload, registers server-observed PDF evidence, and marks only the controlled fixture ready", async () => {
    const context = makeContext({ controlledFixtureSha256: controlledPdfSha256 });

    const presign = await dispatch(context, {
      method: "POST",
      path: "/api/documents/presign",
      body: {
        fileName: "controlled-spanish-source.pdf",
        contentType: "application/pdf",
        sizeBytes: controlledPdfBytes.byteLength,
        sha256: controlledPdfSha256
      }
    });
    expect(presign.statusCode).toBe(200);
    const presignBody = responseBody<{
      readonly documentId: string;
      readonly s3Key: string;
      readonly maxSizeBytes: number;
    }>(presign);

    await context.artifactObjects.putObject({
      key: presignBody.s3Key,
      body: controlledPdfBytes,
      contentType: "application/pdf",
      context: {
        workspaceId: context.workspaceId,
        documentId: presignBody.documentId
      }
    });

    const created = await dispatch(context, {
      method: "POST",
      path: "/api/documents",
      body: {
        documentId: presignBody.documentId,
        title: "Procedimiento de Reembolsos y Elegibilidad",
        fileName: "controlled-spanish-source.pdf",
        s3Key: presignBody.s3Key,
        contentType: "application/pdf",
        sizeBytes: controlledPdfBytes.byteLength,
        sha256: controlledPdfSha256
      }
    });
    expect(created.statusCode).toBe(201);
    const createdBody = responseBody<{
      readonly document: Document;
      readonly sourceArtifact: Artifact;
    }>(created);
    expect(createdBody.document.status).toBe("UPLOADED");
    expect(createdBody.document.sha256).toBe(controlledPdfSha256);
    expect(createdBody.sourceArtifact.sha256).toBe(controlledPdfSha256);
    expect(createdBody.sourceArtifact.s3VersionId).toMatch(/^mem-/u);

    const retry = await dispatch(context, {
      method: "POST",
      path: "/api/documents",
      body: {
        documentId: presignBody.documentId,
        title: "Procedimiento de Reembolsos y Elegibilidad",
        fileName: "controlled-spanish-source.pdf",
        s3Key: presignBody.s3Key,
        contentType: "application/pdf",
        sizeBytes: controlledPdfBytes.byteLength,
        sha256: controlledPdfSha256
      }
    });
    expect(retry.statusCode).toBe(200);

    const inspected = await dispatch(context, {
      method: "POST",
      path: `/api/documents/${presignBody.documentId}/inspect`
    });
    expect(inspected.statusCode).toBe(200);
    expect(responseBody<Document>(inspected)).toMatchObject({
      status: "READY",
      pageCount: 4,
      detectedSourceLanguage: "es"
    });

    const downloadUrl = await dispatch(context, {
      method: "GET",
      path: `/api/artifacts/${createdBody.sourceArtifact.artifactId}/download-url`
    });
    expect(downloadUrl.statusCode).toBe(200);
    expect(responseBody<{ readonly downloadUrl: string }>(downloadUrl).downloadUrl).toContain(
      encodeURIComponent(presignBody.s3Key)
    );
  });

  it("rejects missing, wrong-key, wrong-type, non-PDF, and unsupported fixture uploads without product readiness", async () => {
    const context = makeContext({ controlledFixtureSha256: controlledPdfSha256 });
    const expectedKey = "workspaces/ws_default/documents/doc_01/source/source.pdf";

    const missing = await dispatch(context, {
      method: "POST",
      path: "/api/documents",
      body: {
        documentId: "doc_01",
        title: "Missing",
        fileName: "missing.pdf",
        s3Key: expectedKey,
        contentType: "application/pdf"
      }
    });
    expect(missing.statusCode).toBe(400);

    const wrongKey = await dispatch(context, {
      method: "POST",
      path: "/api/documents",
      body: {
        documentId: "doc_01",
        title: "Wrong key",
        fileName: "wrong.pdf",
        s3Key: "workspaces/ws_default/documents/doc_02/source/source.pdf",
        contentType: "application/pdf"
      }
    });
    expect(wrongKey.statusCode).toBe(400);

    await context.artifactObjects.putObject({
      key: expectedKey,
      body: new TextEncoder().encode("not a pdf"),
      contentType: "application/pdf",
      context: { workspaceId: "ws_default", documentId: "doc_01" }
    });
    const nonPdf = await dispatch(context, {
      method: "POST",
      path: "/api/documents",
      body: {
        documentId: "doc_01",
        title: "Not PDF",
        fileName: "not-pdf.pdf",
        s3Key: expectedKey,
        contentType: "application/pdf"
      }
    });
    expect(nonPdf.statusCode).toBe(400);

    const unknownPdf = new TextEncoder().encode("%PDF-1.4\nunknown\n%%EOF\n");
    await context.artifactObjects.putObject({
      key: expectedKey,
      body: unknownPdf,
      contentType: "application/pdf",
      context: { workspaceId: "ws_default", documentId: "doc_01" }
    });
    const registered = await dispatch(context, {
      method: "POST",
      path: "/api/documents",
      body: {
        documentId: "doc_01",
        title: "Unknown",
        fileName: "unknown.pdf",
        s3Key: expectedKey,
        contentType: "application/pdf"
      }
    });
    expect(registered.statusCode).toBe(201);
    const inspected = await dispatch(context, {
      method: "POST",
      path: "/api/documents/doc_01/inspect"
    });
    expect(responseBody<Document>(inspected).status).toBe("UNSUPPORTED");
  });
});

describe("Control API job creation", () => {
  it("creates only V1 jobs for ready documents and rejects caller-supplied image flags", async () => {
    const context = await seedCurrentPriceBook();
    await context.repositories.documents.put(documentFixture());

    const deferred = await dispatch(context, {
      method: "POST",
      path: "/api/documents/doc_01/jobs",
      body: createJobBody("V2_TEXT_AND_IMAGE_ANNOTATION")
    });
    expect(deferred.statusCode).toBe(501);
    expect(apiError(deferred).error.code).toBe("NOT_IMPLEMENTED");

    const created = await dispatch(context, {
      method: "POST",
      path: "/api/documents/doc_01/jobs",
      body: createJobBody("V1_TEXT_ONLY", { createComparisonGroup: true })
    });

    expect(created.statusCode).toBe(201);
    const body = responseBody<{ readonly job: TranslationJob }>(created);
    expect(body.job.workflowVariant).toBe("V1_TEXT_ONLY");
    expect(body.job.options.enableImageTranslation).toBe(false);
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

  it("is idempotent for matching V1 requests and rejects conflicts and unsupported documents without writes", async () => {
    const context = await seedCurrentPriceBook();
    await context.repositories.documents.put(documentFixture());

    const first = await dispatch(context, {
      method: "POST",
      path: "/api/documents/doc_01/jobs",
      body: createJobBody("V1_TEXT_ONLY")
    });
    expect(first.statusCode).toBe(201);

    const retry = await dispatch(context, {
      method: "POST",
      path: "/api/documents/doc_01/jobs",
      body: createJobBody("V1_TEXT_ONLY")
    });
    expect(retry.statusCode).toBe(200);
    expect(responseBody<{ readonly job: TranslationJob }>(retry).job.jobId).toBe(
      responseBody<{ readonly job: TranslationJob }>(first).job.jobId
    );

    const conflict = await dispatch(context, {
      method: "POST",
      path: "/api/documents/doc_01/jobs",
      body: {
        ...createJobBody("V1_TEXT_ONLY"),
        valueModel: {
          valuePerAcceptedPdfUsd: 90,
          humanReviewHourlyRateUsd: 90
        }
      }
    });
    expect(conflict.statusCode).toBe(409);

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
  it("builds only the V1 pre-Gateway executable stage plan", () => {
    expect(buildPreGatewayStagePlan("V1_TEXT_ONLY").map((step) => step.stageName)).toEqual([
      "inspect_pdf",
      "extract_text_layout",
      "extract_images",
      "chunk_and_align",
      "translate_text_chunks",
      "recompose_pdf",
      "evaluate_translation"
    ]);
    expect(buildPreGatewayStagePlan("V2_TEXT_AND_IMAGE_ANNOTATION")).toEqual([]);
    expect(buildPreGatewayStagePlan("V3_OPTIMIZED")).toEqual([]);
  });

  it("executes a V1 pre-Gateway proof run and persists stage evidence", async () => {
    const context = await seedCurrentPriceBook();
    await context.repositories.documents.put(documentFixture());
    await context.repositories.jobs.put(jobFixture());

    const response = await dispatch(context, {
      method: "POST",
      path: "/api/jobs/job_01/runs",
      body: {}
    });

    expect(response.statusCode).toBe(201);
    const run = responseBody<{ readonly run: Run }>(response).run;
    expect(run.status).toBe("AWAITING_REVIEW");
    expect(run.attemptNumber).toBe(1);
    expect(run.provenance?.executionBackend).toBe("PRE_GATEWAY_STAGE_RUNNER");
    await expect(context.repositories.jobs.get("job_01")).resolves.toMatchObject({
      status: "AWAITING_REVIEW",
      latestRunId: run.runId,
      totalAttemptCount: 1
    });

    const stageEvents = await context.repositories.stageEvents.listByRun(run.runId);
    expect(stageEvents.map((event) => [event.sequence, event.stageName, event.status])).toEqual([
      [1, "inspect_pdf", "SUCCEEDED"],
      [2, "extract_text_layout", "SUCCEEDED"],
      [3, "extract_images", "SKIPPED"],
      [4, "chunk_and_align", "SUCCEEDED"],
      [5, "translate_text_chunks", "SUCCEEDED"],
      [7, "recompose_pdf", "SUCCEEDED"],
      [8, "evaluate_translation", "SUCCEEDED"]
    ]);
    const artifacts = await context.repositories.artifacts.listByRun(run.runId);
    expect(artifacts.map((artifact) => artifact.artifactType)).toEqual([
      "INSPECTION_JSON",
      "TEXT_LAYOUT_JSON",
      "SOURCE_CHUNKS_JSON",
      "TRANSLATED_CHUNKS_JSON",
      "TRANSLATED_PDF",
      "EVALUATION_JSON"
    ]);
    const ledgerItems = await context.repositories.ledgerItems.listByRun(run.runId);
    expect(ledgerItems).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ componentType: "MODEL_INFERENCE" })])
    );
    expect(ledgerItems).toEqual(
      expect.arrayContaining([expect.objectContaining({ componentType: "EXTERNAL_SERVICE" })])
    );
    await expect(context.repositories.evaluations.listByRun(run.runId)).resolves.toHaveLength(1);

    const repeated = await dispatch(context, {
      method: "POST",
      path: "/api/jobs/job_01/runs",
      body: {}
    });
    expect(repeated.statusCode).toBe(200);
    await expect(context.repositories.stageEvents.listByRun(run.runId)).resolves.toHaveLength(
      stageEvents.length
    );
    await expect(context.repositories.artifacts.listByRun(run.runId)).resolves.toHaveLength(
      artifacts.length
    );
    await expect(context.repositories.ledgerItems.listByRun(run.runId)).resolves.toHaveLength(
      ledgerItems.length
    );
  });

  it("rejects invalid bodies and terminal jobs while treating active run retries as idempotent", async () => {
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
    expect(alreadyRunning.statusCode).toBe(200);
    expect(responseBody<{ readonly run: Run }>(alreadyRunning).run.runId).toBe("run_01");

    await context.repositories.jobs.put(jobFixture({ jobId: "job_done", status: "ACCEPTED" }));
    const terminal = await dispatch(context, {
      method: "POST",
      path: "/api/jobs/job_done/runs",
      body: {}
    });
    expect(terminal.statusCode).toBe(409);

    await context.repositories.jobs.put(
      jobFixture({ jobId: "job_v2", workflowVariant: "V2_TEXT_AND_IMAGE_ANNOTATION" })
    );
    const deferredVariant = await dispatch(context, {
      method: "POST",
      path: "/api/jobs/job_v2/runs",
      body: {}
    });
    expect(deferredVariant.statusCode).toBe(501);
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
  it("keeps ledgers distinct, returns evaluation null, and exposes private artifact URLs by artifact ID", async () => {
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

    const downloadUrl = await dispatch(context, {
      method: "GET",
      path: "/api/artifacts/art_translated/download-url"
    });
    expect(downloadUrl.statusCode).toBe(200);
    expect(responseBody<{ readonly downloadUrl: string }>(downloadUrl).downloadUrl).toContain(
      encodeURIComponent("workspaces/ws_default/jobs/job_01/runs/run_01/stages/007-recompose_pdf/translated.pdf")
    );
  });

  it("scopes reads by workspace and validates route dispatch and error status mapping", async () => {
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
    expect(invalidMethod.statusCode).toBe(405);
    expect(apiError(invalidMethod).error.code).toBe("METHOD_NOT_ALLOWED");

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
  overrides: Readonly<Record<string, unknown>> = {}
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
