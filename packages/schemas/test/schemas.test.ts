import { describe, expect, it } from "vitest";
import {
  ApiErrorSchema,
  ArtifactSchema,
  DocumentSchema,
  EvaluationResultSchema,
  FileBearingToolRequestSchema,
  LedgerItemSchema,
  PriceBookSchema,
  ReviewDecisionSchema,
  RunSchema,
  StageEventSchema,
  ToolRequestBaseSchema,
  ToolResponseBaseSchema,
  TranslationJobSchema
} from "../src/index.js";

const now = "2026-05-18T12:00:00.000Z";

const baseJob = {
  workspaceId: "ws_default",
  jobId: "job_01",
  documentId: "doc_01",
  workflowVariant: "V1_TEXT_ONLY",
  status: "CREATED",
  sourceLanguage: "es",
  targetLanguage: "en",
  valueModel: {
    valuePerAcceptedPdfUsd: 50,
    humanReviewHourlyRateUsd: 60
  },
  options: {
    enableImageTranslation: false,
    enablePolicyChecks: false,
    enableMemory: false,
    preserveLayout: "APPROXIMATE"
  },
  priceBookVersion: "pb_test",
  totalAttemptCount: 0,
  llmOnlyCostUsd: 0,
  fullWorkflowCostUsd: 0,
  unitValueUsd: 50,
  costBasis: "TELEMETRY_DERIVED_PRICE_BOOK_ESTIMATE",
  createdAt: now,
  updatedAt: now
} as const;

const baseLedger = {
  workspaceId: "ws_default",
  ledgerItemId: "led_01",
  runId: "run_01",
  jobId: "job_01",
  documentId: "doc_01",
  workflowVariant: "V1_TEXT_ONLY",
  stageName: "translate_text_chunks",
  stageSequence: 5,
  componentType: "MODEL_INFERENCE",
  componentName: "bedrock",
  billableUnit: "INPUT_TOKEN",
  unitCount: 1000,
  unitPriceUsd: 0.001,
  estimatedCostUsd: 1,
  costSource: "BEDROCK_RESPONSE_USAGE",
  modelId: "fixture-model",
  inputTokens: 1000,
  priceBookVersion: "pb_test",
  createdAt: now
} as const;

describe("domain schemas", () => {
  it("parses the core entity contracts", () => {
    expect(
      DocumentSchema.parse({
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
        inspectionWarnings: [],
        createdAt: now,
        updatedAt: now
      }).status
    ).toBe("READY");

    expect(TranslationJobSchema.parse(baseJob).jobId).toBe("job_01");

    expect(
      RunSchema.parse({
        workspaceId: "ws_default",
        runId: "run_01",
        jobId: "job_01",
        documentId: "doc_01",
        attemptNumber: 1,
        workflowVariant: "V1_TEXT_ONLY",
        status: "CREATED",
        sourceLanguage: "es",
        targetLanguage: "en",
        sourcePdfArtifactId: "art_source",
        llmOnlyCostUsd: 0,
        fullWorkflowCostUsd: 0,
        humanReviewCostUsd: 0,
        retryCostUsd: 0,
        remediationCostUsd: 0,
        warnings: [],
        provenance: {
          executionBackend: "PRE_GATEWAY_STAGE_RUNNER",
          implementationLabel: "PR-011 pre-Gateway development stage runner",
          implementationVersion: "pr-011.1",
          region: "us-east-1"
        },
        createdAt: now,
        updatedAt: now
      }).attemptNumber
    ).toBe(1);

    expect(
      StageEventSchema.parse({
        workspaceId: "ws_default",
        runId: "run_01",
        jobId: "job_01",
        documentId: "doc_01",
        stageEventId: "stg_01",
        sequence: 1,
        stageName: "inspect_pdf",
        status: "SUCCEEDED",
        inputArtifactIds: ["art_source"],
        outputArtifactIds: ["art_inspection"],
        retryCount: 0,
        warnings: [],
        provenance: {
          executionBackend: "PRE_GATEWAY_STAGE_RUNNER",
          implementationLabel: "PR-011 pre-Gateway development stage runner",
          implementationVersion: "pr-011.1",
          region: "us-east-1"
        }
      }).stageName
    ).toBe("inspect_pdf");

    expect(
      ArtifactSchema.parse({
        workspaceId: "ws_default",
        artifactId: "art_source",
        documentId: "doc_01",
        artifactType: "SOURCE_PDF",
        s3Bucket: "bucket",
        s3Key: "workspaces/ws_default/documents/doc_01/source/source.pdf",
        contentType: "application/pdf",
        provenance: {
          executionBackend: "PRE_GATEWAY_STAGE_RUNNER",
          implementationLabel: "PR-011 pre-Gateway development stage runner",
          implementationVersion: "pr-011.1",
          region: "us-east-1"
        },
        createdAt: now
      }).artifactType
    ).toBe("SOURCE_PDF");

    expect(LedgerItemSchema.parse(baseLedger).componentType).toBe("MODEL_INFERENCE");

    expect(
      EvaluationResultSchema.parse({
        workspaceId: "ws_default",
        evaluationResultId: "eval_01",
        runId: "run_01",
        jobId: "job_01",
        documentId: "doc_01",
        score: 0.9,
        passed: true,
        semanticCoverageScore: 0.9,
        terminologyScore: 1,
        layoutScore: 0.8,
        untranslatedSpanishCount: 0,
        missingChunkCount: 0,
        layoutWarnings: [],
        terminologyWarnings: [],
        imageWarnings: [],
        notes: "",
        provenance: {
          executionBackend: "PRE_GATEWAY_STAGE_RUNNER",
          implementationLabel: "PR-011 pre-Gateway development stage runner",
          implementationVersion: "pr-011.1",
          region: "us-east-1"
        },
        createdAt: now
      }).passed
    ).toBe(true);

    expect(
      ReviewDecisionSchema.parse({
        workspaceId: "ws_default",
        reviewDecisionId: "rev_01",
        jobId: "job_01",
        runId: "run_01",
        documentId: "doc_01",
        decision: "ACCEPTED",
        reviewerSeconds: 300,
        humanReviewHourlyRateUsd: 60,
        estimatedReviewCostUsd: 5,
        createdAt: now
      }).decision
    ).toBe("ACCEPTED");
  });

  it("parses price books, API errors, and tool envelopes", () => {
    const priceBook = PriceBookSchema.parse({
      priceBookVersion: "pb_test",
      status: "ACTIVE",
      currency: "USD",
      modelPrices: [
        {
          provider: "bedrock",
          modelId: "fixture-model",
          inputTokenPricePer1K: 0.001,
          outputTokenPricePer1K: 0.002
        }
      ],
      agentCorePrices: {
        gatewayOperationUsd: 0.0001
      },
      externalServicePrices: [],
      humanReviewHourlyRateDefaultUsd: 60,
      sourceNotes: ["test fixture only"],
      createdAt: now,
      updatedAt: now
    });

    expect(priceBook.status).toBe("ACTIVE");
    expect(
      ApiErrorSchema.parse({
        error: {
          code: "DOCUMENT_UNSUPPORTED",
          message: "Unsupported PDF",
          details: {
            estimatedScannedPageCount: 4
          }
        }
      }).error.code
    ).toBe("DOCUMENT_UNSUPPORTED");

    const request = ToolRequestBaseSchema.parse({
      workspaceId: "ws_default",
      documentId: "doc_01",
      jobId: "job_01",
      runId: "run_01",
      workflowVariant: "V1_TEXT_ONLY",
      sourceLanguage: "es",
      targetLanguage: "en",
      priceBookVersion: "pb_test",
      options: baseJob.options
    });

    expect(request.options.preserveLayout).toBe("APPROXIMATE");
    expect(
      FileBearingToolRequestSchema.parse({
        ...request,
        stageName: "extract_text_layout",
        inputArtifacts: [
          {
            artifactId: "art_source",
            artifactType: "SOURCE_PDF",
            s3Bucket: "bucket",
            s3Key: "workspaces/ws_default/documents/doc_01/source/source.pdf",
            sha256: "hash"
          }
        ]
      }).inputArtifacts
    ).toHaveLength(1);
    expect(() =>
      FileBearingToolRequestSchema.parse({
        ...request,
        stageName: "extract_text_layout",
        inputArtifacts: [],
        documentPath: "/tmp/source.pdf"
      })
    ).toThrow();

    const response = ToolResponseBaseSchema.parse({
      status: "SUCCEEDED",
      stageName: "translate_text_chunks",
      startedAt: now,
      completedAt: now,
      durationMs: 25,
      artifacts: [],
      metrics: {
        chunkCount: 4,
        glossaryEnforced: true
      },
      ledgerItems: [
        {
          ...baseLedger,
          ledgerItemId: undefined,
          createdAt: undefined
        }
      ],
      warnings: []
    });

    expect(response.ledgerItems).toHaveLength(1);
  });

  it("rejects unsupported enum values", () => {
    expect(() =>
      TranslationJobSchema.parse({
        ...baseJob,
        workflowVariant: "SYNTHETIC_SEED"
      })
    ).toThrow();
  });
});
