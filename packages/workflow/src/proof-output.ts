import {
  evaluationKey,
  inspectionStageKey,
  sourceChunksKey,
  textLayoutKey,
  translatedChunksKey,
  translatedPdfKey
} from "@agentcore-pdf-translator/data";
import type {
  Artifact,
  ArtifactType,
  Document,
  EvaluationResult,
  ExecutionProvenance,
  LedgerItem,
  Run,
  StageEvent,
  StageEventStatus,
  ToolInputArtifactReference,
  TranslationJob
} from "@agentcore-pdf-translator/schemas";
import { createHash } from "node:crypto";
import type { StagePlanStep } from "./stage-plan.js";

export const agentCoreGatewayImplementationLabel = "PR-012 AgentCore Runtime Gateway proof runner";
export const agentCoreGatewayImplementationVersion = "pr-012.1";

export type ProofStageState = {
  readonly workspaceId: string;
  readonly artifactBucketName: string;
  readonly document: Document;
  readonly job: TranslationJob;
  readonly run: Run;
  readonly provenance: ExecutionProvenance;
};

export type StageArtifactOutput = {
  readonly artifact: Artifact;
  readonly body: string | Uint8Array;
};

export type ProofStageOutput = {
  readonly artifacts: ReadonlyArray<StageArtifactOutput>;
  readonly ledgerItems: ReadonlyArray<LedgerItem>;
  readonly evaluation?: EvaluationResult;
  readonly warnings: ReadonlyArray<string>;
  readonly metrics: Readonly<Record<string, number | string | boolean>>;
};

export function stableWorkflowEntityId(
  prefix: "art" | "eval" | "led" | "stg",
  ...parts: ReadonlyArray<string | number>
): string {
  const suffix = parts
    .map((part) => String(part).replace(/[^A-Za-z0-9]+/gu, "_").replace(/^_+|_+$/gu, ""))
    .filter((part) => part.length > 0)
    .join("_")
    .toLowerCase();
  return `${prefix}_${suffix}`;
}

export function stageEventId(runId: string, step: StagePlanStep): string {
  return stableWorkflowEntityId("stg", runId, step.sequence, step.stageName);
}

export function sourceInputArtifact(document: Document): ToolInputArtifactReference {
  return {
    artifactId: document.sourcePdfArtifactId,
    artifactType: "SOURCE_PDF",
    s3Bucket: document.sourcePdfS3Bucket,
    s3Key: document.sourcePdfS3Key,
    ...(document.sourcePdfS3VersionId === undefined ? {} : { s3VersionId: document.sourcePdfS3VersionId }),
    sha256: document.sha256
  };
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

function outputKey(state: ProofStageState, step: StagePlanStep, artifactType: ArtifactType): string {
  const base = {
    workspaceId: state.workspaceId,
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

  throw new Error(`Unsupported PR-012 proof artifact type for ${step.stageName}: ${artifactType}`);
}

function artifactBody(state: ProofStageState, step: StagePlanStep, artifactType: ArtifactType): string | Uint8Array {
  const common = {
    basis: agentCoreGatewayImplementationLabel,
    implementationVersion: agentCoreGatewayImplementationVersion,
    runId: state.run.runId,
    stageName: step.stageName,
    warning: "Gateway proof artifact. This is not real PDF extraction, translation, or recomposition evidence."
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
      glossaryBasis: "deterministic PR-012 Gateway proof; no model call"
    });
  }

  if (artifactType === "TRANSLATED_PDF") {
    return new TextEncoder().encode(
      "%PDF-1.4\n% PR-012 Gateway proof only. Not a real translated PDF.\n%%EOF\n"
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

  throw new Error(`Unsupported PR-012 proof artifact body for ${artifactType}`);
}

function artifactContentType(artifactType: ArtifactType): string {
  return artifactType === "TRANSLATED_PDF" ? "application/pdf" : "application/json";
}

export function makeProofArtifact(
  state: ProofStageState,
  step: StagePlanStep,
  artifactType: ArtifactType,
  now: string
): StageArtifactOutput {
  const body = artifactBody(state, step, artifactType);
  const artifact: Artifact = {
    workspaceId: state.workspaceId,
    artifactId: stableWorkflowEntityId("art", state.run.runId, step.sequence, artifactType),
    documentId: state.document.documentId,
    jobId: state.job.jobId,
    runId: state.run.runId,
    stageEventId: stageEventId(state.run.runId, step),
    artifactType,
    s3Bucket: state.artifactBucketName,
    s3Key: outputKey(state, step, artifactType),
    contentType: artifactContentType(artifactType),
    sizeBytes: bytesLength(body),
    sha256: sha256Hex(body),
    ...(artifactType === "TRANSLATED_PDF" ? { language: state.job.targetLanguage } : {}),
    provenance: state.provenance,
    createdAt: now
  };

  return { artifact, body };
}

export function makeProofLedgerItem(
  state: ProofStageState,
  step: StagePlanStep,
  now: string
): LedgerItem {
  return {
    workspaceId: state.workspaceId,
    ledgerItemId: stableWorkflowEntityId("led", state.run.runId, step.sequence, step.stageName, "gateway_tool"),
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
    gatewayOperations: 1,
    priceBookVersion: state.job.priceBookVersion,
    provenance: state.provenance,
    createdAt: now
  };
}

export function makeProofEvaluation(state: ProofStageState, now: string): EvaluationResult {
  return {
    workspaceId: state.workspaceId,
    evaluationResultId: stableWorkflowEntityId("eval", state.run.runId, "gateway"),
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
    notes: "PR-012 Gateway deterministic evaluation proof. This is not business acceptance evidence for real V1 PDF quality.",
    provenance: state.provenance,
    createdAt: now
  };
}

export function makeProofStageEvent(
  state: ProofStageState,
  step: StagePlanStep,
  status: StageEventStatus,
  inputArtifactIds: ReadonlyArray<string>,
  outputArtifactIds: ReadonlyArray<string>,
  warnings: ReadonlyArray<string>,
  now: string,
  errorMessage?: string
): StageEvent {
  return {
    workspaceId: state.workspaceId,
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

export function makeProofToolOutput(
  state: ProofStageState,
  step: StagePlanStep,
  now: string
): ProofStageOutput {
  if (step.statusWhenComplete === "SKIPPED") {
    return {
      artifacts: [],
      ledgerItems: [],
      warnings: ["V1 text-only Gateway proof path skips image extraction until PR-014."],
      metrics: {
        skipped: true,
        reason: "V1_TEXT_ONLY",
        gatewayProof: true
      }
    };
  }

  const artifacts = step.outputArtifactTypes.map((artifactType) =>
    makeProofArtifact(state, step, artifactType, now)
  );
  const ledgerItems = step.stageName === "evaluate_translation" ? [] : [makeProofLedgerItem(state, step, now)];
  const evaluation = step.stageName === "evaluate_translation" ? makeProofEvaluation(state, now) : undefined;

  return {
    artifacts,
    ledgerItems,
    ...(evaluation === undefined ? {} : { evaluation }),
    warnings: ["AgentCore Gateway deterministic proof output; no Bedrock model or real PDF processing."],
    metrics: {
      artifactCount: artifacts.length,
      gatewayProof: true
    }
  };
}
