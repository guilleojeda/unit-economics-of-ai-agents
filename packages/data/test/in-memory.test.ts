import { describe, expect, it } from "vitest";
import type {
  Artifact,
  Document,
  LedgerItem,
  PriceBook,
  Run,
  StageEvent,
  TranslationJob
} from "@agentcore-pdf-translator/schemas";
import {
  InMemoryArtifactRepository,
  InMemoryDocumentRepository,
  InMemoryLedgerItemRepository,
  InMemoryPriceBookRepository,
  InMemoryRunRepository,
  InMemoryStageEventRepository,
  InMemoryTranslationJobRepository
} from "../src/index.js";
import { RepositoryConflictError, RepositoryInvariantError } from "../src/errors.js";

const now = "2026-05-18T12:00:00.000Z";

const document: Document = {
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
  updatedAt: now
};

const job: TranslationJob = {
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
  updatedAt: now
};

const run: Run = {
  workspaceId: "ws_default",
  runId: "run_01",
  jobId: "job_01",
  documentId: "doc_01",
  attemptNumber: 1,
  workflowVariant: "V1_TEXT_ONLY",
  status: "CREATED",
  sourceLanguage: "es",
  targetLanguage: "en",
  sourcePdfArtifactId: "art_source",
  llmOnlyCostUsd: 0,
  fullWorkflowCostUsd: 0,
  humanReviewCostUsd: 0,
  retryCostUsd: 0,
  remediationCostUsd: 0,
  warnings: [],
  createdAt: now,
  updatedAt: now
};

const stageEvent: StageEvent = {
  workspaceId: "ws_default",
  runId: "run_01",
  jobId: "job_01",
  documentId: "doc_01",
  stageEventId: "stg_01",
  sequence: 1,
  stageName: "inspect_pdf",
  status: "SUCCEEDED",
  inputArtifactIds: ["art_source"],
  outputArtifactIds: ["art_inspection"],
  retryCount: 0,
  warnings: []
};

const artifact: Artifact = {
  workspaceId: "ws_default",
  artifactId: "art_source",
  documentId: "doc_01",
  jobId: "job_01",
  runId: "run_01",
  artifactType: "SOURCE_PDF",
  s3Bucket: "bucket",
  s3Key: "workspaces/ws_default/documents/doc_01/source/source.pdf",
  contentType: "application/pdf",
  createdAt: now
};

const ledgerItem: LedgerItem = {
  workspaceId: "ws_default",
  ledgerItemId: "led_01",
  runId: "run_01",
  jobId: "job_01",
  documentId: "doc_01",
  workflowVariant: "V1_TEXT_ONLY",
  stageName: "translate_text_chunks",
  stageSequence: 5,
  componentType: "MODEL_INFERENCE",
  componentName: "fixture-model",
  billableUnit: "INPUT_TOKEN",
  unitCount: 100,
  unitPriceUsd: 0.001,
  estimatedCostUsd: 0.1,
  costSource: "BEDROCK_RESPONSE_USAGE",
  priceBookVersion: "pb_test",
  createdAt: now
};

describe("in-memory repositories", () => {
  it("stores and lists documents, jobs, and runs through repository interfaces", async () => {
    const documents = new InMemoryDocumentRepository();
    const jobs = new InMemoryTranslationJobRepository();
    const runs = new InMemoryRunRepository();

    await documents.put(document);
    await jobs.put(job);
    await runs.put(run);

    await expect(documents.get("doc_01")).resolves.toEqual(document);
    await expect(jobs.listByDocument("doc_01")).resolves.toEqual([job]);
    await expect(jobs.listByComparisonGroup("cmp_01")).resolves.toEqual([job]);
    await expect(runs.listByJob("job_01")).resolves.toEqual([run]);
  });

  it("stores and lists stage events, artifacts, and ledger items", async () => {
    const stageEvents = new InMemoryStageEventRepository();
    const artifacts = new InMemoryArtifactRepository();
    const ledgerItems = new InMemoryLedgerItemRepository();

    await stageEvents.put(stageEvent);
    await artifacts.put(artifact);
    await ledgerItems.put(ledgerItem);

    await expect(stageEvents.listByRun("run_01")).resolves.toEqual([stageEvent]);
    await expect(artifacts.listByRun("run_01")).resolves.toEqual([artifact]);
    await expect(artifacts.listByDocument("doc_01")).resolves.toEqual([artifact]);
    await expect(ledgerItems.listByRun("run_01")).resolves.toEqual([ledgerItem]);
    await expect(ledgerItems.listByJob("job_01")).resolves.toEqual([ledgerItem]);
    await expect(ledgerItems.listByComponentType("MODEL_INFERENCE")).resolves.toEqual([ledgerItem]);
  });

  it("stores active price books", async () => {
    const repository = new InMemoryPriceBookRepository();
    const priceBook: PriceBook = {
      priceBookVersion: "pb_test",
      status: "ACTIVE",
      currency: "USD",
      modelPrices: [],
      agentCorePrices: {},
      externalServicePrices: [],
      humanReviewHourlyRateDefaultUsd: 72,
      sourceNotes: [],
      createdAt: now,
      updatedAt: now
    };

    await repository.put(priceBook);

    await expect(repository.get("pb_test")).resolves.toEqual(priceBook);
    await expect(repository.getActive()).resolves.toEqual(priceBook);
  });

  it("preserves append-only records and surfaces ambiguous active price books", async () => {
    const artifacts = new InMemoryArtifactRepository();
    const ledgerItems = new InMemoryLedgerItemRepository();
    const priceBooks = new InMemoryPriceBookRepository();
    const priceBook: PriceBook = {
      priceBookVersion: "pb_test",
      status: "ACTIVE",
      currency: "USD",
      modelPrices: [],
      agentCorePrices: {},
      externalServicePrices: [],
      humanReviewHourlyRateDefaultUsd: 72,
      sourceNotes: [],
      createdAt: now,
      updatedAt: now
    };

    await artifacts.put(artifact);
    await ledgerItems.put(ledgerItem);
    await priceBooks.put(priceBook);
    await priceBooks.put({ ...priceBook, priceBookVersion: "pb_second" });

    await expect(artifacts.put(artifact)).rejects.toThrow(RepositoryConflictError);
    await expect(ledgerItems.put(ledgerItem)).rejects.toThrow(RepositoryConflictError);
    await expect(priceBooks.getActive()).rejects.toThrow(RepositoryInvariantError);
  });
});
