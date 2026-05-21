import {
  assertJobTransition,
  assertRunTransition,
  evaluationKey,
  inspectionStageKey,
  sourceChunksKey,
  textLayoutKey,
  translatedChunksKey,
  translatedPdfKey
} from "@agentcore-pdf-translator/data";
import {
  rollupJobEconomics,
  rollupRunCost
} from "@agentcore-pdf-translator/costing";
import {
  FileBearingToolRequestSchema,
  ToolResponseBaseSchema,
  type Artifact,
  type ArtifactType,
  type Document,
  type EvaluationResult,
  type ExecutionProvenance,
  type LedgerItem,
  type Run,
  type StageEvent,
  type StageEventStatus,
  type ToolInputArtifactReference,
  type TranslationJob
} from "@agentcore-pdf-translator/schemas";
import { createHash } from "node:crypto";
import type {
  AgentRuntimeClient,
  ControlApiContext,
  RunExecutionRequest
} from "./types.js";
import {
  buildPreGatewayStagePlan,
  type StagePlanStep
} from "./stage-plan.js";

const implementationLabel = "PR-011 pre-Gateway development stage runner";
const implementationVersion = "pr-011.1";
const terminalStageStatuses = new Set<StageEventStatus>(["SUCCEEDED", "FAILED", "SKIPPED"]);

type StageArtifactOutput = {
  readonly artifact: Artifact;
  readonly body: string | Uint8Array;
};

type StageToolOutput = {
  readonly artifacts: ReadonlyArray<StageArtifactOutput>;
  readonly ledgerItems: ReadonlyArray<LedgerItem>;
  readonly evaluation?: EvaluationResult;
  readonly warnings: ReadonlyArray<string>;
  readonly metrics: Readonly<Record<string, number | string | boolean>>;
};

type RunnerState = {
  readonly context: ControlApiContext;
  readonly document: Document;
  readonly job: TranslationJob;
  readonly run: Run;
  readonly provenance: ExecutionProvenance;
};

function optionalEnv(...names: ReadonlyArray<string>): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function buildProvenance(): ExecutionProvenance {
  const commitSha = optionalEnv("DEPLOYED_COMMIT_SHA", "GITHUB_SHA", "COMMIT_SHA");
  const buildId = optionalEnv("DEPLOY_ARTIFACT_ID", "GITHUB_RUN_ID", "BUILD_ID");
  const stage = optionalEnv("STAGE", "APP_STAGE", "CDK_STAGE");
  const awsAccountId = optionalEnv("AWS_ACCOUNT_ID", "CDK_DEFAULT_ACCOUNT");
  const validationRunId = optionalEnv("VALIDATION_RUN_ID");

  return {
    executionBackend: "PRE_GATEWAY_STAGE_RUNNER",
    implementationLabel,
    implementationVersion,
    ...(commitSha === undefined ? {} : { commitSha }),
    ...(buildId === undefined ? {} : { buildId }),
    ...(stage === undefined ? {} : { stage }),
    region: "us-east-1",
    ...(awsAccountId === undefined ? {} : { awsAccountId }),
    ...(validationRunId === undefined ? {} : { validationRunId })
  };
}

function stableEntityId(prefix: "art" | "eval" | "led" | "stg", ...parts: ReadonlyArray<string | number>): string {
  const suffix = parts
    .map((part) => String(part).replace(/[^A-Za-z0-9]+/gu, "_").replace(/^_+|_+$/gu, ""))
    .filter((part) => part.length > 0)
    .join("_")
    .toLowerCase();
  return `${prefix}_${suffix}`;
}

function sha256Hex(body: string | Uint8Array): string {
  return createHash("sha256").update(body).digest("hex");
}

function bytesLength(body: string | Uint8Array): number {
  return typeof body === "string" ? Buffer.byteLength(body, "utf8") : body.byteLength;
}

function jsonBody(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sourceInputArtifact(document: Document): ToolInputArtifactReference {
  return {
    artifactId: document.sourcePdfArtifactId,
    artifactType: "SOURCE_PDF",
    s3Bucket: document.sourcePdfS3Bucket,
    s3Key: document.sourcePdfS3Key,
    ...(document.sourcePdfS3VersionId === undefined ? {} : { s3VersionId: document.sourcePdfS3VersionId }),
    sha256: document.sha256
  };
}

function outputKey(state: RunnerState, step: StagePlanStep, artifactType: ArtifactType): string {
  const base = {
    workspaceId: state.context.workspaceId,
    jobId: state.job.jobId,
    runId: state.run.runId
  };

  if (artifactType === "INSPECTION_JSON") {
    return inspectionStageKey(base);
  }

  if (artifactType === "TEXT_LAYOUT_JSON") {
    return textLayoutKey(base);
  }

  if (artifactType === "SOURCE_CHUNKS_JSON") {
    return sourceChunksKey(base);
  }

  if (artifactType === "TRANSLATED_CHUNKS_JSON") {
    return translatedChunksKey(base);
  }

  if (artifactType === "TRANSLATED_PDF") {
    return translatedPdfKey(base);
  }

  if (artifactType === "EVALUATION_JSON") {
    return evaluationKey(base);
  }

  throw new Error(`Unsupported PR-011 artifact type for ${step.stageName}: ${artifactType}`);
}

function artifactBody(state: RunnerState, step: StagePlanStep, artifactType: ArtifactType): string | Uint8Array {
  const common = {
    basis: implementationLabel,
    implementationVersion,
    runId: state.run.runId,
    stageName: step.stageName,
    warning: "Development proof artifact. This is not real PDF extraction, translation, or recomposition evidence."
  };

  if (artifactType === "INSPECTION_JSON") {
    return jsonBody({
      ...common,
      pageCount: state.document.pageCount ?? 4,
      textBlockCount: state.document.textBlockCount ?? 12,
      imageCount: state.document.imageCount ?? 1,
      scannedPageEstimate: state.document.estimatedScannedPageCount ?? 0
    });
  }

  if (artifactType === "TEXT_LAYOUT_JSON") {
    return jsonBody({
      ...common,
      coordinateSystem: "PDF_POINTS",
      pages: [
        {
          pageNumber: 1,
          width: 612,
          height: 792,
          blocks: [
            {
              blockId: "block_001",
              bbox: { x: 72, y: 72, width: 468, height: 48 },
              kind: "heading",
              textSummary: "controlled Spanish refund and eligibility procedure heading"
            },
            {
              blockId: "block_002",
              bbox: { x: 72, y: 144, width: 468, height: 120 },
              kind: "paragraph",
              textSummary: "controlled Spanish refund, eligibility, chargeback, manual review content"
            }
          ]
        }
      ]
    });
  }

  if (artifactType === "SOURCE_CHUNKS_JSON") {
    return jsonBody({
      ...common,
      chunks: [
        {
          chunkId: "chunk_001",
          blockIds: ["block_001"],
          sourceSummary: "title and process framing"
        },
        {
          chunkId: "chunk_002",
          blockIds: ["block_002"],
          sourceSummary: "refund eligibility and chargeback policy body"
        }
      ],
      glossaryTerms: ["reembolso", "elegibilidad", "contracargo", "revision manual", "caso escalado"]
    });
  }

  if (artifactType === "TRANSLATED_CHUNKS_JSON") {
    return jsonBody({
      ...common,
      chunks: [
        {
          chunkId: "chunk_001",
          translatedSummary: "title and process framing"
        },
        {
          chunkId: "chunk_002",
          translatedSummary: "refund eligibility and chargeback policy body"
        }
      ],
      glossaryBasis: "deterministic PR-011 glossary proof; no model call"
    });
  }

  if (artifactType === "TRANSLATED_PDF") {
    return new TextEncoder().encode(
      "%PDF-1.4\n% PR-011 pre-Gateway proof only. Not a real translated PDF.\n%%EOF\n"
    );
  }

  if (artifactType === "EVALUATION_JSON") {
    return jsonBody({
      ...common,
      score: 0.86,
      passed: true,
      checks: {
        missingChunks: 0,
        terminology: "deterministic proof only",
        pdfArtifactPresent: true
      }
    });
  }

  throw new Error(`Unsupported PR-011 artifact body for ${artifactType}`);
}

function artifactContentType(artifactType: ArtifactType): string {
  return artifactType === "TRANSLATED_PDF" ? "application/pdf" : "application/json";
}

function makeArtifact(state: RunnerState, step: StagePlanStep, artifactType: ArtifactType): StageArtifactOutput {
  const body = artifactBody(state, step, artifactType);
  const artifact: Artifact = {
    workspaceId: state.context.workspaceId,
    artifactId: stableEntityId("art", state.run.runId, step.sequence, artifactType),
    documentId: state.document.documentId,
    jobId: state.job.jobId,
    runId: state.run.runId,
    stageEventId: stageEventId(state.run.runId, step),
    artifactType,
    s3Bucket: state.context.config.artifactBucketName,
    s3Key: outputKey(state, step, artifactType),
    contentType: artifactContentType(artifactType),
    sizeBytes: bytesLength(body),
    sha256: sha256Hex(body),
    ...(artifactType === "TRANSLATED_PDF" ? { language: state.job.targetLanguage } : {}),
    provenance: state.provenance,
    createdAt: state.context.now()
  };

  return { artifact, body };
}

function makeLedgerItem(state: RunnerState, step: StagePlanStep): LedgerItem {
  return {
    workspaceId: state.context.workspaceId,
    ledgerItemId: stableEntityId("led", state.run.runId, step.sequence, step.stageName, "tool"),
    runId: state.run.runId,
    jobId: state.job.jobId,
    documentId: state.document.documentId,
    workflowVariant: state.job.workflowVariant,
    stageName: step.stageName,
    stageSequence: step.sequence,
    componentType: "EXTERNAL_SERVICE",
    componentName: step.toolName,
    billableUnit: "DOCUMENT",
    unitCount: 1,
    unitPriceUsd: 0,
    estimatedCostUsd: 0,
    costSource: "PRICE_BOOK_ESTIMATE",
    toolName: step.toolName,
    priceBookVersion: state.job.priceBookVersion,
    provenance: state.provenance,
    createdAt: state.context.now()
  };
}

function makeEvaluation(state: RunnerState): EvaluationResult {
  return {
    workspaceId: state.context.workspaceId,
    evaluationResultId: stableEntityId("eval", state.run.runId, "pre_gateway"),
    runId: state.run.runId,
    jobId: state.job.jobId,
    documentId: state.document.documentId,
    score: 0.86,
    passed: true,
    semanticCoverageScore: 0.86,
    terminologyScore: 0.9,
    layoutScore: 0.78,
    imageTextHandlingScore: 0,
    untranslatedSpanishCount: 0,
    missingChunkCount: 0,
    layoutWarnings: ["Approximate layout proof only; no real PDF recomposition was performed."],
    terminologyWarnings: [],
    imageWarnings: ["V1 text-only path does not translate image text."],
    notes: "PR-011 pre-Gateway deterministic evaluation proof. This is not business acceptance evidence for real V1 PDF quality.",
    provenance: state.provenance,
    createdAt: state.context.now()
  };
}

function stageEventId(runId: string, step: StagePlanStep): string {
  return stableEntityId("stg", runId, step.sequence, step.stageName);
}

function makeStageEvent(
  state: RunnerState,
  step: StagePlanStep,
  status: StageEventStatus,
  inputArtifactIds: ReadonlyArray<string>,
  outputArtifactIds: ReadonlyArray<string>,
  warnings: ReadonlyArray<string>,
  errorMessage?: string
): StageEvent {
  const now = state.context.now();
  return {
    workspaceId: state.context.workspaceId,
    runId: state.run.runId,
    jobId: state.job.jobId,
    documentId: state.document.documentId,
    stageEventId: stageEventId(state.run.runId, step),
    sequence: step.sequence,
    stageName: step.stageName,
    status,
    toolName: step.toolName,
    inputArtifactIds: [...inputArtifactIds],
    outputArtifactIds: [...outputArtifactIds],
    retryCount: 0,
    startedAt: now,
    ...(status === "RUNNING" ? {} : { durationMs: 0 }),
    ...(status === "RUNNING" ? {} : { completedAt: now }),
    warnings: [...warnings],
    ...(errorMessage === undefined ? {} : { errorMessage }),
    provenance: state.provenance
  };
}

function makeToolOutput(state: RunnerState, step: StagePlanStep): StageToolOutput {
  if (step.statusWhenComplete === "SKIPPED") {
    return {
      artifacts: [],
      ledgerItems: [],
      warnings: ["V1 text-only proof path skips image extraction until PR-014."],
      metrics: {
        skipped: true,
        reason: "V1_TEXT_ONLY"
      }
    };
  }

  const artifacts = step.outputArtifactTypes.map((artifactType) => makeArtifact(state, step, artifactType));
  const ledgerItems = step.stageName === "evaluate_translation" ? [] : [makeLedgerItem(state, step)];
  const evaluation = step.stageName === "evaluate_translation" ? makeEvaluation(state) : undefined;

  return {
    artifacts,
    ledgerItems,
    ...(evaluation === undefined ? {} : { evaluation }),
    warnings: ["Pre-Gateway deterministic proof output; no real Gateway, Bedrock, or PDF processing."],
    metrics: {
      artifactCount: artifacts.length,
      proofOnly: true
    }
  };
}

function validateToolEnvelope(
  state: RunnerState,
  step: StagePlanStep,
  inputArtifacts: ReadonlyArray<ToolInputArtifactReference>,
  output: StageToolOutput
): void {
  FileBearingToolRequestSchema.parse({
    workspaceId: state.context.workspaceId,
    documentId: state.document.documentId,
    jobId: state.job.jobId,
    runId: state.run.runId,
    workflowVariant: state.job.workflowVariant,
    sourceLanguage: state.job.sourceLanguage,
    targetLanguage: state.job.targetLanguage,
    priceBookVersion: state.job.priceBookVersion,
    options: state.job.options,
    stageName: step.stageName,
    inputArtifacts
  });

  ToolResponseBaseSchema.parse({
    status: "SUCCEEDED",
    stageName: step.stageName,
    startedAt: state.context.now(),
    completedAt: state.context.now(),
    durationMs: 0,
    artifacts: output.artifacts.map(({ artifact }) => {
      const { artifactId, createdAt, ...draft } = artifact;
      void artifactId;
      void createdAt;
      return draft;
    }),
    metrics: output.metrics,
    ledgerItems: output.ledgerItems.map((ledgerItem) => {
      const { ledgerItemId, createdAt, ...draft } = ledgerItem;
      void ledgerItemId;
      void createdAt;
      return draft;
    }),
    warnings: output.warnings
  });
}

async function putArtifactIfMissing(state: RunnerState, output: StageArtifactOutput): Promise<void> {
  const existing = await state.context.repositories.artifacts.get(output.artifact.artifactId);
  if (existing !== undefined) {
    return;
  }

  await state.context.artifactObjects.putObject({
    key: output.artifact.s3Key,
    body: output.body,
    contentType: output.artifact.contentType,
    context: {
      workspaceId: state.context.workspaceId,
      documentId: state.document.documentId,
      jobId: state.job.jobId,
      runId: state.run.runId
    }
  });
  await state.context.repositories.artifacts.put(output.artifact);
}

async function putLedgerItemIfMissing(state: RunnerState, ledgerItem: LedgerItem): Promise<void> {
  const existing = await state.context.repositories.ledgerItems.listByRun(state.run.runId);
  if (existing.some((candidate) => candidate.ledgerItemId === ledgerItem.ledgerItemId)) {
    return;
  }

  await state.context.repositories.ledgerItems.put(ledgerItem);
}

async function putEvaluationIfMissing(state: RunnerState, evaluation: EvaluationResult | undefined): Promise<void> {
  if (evaluation === undefined) {
    return;
  }

  const existing = await state.context.repositories.evaluations.listByRun(state.run.runId);
  if (
    existing.some(
      (candidate) => candidate.evaluationResultId === evaluation.evaluationResultId
    )
  ) {
    return;
  }

  await state.context.repositories.evaluations.put(evaluation);
}

async function executeStage(
  state: RunnerState,
  step: StagePlanStep,
  accumulatedInputArtifacts: ReadonlyArray<ToolInputArtifactReference>
): Promise<ReadonlyArray<string>> {
  const existingEvents = await state.context.repositories.stageEvents.listByRun(state.run.runId);
  const existingEvent = existingEvents.find((event) => event.stageEventId === stageEventId(state.run.runId, step));
  if (existingEvent !== undefined && terminalStageStatuses.has(existingEvent.status)) {
    if (existingEvent.status === "FAILED") {
      throw new Error(`Stage ${step.stageName} already failed for run ${state.run.runId}`);
    }

    return existingEvent.outputArtifactIds;
  }

  const inputArtifactIds = accumulatedInputArtifacts.map((artifact) => artifact.artifactId);
  await state.context.repositories.stageEvents.put(
    makeStageEvent(state, step, "RUNNING", inputArtifactIds, [], [])
  );

  try {
    const output = makeToolOutput(state, step);
    validateToolEnvelope(state, step, accumulatedInputArtifacts, output);

    for (const artifact of output.artifacts) {
      await putArtifactIfMissing(state, artifact);
    }
    for (const ledgerItem of output.ledgerItems) {
      await putLedgerItemIfMissing(state, ledgerItem);
    }
    await putEvaluationIfMissing(state, output.evaluation);

    const outputArtifactIds = output.artifacts.map(({ artifact }) => artifact.artifactId);
    await state.context.repositories.stageEvents.put(
      makeStageEvent(
        state,
        step,
        step.statusWhenComplete,
        inputArtifactIds,
        outputArtifactIds,
        output.warnings
      )
    );
    return outputArtifactIds;
  } catch (error) {
    await state.context.repositories.stageEvents.put(
      makeStageEvent(
        state,
        step,
        "FAILED",
        inputArtifactIds,
        [],
        [],
        error instanceof Error ? error.message : "Stage failed"
      )
    );
    throw error;
  }
}

async function putRunStatus(
  context: ControlApiContext,
  run: Run,
  status: Run["status"],
  updates: Partial<Run> = {}
): Promise<Run> {
  if (run.status !== status) {
    assertRunTransition(run.status, status);
  }

  const updatedRun: Run = {
    ...run,
    ...updates,
    status,
    updatedAt: context.now()
  };
  await context.repositories.runs.put(updatedRun);
  return updatedRun;
}

async function putJobStatus(
  context: ControlApiContext,
  job: TranslationJob,
  status: TranslationJob["status"],
  updates: Partial<TranslationJob> = {}
): Promise<TranslationJob> {
  if (job.status !== status) {
    assertJobTransition(job.status, status);
  }

  const updatedJob: TranslationJob = {
    ...job,
    ...updates,
    status,
    updatedAt: context.now()
  };
  await context.repositories.jobs.put(updatedJob);
  return updatedJob;
}

async function failRunAndJob(
  context: ControlApiContext,
  run: Run,
  job: TranslationJob,
  reason: string,
  provenance: ExecutionProvenance
): Promise<void> {
  let failingRun = run;
  if (failingRun.status === "CREATED") {
    failingRun = await putRunStatus(context, failingRun, "QUEUED", { provenance });
  }
  if (failingRun.status === "QUEUED" || failingRun.status === "RUNNING" || failingRun.status === "EVALUATING") {
    failingRun = await putRunStatus(context, failingRun, "FAILED", {
      failureReason: reason,
      completedAt: context.now(),
      provenance
    });
  }

  let failingJob = job;
  if (failingJob.status === "CREATED") {
    failingJob = await putJobStatus(context, failingJob, "RUNNING");
  }
  if (failingJob.status === "RUNNING") {
    await putJobStatus(context, failingJob, "FAILED");
  }
}

async function runPreGatewayStages(
  context: ControlApiContext,
  request: RunExecutionRequest
): Promise<void> {
  if (request.workspaceId !== context.workspaceId) {
    throw new Error("Run execution request workspace does not match the Control API workspace");
  }

  const document = await context.repositories.documents.get(request.documentId);
  const job = await context.repositories.jobs.get(request.jobId);
  const run = await context.repositories.runs.get(request.runId);
  if (document === undefined || job === undefined || run === undefined) {
    throw new Error("Run execution request references missing persisted state");
  }
  const priceBook = await context.repositories.priceBooks.get(job.priceBookVersion);
  if (priceBook === undefined || priceBook.priceBookVersion !== request.priceBookVersion) {
    throw new Error("Run execution request references missing or mismatched price-book state");
  }

  if (job.workflowVariant !== "V1_TEXT_ONLY" || run.workflowVariant !== "V1_TEXT_ONLY") {
    throw new Error("Only V1_TEXT_ONLY pre-Gateway runs are executable in PR-011");
  }

  if (
    run.status === "AWAITING_REVIEW" ||
    run.status === "ACCEPTED" ||
    run.status === "REJECTED" ||
    run.status === "ESCALATED" ||
    run.status === "FAILED"
  ) {
    return;
  }

  const provenance = buildProvenance();
  let currentRun = run;
  let currentJob = job;

  try {
    if (currentRun.status === "CREATED") {
      currentRun = await putRunStatus(context, currentRun, "QUEUED", { provenance });
    }
    if (currentRun.status === "QUEUED") {
      currentRun = await putRunStatus(context, currentRun, "RUNNING", {
        startedAt: currentRun.startedAt ?? context.now(),
        provenance
      });
    }
    if (currentJob.status === "CREATED") {
      currentJob = await putJobStatus(context, currentJob, "RUNNING");
    }

    const state: RunnerState = {
      context,
      document,
      job: currentJob,
      run: currentRun,
      provenance
    };
    const artifactInputs = [sourceInputArtifact(document)];
    for (const step of buildPreGatewayStagePlan(currentRun.workflowVariant)) {
      if (step.stageName === "evaluate_translation" && currentRun.status === "RUNNING") {
        currentRun = await putRunStatus(context, currentRun, "EVALUATING", { provenance });
      }

      const outputArtifactIds = await executeStage(
        { ...state, run: currentRun, job: currentJob },
        step,
        artifactInputs
      );
      for (const artifactId of outputArtifactIds) {
        const artifact = await context.repositories.artifacts.get(artifactId);
        if (artifact !== undefined) {
          artifactInputs.push({
            artifactId: artifact.artifactId,
            artifactType: artifact.artifactType,
            s3Bucket: artifact.s3Bucket,
            s3Key: artifact.s3Key,
            ...(artifact.s3VersionId === undefined ? {} : { s3VersionId: artifact.s3VersionId }),
            ...(artifact.sha256 === undefined ? {} : { sha256: artifact.sha256 })
          });
        }
      }
    }

    const runLedgerItems = await context.repositories.ledgerItems.listByRun(currentRun.runId);
    const runRollup = rollupRunCost(currentRun.runId, runLedgerItems);
    const translatedPdfArtifactId = stableEntityId("art", currentRun.runId, 7, "TRANSLATED_PDF");
    const evaluationResultId = stableEntityId("eval", currentRun.runId, "pre_gateway");
    const finalRun = await putRunStatus(context, currentRun, "AWAITING_REVIEW", {
      translatedPdfArtifactId,
      evaluationResultId,
      llmOnlyCostUsd: runRollup.llmOnlyCostUsd,
      fullWorkflowCostUsd: runRollup.fullWorkflowCostUsd,
      humanReviewCostUsd: runRollup.humanReviewCostUsd,
      retryCostUsd: runRollup.retryCostUsd,
      remediationCostUsd: runRollup.remediationCostUsd,
      warnings: [
        ...currentRun.warnings,
        "PR-011 pre-Gateway development proof. Real AgentCore Runtime, Gateway, Bedrock, and PDF processing are not yet used."
      ],
      provenance
    });

    const runs = (await context.repositories.runs.listByJob(currentJob.jobId)).filter(
      (candidate) => candidate.workspaceId === context.workspaceId
    );
    const jobLedgerItems = (await context.repositories.ledgerItems.listByJob(currentJob.jobId)).filter(
      (candidate) => candidate.workspaceId === context.workspaceId
    );
    const jobForRollup = await putJobStatus(context, currentJob, "AWAITING_REVIEW", {
      latestRunId: finalRun.runId
    });
    const jobRollup = rollupJobEconomics({ job: jobForRollup, runs, ledgerItems: jobLedgerItems });
    await context.repositories.jobs.put({
      ...jobForRollup,
      llmOnlyCostUsd: jobRollup.llmOnlyCostUsd,
      fullWorkflowCostUsd: jobRollup.fullWorkflowCostUsd,
      unitValueUsd: jobRollup.unitValueUsd,
      updatedAt: context.now()
    });
  } catch (error) {
    await failRunAndJob(
      context,
      (await context.repositories.runs.get(request.runId)) ?? run,
      (await context.repositories.jobs.get(request.jobId)) ?? job,
      error instanceof Error ? error.message : "Pre-Gateway stage runner failed",
      provenance
    );
  }
}

export function createPreGatewayAgentRuntimeClient(
  contextProvider: () => ControlApiContext
): AgentRuntimeClient {
  return {
    async invoke(request: RunExecutionRequest): Promise<void> {
      await runPreGatewayStages(contextProvider(), request);
    }
  };
}
