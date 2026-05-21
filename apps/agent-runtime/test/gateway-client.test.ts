import { describe, expect, it } from "vitest";
import { createGatewayClient } from "../src/index.js";
import type {
  GatewayFileToolRequest,
  GatewayToolResponse
} from "@agentcore-pdf-translator/schemas";

const now = "2026-05-21T12:00:00.000Z";

const request: GatewayFileToolRequest = {
  workspaceId: "ws_default",
  documentId: "doc_01",
  jobId: "job_01",
  runId: "run_01",
  workflowVariant: "V1_TEXT_ONLY",
  sourceLanguage: "es",
  targetLanguage: "en",
  priceBookVersion: "pb_test",
  options: {
    enableImageTranslation: false,
    enablePolicyChecks: true,
    enableMemory: false,
    preserveLayout: "APPROXIMATE"
  },
  stageName: "extract_text_layout",
  inputArtifacts: [
    {
      artifactId: "art_source",
      artifactType: "SOURCE_PDF",
      s3Bucket: "bucket",
      s3Key: "workspaces/ws_default/documents/doc_01/source/source.pdf",
      sha256: "hash"
    }
  ],
  invocation: {
    runtimeSessionId: "12345678-1234-4234-8234-123456789012",
    toolInvocationId: "run_01:2:extract_text_layout",
    idempotencyKey: "run_01:2:extract_text_layout"
  },
  provenance: {
    executionBackend: "AGENTCORE_RUNTIME_GATEWAY",
    implementationLabel: "PR-012 AgentCore Runtime Gateway proof runner",
    implementationVersion: "pr-012.1",
    region: "us-east-1"
  }
};

const response: GatewayToolResponse = {
  status: "SUCCEEDED",
  stageName: "extract_text_layout",
  startedAt: now,
  completedAt: now,
  durationMs: 0,
  artifacts: [],
  metrics: {},
  ledgerItems: [],
  warnings: [],
  invocation: request.invocation,
  provenance: request.provenance,
  outputArtifacts: request.inputArtifacts
};

describe("AgentCore Gateway client", () => {
  it("calls target-prefixed MCP tools and unwraps JSON text responses", async () => {
    let body: unknown;
    const client = createGatewayClient({
      gatewayUrl: "https://gateway.example.test",
      skipSigning: true,
      fetchImpl: async (_input, init) => {
        body = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: request.invocation.idempotencyKey,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(response)
                }
              ]
            }
          }),
          { status: 200 }
        );
      }
    });

    await expect(client.callTool(request, "pdf-pipeline", "extract_text_layout")).resolves.toEqual(response);
    expect(body).toMatchObject({
      method: "tools/call",
      params: {
        name: "pdf-pipeline___extract_text_layout"
      }
    });
  });
});
