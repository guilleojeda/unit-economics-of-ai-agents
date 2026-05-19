import { createEntityId } from "@agentcore-pdf-translator/data";
import {
  InMemoryAppSettingRepository,
  InMemoryArtifactRepository,
  InMemoryDocumentRepository,
  InMemoryEvaluationResultRepository,
  InMemoryLedgerItemRepository,
  InMemoryPriceBookRepository,
  InMemoryReviewDecisionRepository,
  InMemoryRunRepository,
  InMemoryStageEventRepository,
  InMemoryTranslationJobRepository
} from "@agentcore-pdf-translator/data";
import { RecordingAgentRuntimeClient } from "./runtime-client.js";
import type { AgentRuntimeClient, ControlApiContext } from "./types.js";

export type CreateInMemoryControlApiContextOptions = {
  readonly workspaceId?: string;
  readonly agentRuntimeClient?: AgentRuntimeClient;
  readonly now?: () => string;
  readonly createId?: ControlApiContext["createId"];
};

export function createInMemoryControlApiContext(
  options: CreateInMemoryControlApiContextOptions = {}
): ControlApiContext {
  return {
    workspaceId: options.workspaceId ?? "ws_default",
    repositories: {
      documents: new InMemoryDocumentRepository(),
      jobs: new InMemoryTranslationJobRepository(),
      runs: new InMemoryRunRepository(),
      stageEvents: new InMemoryStageEventRepository(),
      artifacts: new InMemoryArtifactRepository(),
      ledgerItems: new InMemoryLedgerItemRepository(),
      evaluations: new InMemoryEvaluationResultRepository(),
      reviewDecisions: new InMemoryReviewDecisionRepository(),
      priceBooks: new InMemoryPriceBookRepository(),
      appSettings: new InMemoryAppSettingRepository()
    },
    agentRuntimeClient: options.agentRuntimeClient ?? new RecordingAgentRuntimeClient(),
    now: options.now ?? (() => new Date().toISOString()),
    createId: options.createId ?? ((prefix) => createEntityId(prefix))
  };
}
