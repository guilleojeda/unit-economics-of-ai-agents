import type { AgentRuntimeClient, RunExecutionRequest } from "./types.js";

export class RecordingAgentRuntimeClient implements AgentRuntimeClient {
  public readonly invocations: RunExecutionRequest[] = [];

  public async invoke(request: RunExecutionRequest): Promise<void> {
    this.invocations.push(request);
  }
}
