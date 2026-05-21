import {
  createEntityId,
  InMemoryAppSettingRepository,
  InMemoryArtifactRepository,
  InMemoryDocumentRepository,
  InMemoryEvaluationResultRepository,
  InMemoryLedgerItemRepository,
  InMemoryPriceBookRepository,
  InMemoryReviewDecisionRepository,
  InMemoryRunRepository,
  InMemoryStageEventRepository,
  InMemoryTranslationJobRepository,
  validateArtifactS3Key,
  type ArtifactObjectMetadata,
  type ArtifactObjectStore,
  type GetArtifactObjectOptions,
  type PresignGetOptions,
  type PresignPutOptions,
  type PutArtifactJsonOptions,
  type PutArtifactObjectOptions
} from "@agentcore-pdf-translator/data";
import { createPreGatewayAgentRuntimeClient } from "./stage-runner.js";
import type { AgentRuntimeClient, ControlApiContext } from "./types.js";

class InMemoryArtifactObjectStore implements ArtifactObjectStore {
  private readonly objects = new Map<
    string,
    { readonly bytes: Uint8Array; readonly contentType: string; readonly versionId: string }
  >();

  public async putObject(options: PutArtifactObjectOptions): Promise<void> {
    validateArtifactS3Key(options.key, options.context);
    const bytes = typeof options.body === "string" ? new TextEncoder().encode(options.body) : options.body;
    this.objects.set(options.key, {
      bytes,
      contentType: options.contentType,
      versionId: `mem-${this.objects.size + 1}`
    });
  }

  public async getObjectMetadata(options: GetArtifactObjectOptions): Promise<ArtifactObjectMetadata> {
    validateArtifactS3Key(options.key, options.context);
    const object = this.objects.get(options.key);
    if (object === undefined) {
      return {};
    }

    return {
      contentType: object.contentType,
      contentLength: object.bytes.byteLength,
      eTag: `"mem-${object.bytes.byteLength}"`,
      versionId: object.versionId
    };
  }

  public async getObjectBytes(options: GetArtifactObjectOptions): Promise<Uint8Array> {
    validateArtifactS3Key(options.key, options.context);
    const object = this.objects.get(options.key);
    if (object === undefined) {
      throw new Error(`Object not found: ${options.key}`);
    }

    return object.bytes;
  }

  public async putJson<T>(options: PutArtifactJsonOptions<T>): Promise<void> {
    await this.putObject({
      key: options.key,
      body: JSON.stringify(options.value),
      contentType: options.contentType,
      ...(options.context === undefined ? {} : { context: options.context })
    });
  }

  public async getJson<T>(
    options: GetArtifactObjectOptions & { readonly parse: (value: unknown) => T }
  ): Promise<T> {
    const text = new TextDecoder().decode(await this.getObjectBytes(options));
    return options.parse(JSON.parse(text));
  }

  public async createPresignedPutUrl(options: PresignPutOptions): Promise<string> {
    validateArtifactS3Key(options.key, options.context);
    return `https://example.invalid/upload/${encodeURIComponent(options.key)}?expires=${options.expiresInSeconds}`;
  }

  public async createPresignedGetUrl(options: PresignGetOptions): Promise<string> {
    validateArtifactS3Key(options.key, options.context);
    return `https://example.invalid/download/${encodeURIComponent(options.key)}?expires=${options.expiresInSeconds}`;
  }
}

export type CreateInMemoryControlApiContextOptions = {
  readonly workspaceId?: string;
  readonly artifactObjects?: ArtifactObjectStore;
  readonly agentRuntimeClient?: AgentRuntimeClient;
  readonly now?: () => string;
  readonly createId?: ControlApiContext["createId"];
  readonly controlledFixtureSha256?: string;
};

export function createInMemoryControlApiContext(
  options: CreateInMemoryControlApiContextOptions = {}
): ControlApiContext {
  const contextRef: { current?: ControlApiContext } = {};
  const agentRuntimeClient =
    options.agentRuntimeClient ??
    createPreGatewayAgentRuntimeClient(() => {
      if (contextRef.current === undefined) {
        throw new Error("Control API context is not initialized");
      }

      return contextRef.current;
    });
  const context: ControlApiContext = {
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
    artifactObjects: options.artifactObjects ?? new InMemoryArtifactObjectStore(),
    config: {
      artifactBucketName: "artifact-bucket",
      sourceUploadExpiresInSeconds: 600,
      maxSourcePdfBytes: 10 * 1024 * 1024,
      controlledFixtureSha256: options.controlledFixtureSha256 ?? "fixture-sha256",
      businessUsdMax: 1_000_000
    },
    agentRuntimeClient,
    now: options.now ?? (() => new Date().toISOString()),
    createId: options.createId ?? ((prefix) => createEntityId(prefix))
  };
  contextRef.current = context;
  return context;
}
