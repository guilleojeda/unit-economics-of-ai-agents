import {
  BedrockAgentCoreClient,
  InvokeAgentRuntimeCommand
} from "@aws-sdk/client-bedrock-agentcore";
import { createHash } from "node:crypto";
import { ControlApiError } from "./errors.js";
import type { AgentRuntimeClient, RunExecutionRequest } from "./types.js";

export type AgentCoreRuntimeClientOptions = {
  readonly agentRuntimeArn: string;
  readonly qualifier: string;
  readonly region?: "us-east-1";
  readonly client?: Pick<BedrockAgentCoreClient, "send">;
};

function stableRuntimeSessionId(runId: string): string {
  const hash = createHash("sha256").update(runId).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `8${hash.slice(17, 20)}`,
    hash.slice(20, 32)
  ].join("-");
}

function parseRuntimeResponse(text: string, runId: string): void {
  if (text.length === 0) {
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ControlApiError("AGENT_INVOCATION_FAILED", "AgentCore Runtime returned invalid JSON", {
      runId
    });
  }

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "status" in parsed &&
    parsed.status === "FAILED"
  ) {
    throw new ControlApiError("AGENT_INVOCATION_FAILED", "AgentCore Runtime reported run failure", {
      runId
    });
  }
}

export function createAgentCoreRuntimeClient(
  options: AgentCoreRuntimeClientOptions
): AgentRuntimeClient {
  const client = options.client ?? new BedrockAgentCoreClient({ region: options.region ?? "us-east-1" });

  return {
    async invoke(request: RunExecutionRequest): Promise<void> {
      const runtimeSessionId = stableRuntimeSessionId(request.runId);
      const payload = JSON.stringify({
        ...request,
        runtimeSessionId
      });
      const response = await client.send(
        new InvokeAgentRuntimeCommand({
          agentRuntimeArn: options.agentRuntimeArn,
          qualifier: options.qualifier,
          runtimeSessionId,
          payload,
          contentType: "application/json",
          accept: "application/json"
        })
      );
      const responseText = await response.response?.transformToString();
      parseRuntimeResponse(responseText ?? "", request.runId);
    }
  };
}
