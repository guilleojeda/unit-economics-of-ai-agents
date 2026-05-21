import {
  assertJobTransition,
  assertRunTransition
} from "@agentcore-pdf-translator/data";
import {
  createPersistentRepositories,
  type PersistentRepositories
} from "@agentcore-pdf-translator/data/persistent";
import {
  rollupJobEconomics,
  rollupRunCost
} from "@agentcore-pdf-translator/costing";
import {
  GatewayFileToolRequestSchema,
  type Document,
  type ExecutionProvenance,
  type Run,
  type ToolInputArtifactReference,
  type TranslationJob,
  type WorkflowVariant
} from "@agentcore-pdf-translator/schemas";
import {
  agentCoreGatewayImplementationLabel,
  agentCoreGatewayImplementationVersion,
  buildGatewayStagePlan,
  sourceInputArtifact,
  stableWorkflowEntityId
} from "@agentcore-pdf-translator/workflow";
import { createGatewayClient, type GatewayClient } from "./gateway-client.js";

export type RuntimeRunExecutionRequest = {
  readonly workspaceId: string;
  readonly documentId: string;
  readonly jobId: string;
  readonly runId: string;
  readonly workflowVariant: WorkflowVariant;
  readonly priceBookVersion: string;
  readonly validationRunId?: string;
  readonly runtimeSessionId?: string;
};

export type RuntimeExecutionOptions = {
  readonly request: RuntimeRunExecutionRequest;
  readonly runtimeSessionId: string;
  readonly gatewayClient?: GatewayClient;
};

let cachedRepositories: PersistentRepositories | undefined;

function env(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required AgentCore Runtime configuration: ${name}`);
  }

  return value;
}

function optionalEnv(...names: ReadonlyArray<string>): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function now(): string {
  return new Date().toISOString();
}

function repositories(): PersistentRepositories {
  if (cachedRepositories !== undefined) {
    return cachedRepositories;
  }

  cachedRepositories = createPersistentRepositories({
    config: {
      region: "us-east-1",
      artifactBucketName: env("ARTIFACT_BUCKET"),
      tableNames: {
        documents: env("DOCUMENTS_TABLE"),
        translationJobs: env("TRANSLATION_JOBS_TABLE"),
        runs: env("RUNS_TABLE"),
        stageEvents: env("STAGE_EVENTS_TABLE"),
        artifacts: env("ARTIFACTS_TABLE"),
        ledgerItems: env("LEDGER_ITEMS_TABLE"),
        evaluationResults: env("EVALUATION_RESULTS_TABLE"),
        reviewDecisions: env("REVIEW_DECISIONS_TABLE"),
        priceBooks: env("PRICE_BOOKS_TABLE"),
        appSettings: env("APP_SETTINGS_TABLE")
      }
    }
  });
  return cachedRepositories;
}

function baseProvenance(request: RuntimeRunExecutionRequest, runtimeSessionId: string): ExecutionProvenance {
  return {
    executionBackend: "AGENTCORE_RUNTIME_GATEWAY",
    implementationLabel: agentCoreGatewayImplementationLabel,
    implementationVersion: agentCoreGatewayImplementationVersion,
    ...(optionalEnv("DEPLOYED_COMMIT_SHA", "GITHUB_SHA", "COMMIT_SHA", "BUILD_SHA") === undefined
      ? {}
      : { commitSha: optionalEnv("DEPLOYED_COMMIT_SHA", "GITHUB_SHA", "COMMIT_SHA", "BUILD_SHA") }),
    ...(optionalEnv("DEPLOY_ARTIFACT_ID", "GITHUB_RUN_ID", "BUILD_ID") === undefined
      ? {}
      : { buildId: optionalEnv("DEPLOY_ARTIFACT_ID", "GITHUB_RUN_ID", "BUILD_ID") }),
    stage: env("STAGE"),
    region: "us-east-1",
    ...(optionalEnv("AWS_ACCOUNT_ID", "CDK_DEFAULT_ACCOUNT") === undefined
      ? {}
      : { awsAccountId: optionalEnv("AWS_ACCOUNT_ID", "CDK_DEFAULT_ACCOUNT") }),
    ...(optionalEnv("DEPLOY_ARTIFACT_OBJECT_KEY") === undefined
      ? {}
      : { deployArtifactId: optionalEnv("DEPLOY_ARTIFACT_OBJECT_KEY") }),
    ...(request.validationRunId === undefined ? {} : { validationRunId: request.validationRunId }),
    ...(optionalEnv("AGENTCORE_RUNTIME_ARN") === undefined
      ? {}
      : { agentRuntimeArn: optionalEnv("AGENTCORE_RUNTIME_ARN") }),
    ...(optionalEnv("AGENTCORE_RUNTIME_ENDPOINT_ARN") === undefined
      ? {}
      : { agentRuntimeEndpointArn: optionalEnv("AGENTCORE_RUNTIME_ENDPOINT_ARN") }),
    agentRuntimeQualifier: env("AGENTCORE_RUNTIME_QUALIFIER"),
    agentRuntimeSessionId: runtimeSessionId,
    ...(optionalEnv("AGENTCORE_RUNTIME_IMAGE_URI") === undefined
      ? {}
      : { runtimeImageUri: optionalEnv("AGENTCORE_RUNTIME_IMAGE_URI") }),
    ...(optionalEnv("AGENTCORE_RUNTIME_IMAGE_DIGEST") === undefined
      ? {}
      : { runtimeImageDigest: optionalEnv("AGENTCORE_RUNTIME_IMAGE_DIGEST") }),
    strandsAgentVersion: optionalEnv("STRANDS_AGENT_VERSION") ?? "typescript-strands-layer",
    gatewayId: env("AGENTCORE_GATEWAY_ID"),
    gatewayUrl: env("AGENTCORE_GATEWAY_URL"),
    gatewayTargetVersion: env("AGENTCORE_GATEWAY_TARGET_VERSION")
  };
}

async function putRunStatus(
  persistent: PersistentRepositories,
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
    updatedAt: now()
  };
  await persistent.runs.put(updatedRun);
  return updatedRun;
}

async function putJobStatus(
  persistent: PersistentRepositories,
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
    updatedAt: now()
  };
  await persistent.translationJobs.put(updatedJob);
  return updatedJob;
}

async function failRunAndJob(
  persistent: PersistentRepositories,
  run: Run,
  job: TranslationJob,
  reason: string,
  provenance: ExecutionProvenance
): Promise<void> {
  let failingRun = run;
  if (failingRun.status === "CREATED") {
    failingRun = await putRunStatus(persistent, failingRun, "QUEUED", { provenance });
  }
  if (failingRun.status === "QUEUED" || failingRun.status === "RUNNING" || failingRun.status === "EVALUATING") {
    failingRun = await putRunStatus(persistent, failingRun, "FAILED", {
      failureReason: reason,
      completedAt: now(),
      provenance
    });
  }

  let failingJob = job;
  if (failingJob.status === "CREATED") {
    failingJob = await putJobStatus(persistent, failingJob, "RUNNING");
  }
  if (failingJob.status === "RUNNING") {
    await putJobStatus(persistent, failingJob, "FAILED");
  }
}

function requireState(
  request: RuntimeRunExecutionRequest,
  document: Document | undefined,
  job: TranslationJob | undefined,
  run: Run | undefined
): { readonly document: Document; readonly job: TranslationJob; readonly run: Run } {
  if (document === undefined || job === undefined || run === undefined) {
    throw new Error("Runtime request references missing persisted state");
  }
  if (
    document.workspaceId !== request.workspaceId ||
    job.workspaceId !== request.workspaceId ||
    run.workspaceId !== request.workspaceId
  ) {
    throw new Error("Runtime request workspace does not match persisted state");
  }
  if (job.workflowVariant !== "V1_TEXT_ONLY" || run.workflowVariant !== "V1_TEXT_ONLY") {
    throw new Error("Only V1_TEXT_ONLY AgentCore Runtime runs are executable in PR-012");
  }

  return { document, job, run };
}

function outputArtifactReference(
  artifact: Awaited<ReturnType<PersistentRepositories["artifacts"]["get"]>>
): ToolInputArtifactReference | undefined {
  if (artifact === undefined) {
    return undefined;
  }

  return {
    artifactId: artifact.artifactId,
    artifactType: artifact.artifactType,
    s3Bucket: artifact.s3Bucket,
    s3Key: artifact.s3Key,
    ...(artifact.s3VersionId === undefined ? {} : { s3VersionId: artifact.s3VersionId }),
    ...(artifact.sha256 === undefined ? {} : { sha256: artifact.sha256 })
  };
}

export async function executeRuntimeRun(options: RuntimeExecutionOptions): Promise<void> {
  const persistent = repositories();
  const request = options.request;
  if (request.workspaceId !== env("WORKSPACE_ID")) {
    throw new Error("Runtime request workspace does not match deployed workspace");
  }

  const document = await persistent.documents.get(request.documentId);
  const job = await persistent.translationJobs.get(request.jobId);
  const run = await persistent.runs.get(request.runId);
  const state = requireState(request, document, job, run);
  const priceBook = await persistent.priceBooks.get(state.job.priceBookVersion);
  if (priceBook === undefined || priceBook.priceBookVersion !== request.priceBookVersion) {
    throw new Error("Runtime request references missing or mismatched price book");
  }

  if (
    state.run.status === "AWAITING_REVIEW" ||
    state.run.status === "ACCEPTED" ||
    state.run.status === "REJECTED" ||
    state.run.status === "ESCALATED" ||
    state.run.status === "FAILED"
  ) {
    return;
  }

  const gatewayClient = options.gatewayClient ?? createGatewayClient({ gatewayUrl: env("AGENTCORE_GATEWAY_URL") });
  const provenance = baseProvenance(request, options.runtimeSessionId);
  let currentRun = state.run;
  let currentJob = state.job;

  try {
    if (currentRun.status === "CREATED") {
      currentRun = await putRunStatus(persistent, currentRun, "QUEUED", {
        agentRuntimeSessionId: options.runtimeSessionId,
        provenance
      });
    }
    if (currentRun.status === "QUEUED") {
      currentRun = await putRunStatus(persistent, currentRun, "RUNNING", {
        startedAt: currentRun.startedAt ?? now(),
        agentRuntimeSessionId: options.runtimeSessionId,
        provenance
      });
    }
    if (currentJob.status === "CREATED") {
      currentJob = await putJobStatus(persistent, currentJob, "RUNNING");
    }

    const artifactInputs = [sourceInputArtifact(state.document)];
    for (const step of buildGatewayStagePlan(currentRun.workflowVariant)) {
      if (step.stageName === "evaluate_translation" && currentRun.status === "RUNNING") {
        currentRun = await putRunStatus(persistent, currentRun, "EVALUATING", { provenance });
      }
      if (step.gatewayTargetName === undefined || step.gatewayToolName === undefined) {
        throw new Error(`Gateway target is missing for stage ${step.stageName}`);
      }

      const toolInvocationId = `${currentRun.runId}:${step.sequence}:${step.stageName}`;
      const stageProvenance: ExecutionProvenance = {
        ...provenance,
        gatewayTargetName: step.gatewayTargetName,
        toolInvocationId
      };
      const toolRequest = GatewayFileToolRequestSchema.parse({
        workspaceId: request.workspaceId,
        documentId: state.document.documentId,
        jobId: currentJob.jobId,
        runId: currentRun.runId,
        workflowVariant: currentRun.workflowVariant,
        sourceLanguage: currentJob.sourceLanguage,
        targetLanguage: currentJob.targetLanguage,
        priceBookVersion: currentJob.priceBookVersion,
        options: currentJob.options,
        stageName: step.stageName,
        inputArtifacts: artifactInputs,
        invocation: {
          runtimeSessionId: options.runtimeSessionId,
          toolInvocationId,
          idempotencyKey: toolInvocationId,
          ...(request.validationRunId === undefined ? {} : { validationRunId: request.validationRunId })
        },
        provenance: stageProvenance
      });
      const toolResponse = await gatewayClient.callTool(
        toolRequest,
        step.gatewayTargetName,
        step.gatewayToolName
      );

      for (const output of toolResponse.outputArtifacts) {
        artifactInputs.push(output);
      }

      const outputArtifactRefs = await Promise.all(
        toolResponse.outputArtifacts.map((artifact) => persistent.artifacts.get(artifact.artifactId))
      );
      for (const artifactRef of outputArtifactRefs.map(outputArtifactReference)) {
        if (artifactRef !== undefined && !artifactInputs.some((artifact) => artifact.artifactId === artifactRef.artifactId)) {
          artifactInputs.push(artifactRef);
        }
      }
    }

    const runLedgerItems = await persistent.ledgerItems.listByRun(currentRun.runId);
    const runRollup = rollupRunCost(currentRun.runId, runLedgerItems);
    const finalRun = await putRunStatus(persistent, currentRun, "AWAITING_REVIEW", {
      translatedPdfArtifactId: stableWorkflowEntityId("art", currentRun.runId, 7, "TRANSLATED_PDF"),
      evaluationResultId: stableWorkflowEntityId("eval", currentRun.runId, "gateway"),
      llmOnlyCostUsd: runRollup.llmOnlyCostUsd,
      fullWorkflowCostUsd: runRollup.fullWorkflowCostUsd,
      humanReviewCostUsd: runRollup.humanReviewCostUsd,
      retryCostUsd: runRollup.retryCostUsd,
      remediationCostUsd: runRollup.remediationCostUsd,
      warnings: [
        ...currentRun.warnings,
        "PR-012 AgentCore Runtime and Gateway proof. Real Bedrock translation and PDF recomposition are deferred to PR-013."
      ],
      provenance
    });

    const runs = (await persistent.runs.listByJob(currentJob.jobId)).filter(
      (candidate) => candidate.workspaceId === request.workspaceId
    );
    const jobLedgerItems = (await persistent.ledgerItems.listByJob(currentJob.jobId)).filter(
      (candidate) => candidate.workspaceId === request.workspaceId
    );
    const jobForRollup = await putJobStatus(persistent, currentJob, "AWAITING_REVIEW", {
      latestRunId: finalRun.runId
    });
    const jobRollup = rollupJobEconomics({ job: jobForRollup, runs, ledgerItems: jobLedgerItems });
    await persistent.translationJobs.put({
      ...jobForRollup,
      llmOnlyCostUsd: jobRollup.llmOnlyCostUsd,
      fullWorkflowCostUsd: jobRollup.fullWorkflowCostUsd,
      unitValueUsd: jobRollup.unitValueUsd,
      updatedAt: now()
    });
  } catch (error) {
    await failRunAndJob(
      persistent,
      (await persistent.runs.get(request.runId)) ?? currentRun,
      (await persistent.translationJobs.get(request.jobId)) ?? currentJob,
      error instanceof Error ? error.message : "AgentCore Runtime Gateway execution failed",
      provenance
    );
    throw error;
  }
}
