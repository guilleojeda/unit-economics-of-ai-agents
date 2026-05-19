import type {
  Artifact,
  Document,
  EvaluationResult,
  LedgerItem,
  PriceBook,
  ReviewDecision,
  Run,
  StageName,
  StageEvent,
  TranslationJob
} from "@agentcore-pdf-translator/schemas";

export const fixtureNow = "2026-05-18T12:00:00.000Z";

export const activePriceBook: PriceBook = {
  priceBookVersion: "pb_fixture_2026_05_18",
  status: "ACTIVE",
  currency: "USD",
  modelPrices: [
    {
      provider: "bedrock",
      modelId: "fixture.translation.model",
      inputTokenPricePer1K: 0.01,
      outputTokenPricePer1K: 0.02
    },
    {
      provider: "bedrock",
      modelId: "fixture.evaluator.model",
      inputTokenPricePer1K: 0.008,
      outputTokenPricePer1K: 0.016
    }
  ],
  agentCorePrices: {
    gatewayOperationUsd: 0.005,
    runtimeVcpuHourUsd: 0.04,
    runtimeGbHourUsd: 0.004
  },
  externalServicePrices: [
    {
      serviceName: "pdf-preview-fixture",
      billableUnit: "PAGE",
      unitPriceUsd: 0.01
    }
  ],
  humanReviewHourlyRateDefaultUsd: 90,
  sourceNotes: ["Fixture values for local UI scaffolding only"],
  createdAt: fixtureNow,
  updatedAt: fixtureNow
};

export const documents: ReadonlyArray<Document> = [
  {
    workspaceId: "ws_default",
    documentId: "doc_refunds",
    title: "Procedimiento de Reembolsos y Elegibilidad",
    sourceLanguage: "es",
    targetLanguage: "en",
    status: "READY",
    sourcePdfArtifactId: "art_source_pdf",
    sourcePdfS3Bucket: "agentcore-pdf-translator-dev-123456789012-us-east-1",
    sourcePdfS3Key: "workspaces/ws_default/documents/doc_refunds/source/source.pdf",
    fileName: "procedimiento-reembolsos-elegibilidad.pdf",
    fileSizeBytes: 418204,
    sha256: "fixture-sha256-refunds",
    pageCount: 4,
    textBlockCount: 42,
    imageCount: 2,
    estimatedScannedPageCount: 0,
    detectedSourceLanguage: "es",
    layoutComplexityScore: 0.42,
    inspectionWarnings: ["Page 4 includes Spanish process labels inside an embedded diagram."],
    createdAt: fixtureNow,
    updatedAt: "2026-05-18T12:12:00.000Z"
  }
];

const valueModel = {
  valuePerAcceptedPdfUsd: 75,
  manualTranslationBaselineUsd: 60,
  manualReviewBaselineUsd: 15,
  humanReviewHourlyRateUsd: 90
} as const;

const commonOptions = {
  enablePolicyChecks: true,
  enableMemory: false,
  preserveLayout: "APPROXIMATE"
} as const;

export const jobs: ReadonlyArray<TranslationJob> = [
  {
    workspaceId: "ws_default",
    jobId: "job_v1",
    documentId: "doc_refunds",
    comparisonGroupId: "cmp_refunds",
    workflowVariant: "V1_TEXT_ONLY",
    status: "AWAITING_REVIEW",
    sourceLanguage: "es",
    targetLanguage: "en",
    valueModel,
    options: {
      ...commonOptions,
      enableImageTranslation: false
    },
    priceBookVersion: activePriceBook.priceBookVersion,
    totalAttemptCount: 1,
    latestRunId: "run_v1",
    llmOnlyCostUsd: 1.2,
    fullWorkflowCostUsd: 1.55,
    unitValueUsd: 75,
    costBasis: "TELEMETRY_DERIVED_PRICE_BOOK_ESTIMATE",
    createdAt: "2026-05-18T12:20:00.000Z",
    updatedAt: "2026-05-18T12:24:00.000Z"
  },
  {
    workspaceId: "ws_default",
    jobId: "job_v2",
    documentId: "doc_refunds",
    comparisonGroupId: "cmp_refunds",
    workflowVariant: "V2_TEXT_AND_IMAGE_ANNOTATION",
    status: "REJECTED",
    sourceLanguage: "es",
    targetLanguage: "en",
    valueModel,
    options: {
      ...commonOptions,
      enableImageTranslation: true
    },
    priceBookVersion: activePriceBook.priceBookVersion,
    totalAttemptCount: 1,
    latestRunId: "run_v2",
    llmOnlyCostUsd: 2.5,
    fullWorkflowCostUsd: 10.65,
    unitValueUsd: 75,
    costBasis: "TELEMETRY_DERIVED_PRICE_BOOK_ESTIMATE",
    createdAt: "2026-05-18T12:30:00.000Z",
    updatedAt: "2026-05-18T12:40:00.000Z"
  },
  {
    workspaceId: "ws_default",
    jobId: "job_v3",
    documentId: "doc_refunds",
    comparisonGroupId: "cmp_refunds",
    workflowVariant: "V3_OPTIMIZED",
    status: "ACCEPTED",
    sourceLanguage: "es",
    targetLanguage: "en",
    valueModel,
    options: {
      ...commonOptions,
      enableImageTranslation: true
    },
    priceBookVersion: activePriceBook.priceBookVersion,
    totalAttemptCount: 1,
    acceptedRunId: "run_v3",
    latestRunId: "run_v3",
    llmOnlyCostUsd: 1.95,
    fullWorkflowCostUsd: 8.4,
    costPerVerifiedOutcomeUsd: 8.4,
    unitValueUsd: 75,
    unitMarginUsd: 66.6,
    costBasis: "TELEMETRY_DERIVED_PRICE_BOOK_ESTIMATE",
    createdAt: "2026-05-18T12:45:00.000Z",
    updatedAt: "2026-05-18T12:55:00.000Z"
  }
];

export const runV1: Run = {
    workspaceId: "ws_default",
    runId: "run_v1",
    jobId: "job_v1",
    documentId: "doc_refunds",
    attemptNumber: 1,
    workflowVariant: "V1_TEXT_ONLY",
    status: "AWAITING_REVIEW",
    sourceLanguage: "es",
    targetLanguage: "en",
    sourcePdfArtifactId: "art_source_pdf",
    translatedPdfArtifactId: "art_translated_v1",
    evaluationResultId: "eval_v1",
    llmOnlyCostUsd: 1.2,
    fullWorkflowCostUsd: 1.55,
    humanReviewCostUsd: 0,
    retryCostUsd: 0,
    remediationCostUsd: 0,
    traceId: "trace-v1",
    warnings: ["Embedded diagram labels remain in Spanish for V1."],
    startedAt: "2026-05-18T12:21:00.000Z",
    completedAt: "2026-05-18T12:24:00.000Z",
    createdAt: "2026-05-18T12:20:30.000Z",
    updatedAt: "2026-05-18T12:24:00.000Z"
};

export const runV2: Run = {
    workspaceId: "ws_default",
    runId: "run_v2",
    jobId: "job_v2",
    documentId: "doc_refunds",
    attemptNumber: 1,
    workflowVariant: "V2_TEXT_AND_IMAGE_ANNOTATION",
    status: "REJECTED",
    sourceLanguage: "es",
    targetLanguage: "en",
    sourcePdfArtifactId: "art_source_pdf",
    translatedPdfArtifactId: "art_translated_v2",
    evaluationResultId: "eval_v2",
    llmOnlyCostUsd: 2.5,
    fullWorkflowCostUsd: 10.65,
    humanReviewCostUsd: 7.5,
    retryCostUsd: 0,
    remediationCostUsd: 0,
    traceId: "trace-v2",
    failureReason: "Reviewer rejected diagram annotations as too noisy.",
    warnings: ["Image text translated with callouts, but layout is crowded."],
    startedAt: "2026-05-18T12:31:00.000Z",
    completedAt: "2026-05-18T12:40:00.000Z",
    createdAt: "2026-05-18T12:30:30.000Z",
    updatedAt: "2026-05-18T12:40:00.000Z"
};

export const runV3: Run = {
    workspaceId: "ws_default",
    runId: "run_v3",
    jobId: "job_v3",
    documentId: "doc_refunds",
    attemptNumber: 1,
    workflowVariant: "V3_OPTIMIZED",
    status: "ACCEPTED",
    sourceLanguage: "es",
    targetLanguage: "en",
    sourcePdfArtifactId: "art_source_pdf",
    translatedPdfArtifactId: "art_translated_v3",
    evaluationResultId: "eval_v3",
    llmOnlyCostUsd: 1.95,
    fullWorkflowCostUsd: 8.4,
    humanReviewCostUsd: 6,
    retryCostUsd: 0,
    remediationCostUsd: 0,
    traceId: "trace-v3",
    warnings: ["Decorative image skipped by routing stage."],
    startedAt: "2026-05-18T12:46:00.000Z",
    completedAt: "2026-05-18T12:55:00.000Z",
    createdAt: "2026-05-18T12:45:30.000Z",
    updatedAt: "2026-05-18T12:55:00.000Z"
};

export const runs: ReadonlyArray<Run> = [runV1, runV2, runV3];

function stageEventsFor(run: Run): ReadonlyArray<StageEvent> {
  const base = {
    workspaceId: run.workspaceId,
    runId: run.runId,
    jobId: run.jobId,
    documentId: run.documentId,
    status: "SUCCEEDED" as const,
    retryCount: 0,
    warnings: [] as string[]
  };
  const stages: ReadonlyArray<StageName> =
    run.workflowVariant === "V1_TEXT_ONLY"
      ? ["inspect_pdf", "extract_text_layout", "chunk_and_align", "translate_text_chunks", "recompose_pdf", "evaluate_translation", "finalize_economics"]
      : run.workflowVariant === "V2_TEXT_AND_IMAGE_ANNOTATION"
        ? ["inspect_pdf", "extract_text_layout", "extract_images", "chunk_and_align", "translate_text_chunks", "translate_image_text", "recompose_pdf", "evaluate_translation", "finalize_economics"]
        : ["inspect_pdf", "route_document", "extract_text_layout", "selective_extract_images", "chunk_and_align", "batch_translate_text_chunks", "selective_translate_image_text", "recompose_pdf", "evaluate_translation", "finalize_economics"];

  return stages.map((stageName, index) => {
    const usesTool = stageName !== "route_document" && stageName !== "finalize_economics";
    const usesModel = stageName.includes("translate") || stageName === "evaluate_translation";

    return {
      ...base,
      stageEventId: `stg_${run.runId}_${index + 1}`,
      sequence: index + 1,
      stageName,
      ...(usesTool ? { toolName: `FixtureTools___${stageName}` } : {}),
      ...(usesModel ? { modelId: "fixture.translation.model" } : {}),
      inputArtifactIds: index === 0 ? ["art_source_pdf"] : [],
      outputArtifactIds: [`art_${run.runId}_${index + 1}`],
      durationMs: 900 + index * 175,
      traceId: run.traceId,
      spanId: `span-${run.runId}-${index + 1}`,
      warnings:
        run.workflowVariant === "V1_TEXT_ONLY" && stageName === "evaluate_translation"
          ? ["V1 leaves non-material image text untranslated."]
          : []
    };
  });
}

export const stageEvents: ReadonlyArray<StageEvent> = runs.flatMap(stageEventsFor);

export const artifacts: ReadonlyArray<Artifact> = [
  {
    workspaceId: "ws_default",
    artifactId: "art_source_pdf",
    documentId: "doc_refunds",
    artifactType: "SOURCE_PDF",
    s3Bucket: "agentcore-pdf-translator-dev-123456789012-us-east-1",
    s3Key: "workspaces/ws_default/documents/doc_refunds/source/source.pdf",
    contentType: "application/pdf",
    sizeBytes: 418204,
    language: "es",
    createdAt: fixtureNow
  },
  ...runs.map((run): Artifact => ({
    workspaceId: run.workspaceId,
    artifactId: `art_translated_${run.workflowVariant.slice(0, 2).toLowerCase()}`,
    documentId: run.documentId,
    jobId: run.jobId,
    runId: run.runId,
    artifactType: "TRANSLATED_PDF",
    s3Bucket: "agentcore-pdf-translator-dev-123456789012-us-east-1",
    s3Key: `workspaces/ws_default/jobs/${run.jobId}/runs/${run.runId}/stages/007-recompose_pdf/translated.pdf`,
    contentType: "application/pdf",
    sizeBytes: 422000,
    language: "en",
    createdAt: run.completedAt ?? run.createdAt
  }))
];

export const evaluations: ReadonlyArray<EvaluationResult> = [
  {
    workspaceId: "ws_default",
    evaluationResultId: "eval_v1",
    runId: "run_v1",
    jobId: "job_v1",
    documentId: "doc_refunds",
    score: 0.82,
    passed: true,
    semanticCoverageScore: 0.9,
    terminologyScore: 0.94,
    layoutScore: 0.84,
    imageTextHandlingScore: 0.4,
    untranslatedSpanishCount: 6,
    missingChunkCount: 0,
    layoutWarnings: ["Diagram labels remain in Spanish."],
    terminologyWarnings: [],
    imageWarnings: ["Image text was intentionally skipped for V1."],
    notes: "Main text is translated; image text remains a review consideration.",
    evaluatorModelId: "fixture.evaluator.model",
    inputTokens: 1700,
    outputTokens: 420,
    createdAt: "2026-05-18T12:24:00.000Z"
  },
  {
    workspaceId: "ws_default",
    evaluationResultId: "eval_v2",
    runId: "run_v2",
    jobId: "job_v2",
    documentId: "doc_refunds",
    score: 0.88,
    passed: true,
    semanticCoverageScore: 0.93,
    terminologyScore: 0.96,
    layoutScore: 0.72,
    imageTextHandlingScore: 0.9,
    untranslatedSpanishCount: 0,
    missingChunkCount: 0,
    layoutWarnings: ["Callouts crowd the page 4 process diagram."],
    terminologyWarnings: [],
    imageWarnings: [],
    notes: "Image text is translated, but reviewer rejected the layout.",
    evaluatorModelId: "fixture.evaluator.model",
    inputTokens: 2100,
    outputTokens: 500,
    createdAt: "2026-05-18T12:39:00.000Z"
  },
  {
    workspaceId: "ws_default",
    evaluationResultId: "eval_v3",
    runId: "run_v3",
    jobId: "job_v3",
    documentId: "doc_refunds",
    score: 0.91,
    passed: true,
    semanticCoverageScore: 0.94,
    terminologyScore: 0.97,
    layoutScore: 0.86,
    imageTextHandlingScore: 0.86,
    untranslatedSpanishCount: 0,
    missingChunkCount: 0,
    layoutWarnings: ["Decorative image skipped; material diagram labels translated."],
    terminologyWarnings: [],
    imageWarnings: [],
    notes: "Selective image handling preserves quality while avoiding decorative image work.",
    evaluatorModelId: "fixture.evaluator.model",
    inputTokens: 1900,
    outputTokens: 460,
    createdAt: "2026-05-18T12:54:00.000Z"
  }
];

function ledgerItem(args: {
  readonly ledgerItemId: string;
  readonly run: Run;
  readonly stageName: LedgerItem["stageName"];
  readonly stageSequence: number;
  readonly componentType: LedgerItem["componentType"];
  readonly componentName: string;
  readonly billableUnit: LedgerItem["billableUnit"];
  readonly unitCount: number;
  readonly unitPriceUsd: number;
  readonly estimatedCostUsd: number;
  readonly costSource: LedgerItem["costSource"];
  readonly modelId?: string;
  readonly toolName?: string;
  readonly humanReviewSeconds?: number;
}): LedgerItem {
  return {
    workspaceId: args.run.workspaceId,
    ledgerItemId: args.ledgerItemId,
    runId: args.run.runId,
    jobId: args.run.jobId,
    documentId: args.run.documentId,
    workflowVariant: args.run.workflowVariant,
    stageName: args.stageName,
    stageSequence: args.stageSequence,
    componentType: args.componentType,
    componentName: args.componentName,
    billableUnit: args.billableUnit,
    unitCount: args.unitCount,
    unitPriceUsd: args.unitPriceUsd,
    estimatedCostUsd: args.estimatedCostUsd,
    costSource: args.costSource,
    priceBookVersion: activePriceBook.priceBookVersion,
    createdAt: args.run.completedAt ?? args.run.createdAt,
    traceId: args.run.traceId,
    ...(args.modelId === undefined ? {} : { modelId: args.modelId }),
    ...(args.toolName === undefined ? {} : { toolName: args.toolName }),
    ...(args.humanReviewSeconds === undefined ? {} : { humanReviewSeconds: args.humanReviewSeconds })
  };
}

export const ledgerItems: ReadonlyArray<LedgerItem> = [
  ledgerItem({
    ledgerItemId: "led_v1_model",
    run: runV1,
    stageName: "translate_text_chunks",
    stageSequence: 4,
    componentType: "MODEL_INFERENCE",
    componentName: "fixture.translation.model",
    billableUnit: "INPUT_TOKEN",
    unitCount: 1,
    unitPriceUsd: 1.2,
    estimatedCostUsd: 1.2,
    costSource: "BEDROCK_RESPONSE_USAGE",
    modelId: "fixture.translation.model"
  }),
  ledgerItem({
    ledgerItemId: "led_v1_gateway",
    run: runV1,
    stageName: "extract_text_layout",
    stageSequence: 2,
    componentType: "AGENTCORE_GATEWAY",
    componentName: "PdfPipelineTools___extract_text_layout",
    billableUnit: "TOOL_OPERATION",
    unitCount: 70,
    unitPriceUsd: 0.005,
    estimatedCostUsd: 0.35,
    costSource: "AGENTCORE_GATEWAY_METRIC",
    toolName: "PdfPipelineTools___extract_text_layout"
  }),
  ledgerItem({
    ledgerItemId: "led_v2_model",
    run: runV2,
    stageName: "translate_image_text",
    stageSequence: 6,
    componentType: "MODEL_INFERENCE",
    componentName: "fixture.translation.model",
    billableUnit: "INPUT_TOKEN",
    unitCount: 1,
    unitPriceUsd: 2.5,
    estimatedCostUsd: 2.5,
    costSource: "BEDROCK_RESPONSE_USAGE",
    modelId: "fixture.translation.model"
  }),
  ledgerItem({
    ledgerItemId: "led_v2_gateway",
    run: runV2,
    stageName: "extract_images",
    stageSequence: 3,
    componentType: "AGENTCORE_GATEWAY",
    componentName: "PdfPipelineTools___extract_images",
    billableUnit: "TOOL_OPERATION",
    unitCount: 130,
    unitPriceUsd: 0.005,
    estimatedCostUsd: 0.65,
    costSource: "AGENTCORE_GATEWAY_METRIC",
    toolName: "PdfPipelineTools___extract_images"
  }),
  ledgerItem({
    ledgerItemId: "led_v2_review",
    run: runV2,
    stageName: "reviewer_decision",
    stageSequence: 9,
    componentType: "HUMAN_REVIEW",
    componentName: "human-review",
    billableUnit: "SECOND",
    unitCount: 300,
    unitPriceUsd: 0.025,
    estimatedCostUsd: 7.5,
    costSource: "HUMAN_REVIEW_TIMER",
    humanReviewSeconds: 300
  }),
  ledgerItem({
    ledgerItemId: "led_v3_model",
    run: runV3,
    stageName: "batch_translate_text_chunks",
    stageSequence: 6,
    componentType: "MODEL_INFERENCE",
    componentName: "fixture.translation.model",
    billableUnit: "INPUT_TOKEN",
    unitCount: 1,
    unitPriceUsd: 1.95,
    estimatedCostUsd: 1.95,
    costSource: "BEDROCK_RESPONSE_USAGE",
    modelId: "fixture.translation.model"
  }),
  ledgerItem({
    ledgerItemId: "led_v3_gateway",
    run: runV3,
    stageName: "selective_extract_images",
    stageSequence: 4,
    componentType: "AGENTCORE_GATEWAY",
    componentName: "PdfPipelineTools___extract_images",
    billableUnit: "TOOL_OPERATION",
    unitCount: 90,
    unitPriceUsd: 0.005,
    estimatedCostUsd: 0.45,
    costSource: "AGENTCORE_GATEWAY_METRIC",
    toolName: "PdfPipelineTools___extract_images"
  }),
  ledgerItem({
    ledgerItemId: "led_v3_review",
    run: runV3,
    stageName: "reviewer_decision",
    stageSequence: 10,
    componentType: "HUMAN_REVIEW",
    componentName: "human-review",
    billableUnit: "SECOND",
    unitCount: 240,
    unitPriceUsd: 0.025,
    estimatedCostUsd: 6,
    costSource: "HUMAN_REVIEW_TIMER",
    humanReviewSeconds: 240
  })
];

export const reviewDecisions: ReadonlyArray<ReviewDecision> = [
  {
    workspaceId: "ws_default",
    reviewDecisionId: "rev_v2",
    jobId: "job_v2",
    runId: "run_v2",
    documentId: "doc_refunds",
    decision: "REJECTED",
    reviewerSeconds: 300,
    humanReviewHourlyRateUsd: 90,
    estimatedReviewCostUsd: 7.5,
    reason: "Image annotations made the process diagram harder to read.",
    createdAt: "2026-05-18T12:40:00.000Z"
  },
  {
    workspaceId: "ws_default",
    reviewDecisionId: "rev_v3",
    jobId: "job_v3",
    runId: "run_v3",
    documentId: "doc_refunds",
    decision: "ACCEPTED",
    reviewerSeconds: 240,
    humanReviewHourlyRateUsd: 90,
    estimatedReviewCostUsd: 6,
    reason: "Accepted with selective image handling.",
    createdAt: "2026-05-18T12:55:00.000Z"
  }
];
