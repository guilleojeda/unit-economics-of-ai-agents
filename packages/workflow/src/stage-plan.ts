import type {
  ArtifactType,
  StageName,
  WorkflowVariant
} from "@agentcore-pdf-translator/schemas";

export type StagePlanStep = {
  readonly sequence: number;
  readonly stageName: StageName;
  readonly toolName: string;
  readonly gatewayTargetName?: string;
  readonly gatewayToolName?: string;
  readonly outputArtifactTypes: ReadonlyArray<ArtifactType>;
  readonly statusWhenComplete: "SUCCEEDED" | "SKIPPED";
};

const v1PreGatewayStagePlan = [
  {
    sequence: 1,
    stageName: "inspect_pdf",
    toolName: "pre_gateway.inspect_pdf",
    outputArtifactTypes: ["INSPECTION_JSON"],
    statusWhenComplete: "SUCCEEDED"
  },
  {
    sequence: 2,
    stageName: "extract_text_layout",
    toolName: "pre_gateway.extract_text_layout",
    outputArtifactTypes: ["TEXT_LAYOUT_JSON"],
    statusWhenComplete: "SUCCEEDED"
  },
  {
    sequence: 3,
    stageName: "extract_images",
    toolName: "pre_gateway.extract_images",
    outputArtifactTypes: [],
    statusWhenComplete: "SKIPPED"
  },
  {
    sequence: 4,
    stageName: "chunk_and_align",
    toolName: "pre_gateway.chunk_and_align",
    outputArtifactTypes: ["SOURCE_CHUNKS_JSON"],
    statusWhenComplete: "SUCCEEDED"
  },
  {
    sequence: 5,
    stageName: "translate_text_chunks",
    toolName: "pre_gateway.translate_text_chunks",
    outputArtifactTypes: ["TRANSLATED_CHUNKS_JSON"],
    statusWhenComplete: "SUCCEEDED"
  },
  {
    sequence: 7,
    stageName: "recompose_pdf",
    toolName: "pre_gateway.recompose_pdf",
    outputArtifactTypes: ["TRANSLATED_PDF"],
    statusWhenComplete: "SUCCEEDED"
  },
  {
    sequence: 8,
    stageName: "evaluate_translation",
    toolName: "pre_gateway.evaluate_translation",
    outputArtifactTypes: ["EVALUATION_JSON"],
    statusWhenComplete: "SUCCEEDED"
  }
] as const satisfies ReadonlyArray<StagePlanStep>;

const v1GatewayStagePlan = [
  {
    sequence: 1,
    stageName: "inspect_pdf",
    toolName: "pdf_pipeline.inspect_pdf",
    gatewayTargetName: "pdf-pipeline",
    gatewayToolName: "inspect_pdf",
    outputArtifactTypes: ["INSPECTION_JSON"],
    statusWhenComplete: "SUCCEEDED"
  },
  {
    sequence: 2,
    stageName: "extract_text_layout",
    toolName: "pdf_pipeline.extract_text_layout",
    gatewayTargetName: "pdf-pipeline",
    gatewayToolName: "extract_text_layout",
    outputArtifactTypes: ["TEXT_LAYOUT_JSON"],
    statusWhenComplete: "SUCCEEDED"
  },
  {
    sequence: 3,
    stageName: "extract_images",
    toolName: "pdf_pipeline.extract_images",
    gatewayTargetName: "pdf-pipeline",
    gatewayToolName: "extract_images",
    outputArtifactTypes: [],
    statusWhenComplete: "SKIPPED"
  },
  {
    sequence: 4,
    stageName: "chunk_and_align",
    toolName: "pdf_pipeline.chunk_and_align",
    gatewayTargetName: "pdf-pipeline",
    gatewayToolName: "chunk_and_align",
    outputArtifactTypes: ["SOURCE_CHUNKS_JSON"],
    statusWhenComplete: "SUCCEEDED"
  },
  {
    sequence: 5,
    stageName: "translate_text_chunks",
    toolName: "translation.translate_text_chunks",
    gatewayTargetName: "translation",
    gatewayToolName: "translate_text_chunks",
    outputArtifactTypes: ["TRANSLATED_CHUNKS_JSON"],
    statusWhenComplete: "SUCCEEDED"
  },
  {
    sequence: 7,
    stageName: "recompose_pdf",
    toolName: "pdf_pipeline.recompose_pdf",
    gatewayTargetName: "pdf-pipeline",
    gatewayToolName: "recompose_pdf",
    outputArtifactTypes: ["TRANSLATED_PDF"],
    statusWhenComplete: "SUCCEEDED"
  },
  {
    sequence: 8,
    stageName: "evaluate_translation",
    toolName: "evaluation.evaluate_translation",
    gatewayTargetName: "evaluation",
    gatewayToolName: "evaluate_translation",
    outputArtifactTypes: ["EVALUATION_JSON"],
    statusWhenComplete: "SUCCEEDED"
  }
] as const satisfies ReadonlyArray<StagePlanStep>;

export function buildPreGatewayStagePlan(
  workflowVariant: WorkflowVariant
): ReadonlyArray<StagePlanStep> {
  if (workflowVariant !== "V1_TEXT_ONLY") {
    return [];
  }

  return v1PreGatewayStagePlan;
}

export function buildGatewayStagePlan(
  workflowVariant: WorkflowVariant
): ReadonlyArray<StagePlanStep> {
  if (workflowVariant !== "V1_TEXT_ONLY") {
    return [];
  }

  return v1GatewayStagePlan;
}

export function findGatewayStagePlanStep(
  workflowVariant: WorkflowVariant,
  stageName: StageName
): StagePlanStep | undefined {
  return buildGatewayStagePlan(workflowVariant).find((step) => step.stageName === stageName);
}
