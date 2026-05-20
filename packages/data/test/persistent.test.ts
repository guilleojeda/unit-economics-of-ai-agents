import { PutObjectCommand } from "@aws-sdk/client-s3";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import type {
  Artifact,
  Document,
  LedgerItem,
  PriceBook,
  TranslationJob
} from "@agentcore-pdf-translator/schemas";
import { RepositoryConflictError, RepositoryConfigError } from "../src/index.js";
import {
  createPersistentRepositories,
  S3ArtifactObjectStore,
  validateArtifactS3Key,
  validatePersistentRepositoryConfig,
  type DynamoCommand,
  type DynamoDbSender,
  type DynamoTableNames,
  type PersistentRepositoryConfig,
  type S3Command,
  type S3Sender
} from "../src/persistent.js";
import {
  artifactToItem,
  documentToItem,
  translationJobToItem
} from "../src/dynamodb/mappers.js";
import { DynamoLedgerItemRepository, DynamoPriceBookRepository, DynamoTranslationJobRepository } from "../src/dynamodb/repositories.js";

const now = "2026-05-18T12:00:00.000Z";

const tableNames: DynamoTableNames = {
  documents: "Documents",
  translationJobs: "TranslationJobs",
  runs: "Runs",
  stageEvents: "StageEvents",
  artifacts: "Artifacts",
  ledgerItems: "LedgerItems",
  evaluationResults: "EvaluationResults",
  reviewDecisions: "ReviewDecisions",
  priceBooks: "PriceBooks",
  appSettings: "AppSettings"
};

const persistentConfig: PersistentRepositoryConfig = {
  region: "us-east-1",
  tableNames,
  artifactBucketName: "agentcore-pdf-translator-dev-123456789012-us-east-1"
};

type QueuedDynamoResponse =
  | { readonly kind: "return"; readonly value: unknown }
  | { readonly kind: "throw"; readonly error: unknown };

class RecordingDynamoClient implements DynamoDbSender {
  public readonly commands: DynamoCommand[] = [];
  private readonly queue: QueuedDynamoResponse[];

  public constructor(queue: QueuedDynamoResponse[] = []) {
    this.queue = [...queue];
  }

  public async send(command: DynamoCommand): Promise<unknown> {
    this.commands.push(command);
    const next = this.queue.shift();
    if (next?.kind === "throw") {
      throw next.error;
    }

    return next?.value ?? {};
  }
}

class RecordingS3Client implements S3Sender {
  public readonly commands: S3Command[] = [];
  private readonly queue: unknown[];

  public constructor(queue: unknown[] = []) {
    this.queue = [...queue];
  }

  public async send(command: S3Command): Promise<unknown> {
    this.commands.push(command);
    return this.queue.shift() ?? {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function commandInput(command: unknown): Record<string, unknown> {
  if (!isRecord(command) || !isRecord(command.input)) {
    throw new Error("Command did not expose an input object");
  }

  return command.input;
}

function documentFixture(overrides: Partial<Document> = {}): Document {
  return {
    workspaceId: "ws_default",
    documentId: "doc_01",
    title: "Procedimiento de Reembolsos y Elegibilidad",
    sourceLanguage: "es",
    targetLanguage: "en",
    status: "READY",
    sourcePdfArtifactId: "art_source",
    sourcePdfS3Bucket: "bucket",
    sourcePdfS3Key: "workspaces/ws_default/documents/doc_01/source/source.pdf",
    fileName: "source.pdf",
    fileSizeBytes: 1024,
    sha256: "hash",
    inspectionWarnings: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function jobFixture(overrides: Partial<TranslationJob> = {}): TranslationJob {
  return {
    workspaceId: "ws_default",
    jobId: "job_01",
    documentId: "doc_01",
    comparisonGroupId: "cmp_01",
    workflowVariant: "V1_TEXT_ONLY",
    status: "CREATED",
    sourceLanguage: "es",
    targetLanguage: "en",
    valueModel: {
      valuePerAcceptedPdfUsd: 100,
      humanReviewHourlyRateUsd: 72
    },
    options: {
      enableImageTranslation: false,
      enablePolicyChecks: false,
      enableMemory: false,
      preserveLayout: "APPROXIMATE"
    },
    priceBookVersion: "pb_test",
    totalAttemptCount: 0,
    llmOnlyCostUsd: 0,
    fullWorkflowCostUsd: 0,
    unitValueUsd: 100,
    costBasis: "TELEMETRY_DERIVED_PRICE_BOOK_ESTIMATE",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function jobWithoutComparisonGroup(): TranslationJob {
  const job = { ...jobFixture() };
  delete job.comparisonGroupId;
  return job;
}

function artifactFixture(overrides: Partial<Artifact> = {}): Artifact {
  return {
    workspaceId: "ws_default",
    artifactId: "art_source",
    documentId: "doc_01",
    jobId: "job_01",
    runId: "run_01",
    artifactType: "SOURCE_PDF",
    s3Bucket: "bucket",
    s3Key: "workspaces/ws_default/documents/doc_01/source/source.pdf",
    contentType: "application/pdf",
    createdAt: now,
    ...overrides
  };
}

function sourceArtifactWithoutRun(): Artifact {
  const artifact = { ...artifactFixture() };
  delete artifact.jobId;
  delete artifact.runId;
  delete artifact.stageEventId;
  return artifact;
}

function ledgerFixture(overrides: Partial<LedgerItem> = {}): LedgerItem {
  return {
    workspaceId: "ws_default",
    ledgerItemId: "led_01",
    runId: "run_01",
    jobId: "job_01",
    documentId: "doc_01",
    workflowVariant: "V1_TEXT_ONLY",
    stageName: "translate_text_chunks",
    stageSequence: 5,
    componentType: "MODEL_INFERENCE",
    componentName: "model",
    billableUnit: "INPUT_TOKEN",
    unitCount: 100,
    unitPriceUsd: 0.001,
    estimatedCostUsd: 0.1,
    costSource: "BEDROCK_RESPONSE_USAGE",
    priceBookVersion: "pb_test",
    createdAt: now,
    ...overrides
  };
}

function priceBookFixture(overrides: Partial<PriceBook> = {}): PriceBook {
  return {
    priceBookVersion: "pb_test",
    status: "ACTIVE",
    currency: "USD",
    modelPrices: [],
    agentCorePrices: {},
    externalServicePrices: [],
    humanReviewHourlyRateDefaultUsd: 72,
    sourceNotes: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("DynamoDB mappers", () => {
  it("builds exact table/index key attributes and canonicalizes timestamp offsets", () => {
    const item = translationJobToItem(
      jobFixture({
        createdAt: "2026-05-18T09:00:00-03:00",
        updatedAt: "2026-05-18T09:15:00-03:00"
      })
    );

    expect(item).toMatchObject({
      jobId: "job_01",
      documentId: "doc_01",
      createdAtJobId: "2026-05-18T12:00:00.000Z#job_01",
      workflowVariantCreatedAtJobId: "01#2026-05-18T12:00:00.000Z#job_01",
      updatedAtJobId: "2026-05-18T12:15:00.000Z#job_01"
    });
  });

  it("keeps optional GSI attributes sparse instead of serializing placeholders", () => {
    const jobItem = translationJobToItem(jobWithoutComparisonGroup());
    expect(jobItem).not.toHaveProperty("comparisonGroupId");
    expect(jobItem).not.toHaveProperty("workflowVariantCreatedAtJobId");

    const artifactItem = artifactToItem(sourceArtifactWithoutRun());
    expect(artifactItem).not.toHaveProperty("jobId");
    expect(artifactItem).not.toHaveProperty("runId");
    expect(artifactItem).not.toHaveProperty("stageEventId");
    expect(artifactItem).not.toHaveProperty("createdAtArtifactId");
  });

  it("rejects inline artifact payload fields before DynamoDB writes", () => {
    const documentWithBody = {
      ...documentFixture(),
      body: "raw artifact bytes"
    } as unknown as Document;

    expect(() => documentToItem(documentWithBody)).toThrow("inline artifact payload");
  });

  it("keeps DynamoDB items free of raw bytes, base64, and body fields", () => {
    const item = artifactToItem(artifactFixture());
    const forbiddenPayloadKeys = ["bytes", "base64", "body", "pdf", "pdfBytes", "rawPdf"];

    for (const key of forbiddenPayloadKeys) {
      expect(item).not.toHaveProperty(key);
    }
  });
});

describe("DynamoDB repositories", () => {
  it("queries all pages through GSIs without scans or invalid strong GSI reads", async () => {
    const firstJob = jobFixture({ jobId: "job_02", workflowVariant: "V3_OPTIMIZED" });
    const secondJob = jobFixture({ jobId: "job_01", workflowVariant: "V1_TEXT_ONLY" });
    const client = new RecordingDynamoClient([
      {
        kind: "return",
        value: { Items: [translationJobToItem(firstJob)], LastEvaluatedKey: { jobId: "job_02" } }
      },
      { kind: "return", value: { Items: [translationJobToItem(secondJob)] } }
    ]);
    const repository = new DynamoTranslationJobRepository(client, tableNames.translationJobs);

    await expect(repository.listByComparisonGroup("cmp_01")).resolves.toEqual([
      secondJob,
      firstJob
    ]);

    expect(client.commands).toHaveLength(2);
    for (const command of client.commands) {
      expect(command).toBeInstanceOf(QueryCommand);
      expect(command.constructor.name).not.toBe("ScanCommand");
      const input = commandInput(command);
      expect(input.IndexName).toBe("byComparisonGroup");
      expect(input).not.toHaveProperty("ConsistentRead");
    }
    expect(commandInput(client.commands[1]).ExclusiveStartKey).toEqual({ jobId: "job_02" });
  });

  it("uses strongly consistent primary-key gets", async () => {
    const client = new RecordingDynamoClient([
      { kind: "return", value: { Item: translationJobToItem(jobFixture()) } }
    ]);
    const repository = new DynamoTranslationJobRepository(client, tableNames.translationJobs);

    await expect(repository.get("job_01")).resolves.toEqual(jobFixture());

    expect(client.commands[0]).toBeInstanceOf(GetCommand);
    expect(commandInput(client.commands[0]).ConsistentRead).toBe(true);
  });

  it("creates append-only ledger rows with conditional conflict detection", async () => {
    const client = new RecordingDynamoClient([
      { kind: "return", value: { Items: [] } },
      { kind: "throw", error: { name: "ConditionalCheckFailedException" } }
    ]);
    const repository = new DynamoLedgerItemRepository(client, tableNames.ledgerItems);

    await expect(repository.put(ledgerFixture())).rejects.toThrow(RepositoryConflictError);

    expect(client.commands[0]).toBeInstanceOf(QueryCommand);
    expect(client.commands[1]).toBeInstanceOf(PutCommand);
    expect(commandInput(client.commands[1]).ConditionExpression).toBe(
      "attribute_not_exists(#partitionKey)"
    );
  });

  it("detects append-only ledger duplicate IDs before creating a new sort-key row", async () => {
    const client = new RecordingDynamoClient([
      { kind: "return", value: { Items: [ledgerFixture()] } }
    ]);
    const repository = new DynamoLedgerItemRepository(client, tableNames.ledgerItems);

    await expect(
      repository.put(ledgerFixture({ stageSequence: 6, createdAt: "2026-05-18T12:01:00.000Z" }))
    ).rejects.toThrow(RepositoryConflictError);

    expect(client.commands).toHaveLength(1);
    expect(client.commands[0]).toBeInstanceOf(QueryCommand);
  });

  it("does not hide duplicate active price books behind a one-row query limit", async () => {
    const first = priceBookFixture({ priceBookVersion: "pb_1" });
    const second = priceBookFixture({ priceBookVersion: "pb_2" });
    const client = new RecordingDynamoClient([
      { kind: "return", value: { Items: [first, second] } }
    ]);
    const repository = new DynamoPriceBookRepository(client, tableNames.priceBooks);

    await expect(repository.getActive()).rejects.toThrow("Multiple active price books");

    const input = commandInput(client.commands[0]);
    expect(input.IndexName).toBe("byStatus");
    expect(input).not.toHaveProperty("Limit");
    expect(input).not.toHaveProperty("ConsistentRead");
  });

  it("validates explicit persistent config and creates repositories from injected offline clients", () => {
    const dynamoClient = new RecordingDynamoClient();
    const s3Client = new RecordingS3Client();
    const repositories = createPersistentRepositories({
      config: persistentConfig,
      dynamoClient,
      s3Client,
      presignUrl: async () => "https://example.test/presigned"
    });

    expect(repositories.translationJobs).toBeDefined();
    expect(repositories.artifactObjects).toBeDefined();
    expect(() =>
      validatePersistentRepositoryConfig({
        ...persistentConfig,
        region: "us-west-2"
      } as unknown as PersistentRepositoryConfig)
    ).toThrow(RepositoryConfigError);
    expect(() =>
      validatePersistentRepositoryConfig({
        ...persistentConfig,
        tableNames: { ...tableNames, artifacts: "" }
      })
    ).toThrow(RepositoryConfigError);
  });
});

describe("S3 artifact object store", () => {
  it("validates artifact keys and context before object operations", () => {
    expect(() => validateArtifactS3Key("s3://bucket/key")).toThrow(RepositoryConfigError);
    expect(() => validateArtifactS3Key("/workspaces/ws_default/key")).toThrow(
      RepositoryConfigError
    );
    expect(() => validateArtifactS3Key("workspaces/ws_default/../key")).toThrow(
      RepositoryConfigError
    );
    expect(() => validateArtifactS3Key("workspaces/ws_default")).toThrow(RepositoryConfigError);
    expect(() =>
      validateArtifactS3Key("workspaces/ws_other/jobs/job_01/runs/run_01/key", {
        workspaceId: "ws_default"
      })
    ).toThrow(RepositoryConfigError);
  });

  it("writes objects without ACLs and reads supported S3 body shapes", async () => {
    const key = "workspaces/ws_default/jobs/job_01/runs/run_01/stages/008-evaluate_translation/evaluation.json";
    const client = new RecordingS3Client([
      {},
      { Body: "text" },
      { Body: new Uint8Array([1, 2, 3]) },
      { Body: Readable.from(["stream"]) }
    ]);
    const store = new S3ArtifactObjectStore(
      client,
      persistentConfig.artifactBucketName,
      async () => "https://example.test/presigned"
    );

    await store.putObject({ key, body: "{}", contentType: "application/json" });
    await expect(store.getObjectBytes({ key })).resolves.toEqual(new TextEncoder().encode("text"));
    await expect(store.getObjectBytes({ key })).resolves.toEqual(new Uint8Array([1, 2, 3]));
    await expect(store.getObjectBytes({ key })).resolves.toEqual(
      new TextEncoder().encode("stream")
    );

    expect(client.commands[0]).toBeInstanceOf(PutObjectCommand);
    const putInput = commandInput(client.commands[0]);
    expect(putInput).toMatchObject({
      Bucket: persistentConfig.artifactBucketName,
      Key: key,
      ContentType: "application/json"
    });
    expect(putInput).not.toHaveProperty("ACL");
  });

  it("uses injected presigning and enforces short, scoped presigned URLs", async () => {
    const key = "workspaces/ws_default/jobs/job_01/runs/run_01/stages/007-recompose_pdf/translated.pdf";
    const client = new RecordingS3Client();
    const presignedCommands: S3Command[] = [];
    const store = new S3ArtifactObjectStore(client, persistentConfig.artifactBucketName, async (command, expiresInSeconds) => {
      presignedCommands.push(command);
      return `https://example.test/${expiresInSeconds}`;
    });

    await expect(
      store.createPresignedPutUrl({
        key,
        contentType: "application/pdf",
        expiresInSeconds: 901
      })
    ).rejects.toThrow(RepositoryConfigError);

    await expect(
      store.createPresignedPutUrl({
        key,
        contentType: "application/pdf",
        expiresInSeconds: 300,
        context: { workspaceId: "ws_default", jobId: "job_01", runId: "run_01" }
      })
    ).resolves.toBe("https://example.test/300");

    expect(presignedCommands[0]).toBeInstanceOf(PutObjectCommand);
    expect(commandInput(presignedCommands[0])).not.toHaveProperty("ACL");
  });

  it("parses JSON objects through caller-provided validation", async () => {
    const key = "workspaces/ws_default/jobs/job_01/runs/run_01/stages/008-evaluate_translation/evaluation.json";
    const client = new RecordingS3Client([{ Body: "{\"ok\":true}" }, { Body: "not-json" }]);
    const store = new S3ArtifactObjectStore(
      client,
      persistentConfig.artifactBucketName,
      async () => "https://example.test/presigned"
    );

    await expect(
      store.getJson({
        key,
        parse(value) {
          if (!isRecord(value) || value.ok !== true) {
            throw new Error("Unexpected JSON");
          }

          return value;
        }
      })
    ).resolves.toEqual({ ok: true });

    await expect(
      store.getJson({
        key,
        parse(value) {
          return value;
        }
      })
    ).rejects.toThrow("valid JSON");
  });
});

describe("package export and product guardrails", () => {
  it("keeps AWS-backed implementations out of the root data export", async () => {
    const rootExports = await import("../src/index.js");
    const persistentExports = await import("../src/persistent.js");

    expect("createPersistentRepositories" in rootExports).toBe(false);
    expect("createPersistentRepositories" in persistentExports).toBe(true);
  });

  it("does not introduce forbidden product modes in data source code", async () => {
    const { readdir, readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const srcDir = new URL("../src", import.meta.url);
    const forbiddenTokens = [
      ["LIVE", "CAPTURE"].join("_"),
      ["REPLAY", "CAPTURED"].join("_"),
      ["SYNTHETIC", "SEED"].join("_")
    ];

    async function readSourceFiles(directory: string): Promise<ReadonlyArray<string>> {
      const entries = await readdir(directory, { withFileTypes: true });
      const files = await Promise.all(
        entries.map(async (entry) => {
          const path = join(directory, entry.name);
          if (entry.isDirectory()) {
            return readSourceFiles(path);
          }

          return entry.name.endsWith(".ts") ? [path] : [];
        })
      );

      return files.flat();
    }

    const sourceFiles = await readSourceFiles(srcDir.pathname);
    for (const file of sourceFiles) {
      const contents = await readFile(file, "utf8");
      for (const token of forbiddenTokens) {
        expect(contents).not.toContain(token);
      }
    }
  });
});
