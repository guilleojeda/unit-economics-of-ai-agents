import { describe, expect, it } from "vitest";
import {
  buildGatewayStagePlan,
  normalizeGatewayToolName,
  stableWorkflowEntityId
} from "../src/index.js";

describe("AgentCore Gateway workflow helpers", () => {
  it("builds the V1 Gateway stage plan with target-scoped tool names", () => {
    const plan = buildGatewayStagePlan("V1_TEXT_ONLY");

    expect(plan.map((step) => step.stageName)).toEqual([
      "inspect_pdf",
      "extract_text_layout",
      "extract_images",
      "chunk_and_align",
      "translate_text_chunks",
      "recompose_pdf",
      "evaluate_translation"
    ]);
    expect(plan.map((step) => step.gatewayTargetName)).toEqual([
      "pdf-pipeline",
      "pdf-pipeline",
      "pdf-pipeline",
      "pdf-pipeline",
      "translation",
      "pdf-pipeline",
      "evaluation"
    ]);
  });

  it("strips AgentCore Gateway target prefixes and creates stable IDs", () => {
    expect(normalizeGatewayToolName("pdf-pipeline___extract_text_layout")).toBe("extract_text_layout");
    expect(normalizeGatewayToolName("extract_text_layout")).toBe("extract_text_layout");
    expect(stableWorkflowEntityId("art", "run_01", 7, "TRANSLATED_PDF")).toBe(
      "art_run_01_7_translated_pdf"
    );
  });
});
