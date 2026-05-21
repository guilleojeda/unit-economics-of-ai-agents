import { BedrockAgentCoreApp } from "bedrock-agentcore/runtime";
import { Agent } from "@strands-agents/sdk";
import { executeRuntimeRun, type RuntimeRunExecutionRequest } from "./runner.js";

type AgentCoreInvocationContext = {
  readonly sessionId?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRequest(payload: unknown): RuntimeRunExecutionRequest {
  if (!isRecord(payload)) {
    throw new Error("Runtime payload must be a JSON object");
  }

  const requiredString = (key: string): string => {
    const value = payload[key];
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`Runtime payload is missing ${key}`);
    }
    return value;
  };
  const workflowVariant = requiredString("workflowVariant");
  if (workflowVariant !== "V1_TEXT_ONLY") {
    throw new Error("Only V1_TEXT_ONLY is executable in PR-012");
  }
  const validationRunId = payload.validationRunId;
  const runtimeSessionId = payload.runtimeSessionId;

  return {
    workspaceId: requiredString("workspaceId"),
    documentId: requiredString("documentId"),
    jobId: requiredString("jobId"),
    runId: requiredString("runId"),
    workflowVariant,
    priceBookVersion: requiredString("priceBookVersion"),
    ...(typeof validationRunId === "string" && validationRunId.length > 0
      ? { validationRunId }
      : {}),
    ...(typeof runtimeSessionId === "string" && runtimeSessionId.length > 0
      ? { runtimeSessionId }
      : {})
  };
}

const strandsAgent = new Agent();
const app = new BedrockAgentCoreApp({
  invocationHandler: {
    process: async (payload: unknown, context: AgentCoreInvocationContext) => {
      const request = parseRequest(payload);
      const runtimeSessionId = context.sessionId ?? request.runtimeSessionId ?? request.runId;
      await executeRuntimeRun({ request, runtimeSessionId });
      return {
        status: "SUCCEEDED",
        runId: request.runId,
        runtimeSessionId,
        agentLayer: strandsAgent.constructor.name
      };
    }
  }
});

app.run();
