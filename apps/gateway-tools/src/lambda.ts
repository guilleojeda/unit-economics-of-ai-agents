import {
  createPersistentRepositories,
  type PersistentRepositories
} from "@agentcore-pdf-translator/data/persistent";
import {
  GatewayFileToolRequestSchema,
  GatewayToolResponseSchema,
  ToolResponseBaseSchema,
  type Artifact,
  type GatewayFileToolRequest,
  type GatewayToolResponse,
  type LedgerItem,
  type StageEventStatus,
  type ToolInputArtifactReference
} from "@agentcore-pdf-translator/schemas";
import {
  findGatewayStagePlanStep,
  makeProofStageEvent,
  makeProofToolOutput,
  normalizeGatewayToolName,
  stageEventId,
  type ProofStageState
} from "@agentcore-pdf-translator/workflow";

type LambdaClientContext = {
  readonly custom?: Readonly<Record<string, string | undefined>>;
};

type LambdaContext = {
  readonly awsRequestId?: string;
  readonly invokedFunctionArn?: string;
  readonly functionName?: string;
  readonly functionVersion?: string;
  readonly clientContext?: LambdaClientContext;
};

const terminalStageStatuses = new Set<StageEventStatus>(["SUCCEEDED", "FAILED", "SKIPPED"]);
let cachedRepositories: PersistentRepositories | undefined;

function env(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required Gateway tool configuration: ${name}`);
  }

  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value.length === 0 ? undefined : value;
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

function artifactReference(artifact: Artifact): ToolInputArtifactReference {
  return {
    artifactId: artifact.artifactId,
    artifactType: artifact.artifactType,
    s3Bucket: artifact.s3Bucket,
    s3Key: artifact.s3Key,
    ...(artifact.s3VersionId === undefined ? {} : { s3VersionId: artifact.s3VersionId }),
    ...(artifact.sha256 === undefined ? {} : { sha256: artifact.sha256 })
  };
}

function artifactDraft(artifact: Artifact): Omit<Artifact, "artifactId" | "createdAt"> {
  const { artifactId: _artifactId, createdAt: _createdAt, ...draft } = artifact;
  return draft;
}

function ledgerDraft(ledgerItem: LedgerItem): Omit<LedgerItem, "ledgerItemId" | "createdAt"> {
  const { ledgerItemId: _ledgerItemId, createdAt: _createdAt, ...draft } = ledgerItem;
  return draft;
}

function toolNameFromContext(context: LambdaContext): string | undefined {
  return context.clientContext?.custom?.bedrockAgentCoreToolName;
}

async function stateForRequest(
  persistent: PersistentRepositories,
  request: GatewayFileToolRequest,
  context: LambdaContext
): Promise<ProofStageState> {
  const document = await persistent.documents.get(request.documentId);
  const job = await persistent.translationJobs.get(request.jobId);
  const run = await persistent.runs.get(request.runId);
  if (document === undefined || job === undefined || run === undefined) {
    throw new Error("Gateway tool request references missing persisted document, job, or run");
  }

  const normalizedToolName = normalizeGatewayToolName(
    toolNameFromContext(context) ?? request.stageName
  );
  const step = findGatewayStagePlanStep(request.workflowVariant, request.stageName);
  if (step === undefined || step.gatewayToolName !== normalizedToolName) {
    throw new Error("Gateway tool name does not match the requested workflow stage");
  }

  return {
    workspaceId: request.workspaceId,
    artifactBucketName: env("ARTIFACT_BUCKET"),
    document,
    job,
    run,
    provenance: {
      ...request.provenance,
      gatewayInvocationId:
        request.invocation.gatewayInvocationId ??
        context.clientContext?.custom?.bedrockAgentCoreMcpMessageId ??
        context.awsRequestId,
      toolInvocationId: request.invocation.toolInvocationId,
      toolLambdaName: context.functionName ?? optionalEnv("AWS_LAMBDA_FUNCTION_NAME"),
      toolLambdaVersion: context.functionVersion ?? optionalEnv("AWS_LAMBDA_FUNCTION_VERSION"),
      ...(optionalEnv("TOOL_LAMBDA_ALIAS") === undefined
        ? {}
        : { toolLambdaAlias: optionalEnv("TOOL_LAMBDA_ALIAS") })
    }
  };
}

async function putArtifactIfMissing(
  persistent: PersistentRepositories,
  state: ProofStageState,
  output: { readonly artifact: Artifact; readonly body: string | Uint8Array }
): Promise<void> {
  const existing = await persistent.artifacts.get(output.artifact.artifactId);
  if (existing !== undefined) {
    return;
  }

  await persistent.artifactObjects.putObject({
    key: output.artifact.s3Key,
    body: output.body,
    contentType: output.artifact.contentType,
    context: {
      workspaceId: state.workspaceId,
      documentId: state.document.documentId,
      jobId: state.job.jobId,
      runId: state.run.runId
    }
  });
  await persistent.artifacts.put(output.artifact);
}

async function putLedgerIfMissing(
  persistent: PersistentRepositories,
  runId: string,
  ledgerItem: LedgerItem
): Promise<void> {
  const existing = await persistent.ledgerItems.listByRun(runId);
  if (existing.some((candidate) => candidate.ledgerItemId === ledgerItem.ledgerItemId)) {
    return;
  }

  await persistent.ledgerItems.put(ledgerItem);
}

async function gatewayToolResponse(
  persistent: PersistentRepositories,
  request: GatewayFileToolRequest,
  context: LambdaContext
): Promise<GatewayToolResponse> {
  const state = await stateForRequest(persistent, request, context);
  const step = findGatewayStagePlanStep(request.workflowVariant, request.stageName);
  if (step === undefined) {
    throw new Error(`No Gateway stage plan step exists for ${request.stageName}`);
  }

  const existingEvents = await persistent.stageEvents.listByRun(request.runId);
  const existingEvent = existingEvents.find((event) => event.stageEventId === stageEventId(request.runId, step));
  if (existingEvent !== undefined && terminalStageStatuses.has(existingEvent.status)) {
    const artifacts = await Promise.all(
      existingEvent.outputArtifactIds.map((artifactId) => persistent.artifacts.get(artifactId))
    );
    const outputArtifacts = artifacts.filter((artifact): artifact is Artifact => artifact !== undefined);
    return GatewayToolResponseSchema.parse({
      status: existingEvent.status,
      stageName: request.stageName,
      startedAt: existingEvent.startedAt ?? now(),
      completedAt: existingEvent.completedAt ?? now(),
      durationMs: existingEvent.durationMs ?? 0,
      artifacts: outputArtifacts.map(artifactDraft),
      metrics: {
        idempotentReplay: true
      },
      ledgerItems: [],
      warnings: existingEvent.warnings,
      invocation: request.invocation,
      provenance: state.provenance,
      outputArtifacts: outputArtifacts.map(artifactReference)
    });
  }

  const startedAt = now();
  const inputArtifactIds = request.inputArtifacts.map((artifact) => artifact.artifactId);
  await persistent.stageEvents.put(
    makeProofStageEvent(state, step, "RUNNING", inputArtifactIds, [], [], startedAt)
  );

  try {
    const completedAt = now();
    const output = makeProofToolOutput(state, step, completedAt);
    for (const artifact of output.artifacts) {
      await putArtifactIfMissing(persistent, state, artifact);
    }
    for (const ledgerItem of output.ledgerItems) {
      await putLedgerIfMissing(persistent, request.runId, ledgerItem);
    }
    if (output.evaluation !== undefined) {
      const existingEvaluations = await persistent.evaluationResults.listByRun(request.runId);
      if (
        !existingEvaluations.some(
          (candidate) => candidate.evaluationResultId === output.evaluation?.evaluationResultId
        )
      ) {
        await persistent.evaluationResults.put(output.evaluation);
      }
    }

    const outputArtifactIds = output.artifacts.map(({ artifact }) => artifact.artifactId);
    await persistent.stageEvents.put(
      makeProofStageEvent(
        state,
        step,
        step.statusWhenComplete,
        inputArtifactIds,
        outputArtifactIds,
        output.warnings,
        completedAt
      )
    );

    return GatewayToolResponseSchema.parse({
      status: step.statusWhenComplete,
      stageName: request.stageName,
      startedAt,
      completedAt,
      durationMs: 0,
      artifacts: output.artifacts.map(({ artifact }) => artifactDraft(artifact)),
      metrics: output.metrics,
      ledgerItems: output.ledgerItems.map(ledgerDraft),
      warnings: output.warnings,
      invocation: request.invocation,
      provenance: state.provenance,
      outputArtifacts: output.artifacts.map(({ artifact }) => artifactReference(artifact))
    });
  } catch (error) {
    await persistent.stageEvents.put(
      makeProofStageEvent(
        state,
        step,
        "FAILED",
        inputArtifactIds,
        [],
        [],
        now(),
        error instanceof Error ? error.message : "Gateway tool failed"
      )
    );
    throw error;
  }
}

export async function handler(event: unknown, context: LambdaContext = {}): Promise<GatewayToolResponse> {
  const request = GatewayFileToolRequestSchema.parse(event);
  const response = await gatewayToolResponse(repositories(), request, context);
  ToolResponseBaseSchema.parse(response);
  console.log(
    JSON.stringify({
      runId: request.runId,
      stageName: request.stageName,
      toolInvocationId: request.invocation.toolInvocationId,
      gatewayInvocationId: response.provenance.gatewayInvocationId ?? null,
      lambdaRequestId: context.awsRequestId ?? null,
      status: response.status
    })
  );
  return response;
}
