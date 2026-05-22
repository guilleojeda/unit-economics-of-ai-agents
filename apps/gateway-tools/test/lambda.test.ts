import { describe, expect, it } from "vitest";
import { handler } from "../src/index.js";

describe("Gateway tool Lambda contract", () => {
  it("rejects raw PDF bytes before reaching persistence", async () => {
    await expect(
      handler({
        workspaceId: "ws_default",
        documentId: "doc_01",
        jobId: "job_01",
        runId: "run_01",
        workflowVariant: "V1_TEXT_ONLY",
        sourceLanguage: "es",
        targetLanguage: "en",
        priceBookVersion: "pb_test",
        stageName: "extract_text_layout",
        inputArtifacts: [],
        rawPdfBytes: "JVBERi0xLjQ="
      })
    ).rejects.toThrow();
  });
});
