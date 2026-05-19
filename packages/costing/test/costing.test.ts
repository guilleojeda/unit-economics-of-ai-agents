import { describe, expect, it } from "vitest";
import type { LedgerItem, PriceBook, Run, TranslationJob } from "@agentcore-pdf-translator/schemas";
import {
  createGatewayOperationLedgerItem,
  createHumanReviewLedgerItem,
  createModelInferenceLedgerItems,
  PriceBookLookupError,
  rollupJobEconomics,
  rollupRunCost
} from "../src/index.js";

const now = "2026-05-18T12:00:00.000Z";

const priceBook: PriceBook = {
  priceBookVersion: "pb_test",
  status: "ACTIVE",
  currency: "USD",
  modelPrices: [
    {
      provider: "bedrock",
      modelId: "fixture-translation-model",
      inputTokenPricePer1K: 0.01,
      outputTokenPricePer1K: 0.02
    }
  ],
  agentCorePrices: {
    gatewayOperationUsd: 0.005
  },
  externalServicePrices: [],
  humanReviewHourlyRateDefaultUsd: 72,
  sourceNotes: ["test fixture only"],
  createdAt: now,
  updatedAt: now
};

const baseLedger = {
  workspaceId: "ws_default",
  runId: "run_01",
  jobId: "job_01",
  documentId: "doc_01",
  workflowVariant: "V1_TEXT_ONLY",
  stageName: "translate_text_chunks",
  stageSequence: 5,
  priceBookVersion: "pb_test",
  createdAt: now
} as const;

const acceptedJob: TranslationJob = {
  workspaceId: "ws_default",
  jobId: "job_01",
  documentId: "doc_01",
  workflowVariant: "V1_TEXT_ONLY",
  status: "ACCEPTED",
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
  totalAttemptCount: 2,
  acceptedRunId: "run_02",
  latestRunId: "run_02",
  llmOnlyCostUsd: 0,
  fullWorkflowCostUsd: 0,
  unitValueUsd: 100,
  costBasis: "TELEMETRY_DERIVED_PRICE_BOOK_ESTIMATE",
  createdAt: now,
  updatedAt: now
};

function makeRun(runId: string, attemptNumber: number): Run {
  return {
    workspaceId: "ws_default",
    runId,
    jobId: "job_01",
    documentId: "doc_01",
    attemptNumber,
    workflowVariant: "V1_TEXT_ONLY",
    status: runId === "run_02" ? "ACCEPTED" : "FAILED",
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
}

function ledger(overrides: Partial<LedgerItem>): LedgerItem {
  return {
    workspaceId: "ws_default",
    ledgerItemId: "led_default",
    runId: "run_01",
    jobId: "job_01",
    documentId: "doc_01",
    workflowVariant: "V1_TEXT_ONLY",
    stageName: "translate_text_chunks",
    stageSequence: 5,
    componentType: "MODEL_INFERENCE",
    componentName: "fixture-translation-model",
    billableUnit: "INPUT_TOKEN",
    unitCount: 1,
    unitPriceUsd: 1,
    estimatedCostUsd: 1,
    costSource: "BEDROCK_RESPONSE_USAGE",
    priceBookVersion: "pb_test",
    createdAt: now,
    ...overrides
  };
}

describe("ledger builders", () => {
  it("creates model inference rows from PriceBook token prices", () => {
    const rows = createModelInferenceLedgerItems(priceBook, {
      ...baseLedger,
      modelId: "fixture-translation-model",
      inputTokens: 1000,
      outputTokens: 500
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]?.componentType).toBe("MODEL_INFERENCE");
    expect(rows[0]?.estimatedCostUsd).toBeCloseTo(0.01);
    expect(rows[1]?.estimatedCostUsd).toBeCloseTo(0.01);
  });

  it("creates gateway and human-review rows from PriceBook-backed rates", () => {
    const gateway = createGatewayOperationLedgerItem(priceBook, {
      ...baseLedger,
      stageName: "extract_text_layout",
      stageSequence: 2,
      toolName: "PdfPipelineTools___extract_text_layout",
      operationCount: 3
    });
    const review = createHumanReviewLedgerItem(priceBook, {
      ...baseLedger,
      stageName: "reviewer_decision",
      stageSequence: 9,
      reviewerSeconds: 300
    });

    expect(gateway.estimatedCostUsd).toBeCloseTo(0.015);
    expect(review.componentType).toBe("HUMAN_REVIEW");
    expect(review.costSource).toBe("HUMAN_REVIEW_TIMER");
    expect(review.estimatedCostUsd).toBeCloseTo(6);
  });

  it("fails when a requested model has no PriceBook entry", () => {
    expect(() =>
      createModelInferenceLedgerItems(priceBook, {
        ...baseLedger,
        modelId: "missing-model",
        inputTokens: 1,
        outputTokens: 1
      })
    ).toThrow(PriceBookLookupError);
  });
});

describe("cost rollups", () => {
  it("separates LLM-only cost from full workflow cost", () => {
    const rows = [
      ledger({ ledgerItemId: "led_model", estimatedCostUsd: 2 }),
      ledger({
        ledgerItemId: "led_gateway",
        componentType: "AGENTCORE_GATEWAY",
        componentName: "PdfPipelineTools___inspect_pdf",
        billableUnit: "TOOL_OPERATION",
        estimatedCostUsd: 3,
        costSource: "AGENTCORE_GATEWAY_METRIC"
      })
    ];

    const rollup = rollupRunCost("run_01", rows);

    expect(rollup.llmOnlyCostUsd).toBe(2);
    expect(rollup.fullWorkflowCostUsd).toBe(5);
  });

  it("calculates accepted multi-attempt job economics from all run ledgers", () => {
    const runs = [makeRun("run_01", 1), makeRun("run_02", 2)];
    const rows = [
      ledger({ ledgerItemId: "led_failed_attempt", runId: "run_01", estimatedCostUsd: 10 }),
      ledger({
        ledgerItemId: "led_accepted_model",
        runId: "run_02",
        componentType: "MODEL_INFERENCE",
        estimatedCostUsd: 15
      }),
      ledger({
        ledgerItemId: "led_accepted_review",
        runId: "run_02",
        componentType: "HUMAN_REVIEW",
        componentName: "human-review",
        billableUnit: "SECOND",
        estimatedCostUsd: 6,
        costSource: "HUMAN_REVIEW_TIMER"
      })
    ];

    const economics = rollupJobEconomics({
      job: acceptedJob,
      runs,
      ledgerItems: rows
    });

    expect(economics.fullWorkflowCostUsd).toBe(31);
    expect(economics.llmOnlyCostUsd).toBe(25);
    expect(economics.costPerVerifiedOutcomeUsd).toBe(31);
    expect(economics.unitMarginUsd).toBe(69);
  });

  it("keeps rejected job cost visible without a verified outcome", () => {
    const { acceptedRunId: _acceptedRunId, ...jobWithoutAcceptedRun } = acceptedJob;
    const economics = rollupJobEconomics({
      job: {
        ...jobWithoutAcceptedRun,
        status: "REJECTED"
      },
      runs: [makeRun("run_01", 1)],
      ledgerItems: [ledger({ estimatedCostUsd: 12 })]
    });

    expect(economics.fullWorkflowCostUsd).toBe(12);
    expect(economics.costPerVerifiedOutcomeUsd).toBeNull();
    expect(economics.unitMarginUsd).toBeNull();
  });
});
