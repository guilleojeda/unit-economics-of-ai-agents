"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  createHumanReviewLedgerItem,
  rollupJobEconomics,
  rollupRunCost
} from "@agentcore-pdf-translator/costing";
import type {
  Artifact,
  Document,
  EvaluationResult,
  JobStatus,
  LedgerItem,
  ReviewDecision,
  ReviewDecisionValue,
  Run,
  StageEvent,
  TranslationJob
} from "@agentcore-pdf-translator/schemas";
import {
  activePriceBook,
  artifacts as initialArtifacts,
  documents as initialDocuments,
  evaluations as initialEvaluations,
  fixtureNow,
  jobs as initialJobs,
  ledgerItems as initialLedgerItems,
  reviewDecisions as initialReviewDecisions,
  runs as initialRuns,
  stageEvents as initialStageEvents
} from "../lib/fixtures";

export type ReviewFormInput = {
  readonly decision: ReviewDecisionValue;
  readonly reviewerSeconds: number;
  readonly reason?: string;
};

export type ReviewSubmitResult =
  | {
      readonly ok: true;
      readonly reviewDecision: ReviewDecision;
    }
  | {
      readonly ok: false;
      readonly error: string;
    };

type FixtureState = {
  readonly documents: ReadonlyArray<Document>;
  readonly jobs: ReadonlyArray<TranslationJob>;
  readonly runs: ReadonlyArray<Run>;
  readonly stageEvents: ReadonlyArray<StageEvent>;
  readonly artifacts: ReadonlyArray<Artifact>;
  readonly evaluations: ReadonlyArray<EvaluationResult>;
  readonly ledgerItems: ReadonlyArray<LedgerItem>;
  readonly reviewDecisions: ReadonlyArray<ReviewDecision>;
};

type FixtureContextValue = FixtureState & {
  readonly priceBook: typeof activePriceBook;
  readonly getDocument: (documentId: string) => Document | undefined;
  readonly getJob: (jobId: string) => TranslationJob | undefined;
  readonly getRun: (runId: string) => Run | undefined;
  readonly getEvaluationForRun: (runId: string) => EvaluationResult | undefined;
  readonly getReviewDecisionForRun: (runId: string) => ReviewDecision | undefined;
  readonly listJobsForDocument: (documentId: string) => ReadonlyArray<TranslationJob>;
  readonly listRunsForJob: (jobId: string) => ReadonlyArray<Run>;
  readonly listStageEventsForRun: (runId: string) => ReadonlyArray<StageEvent>;
  readonly listArtifactsForRun: (runId: string) => ReadonlyArray<Artifact>;
  readonly listLedgerForRun: (runId: string) => ReadonlyArray<LedgerItem>;
  readonly listLedgerForJob: (jobId: string) => ReadonlyArray<LedgerItem>;
  readonly listComparisonJobs: (comparisonGroupId: string) => ReadonlyArray<TranslationJob>;
  readonly runCost: (runId: string) => ReturnType<typeof rollupRunCost>;
  readonly jobEconomics: (jobId: string) => ReturnType<typeof rollupJobEconomics> | undefined;
  readonly submitReview: (runId: string, input: ReviewFormInput) => ReviewSubmitResult;
};

const FixtureContext = createContext<FixtureContextValue | undefined>(undefined);

function sortByUpdatedAt<T extends { readonly updatedAt: string }>(items: ReadonlyArray<T>): ReadonlyArray<T> {
  return [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function statusFromDecision(decision: ReviewDecisionValue): Extract<JobStatus, "ACCEPTED" | "REJECTED" | "ESCALATED"> {
  return decision;
}

export function FixtureProvider({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<FixtureState>({
    documents: initialDocuments,
    jobs: initialJobs,
    runs: initialRuns,
    stageEvents: initialStageEvents,
    artifacts: initialArtifacts,
    evaluations: initialEvaluations,
    ledgerItems: initialLedgerItems,
    reviewDecisions: initialReviewDecisions
  });

  const getDocument = useCallback(
    (documentId: string) => state.documents.find((document) => document.documentId === documentId),
    [state.documents]
  );
  const getJob = useCallback(
    (jobId: string) => state.jobs.find((job) => job.jobId === jobId),
    [state.jobs]
  );
  const getRun = useCallback(
    (runId: string) => state.runs.find((run) => run.runId === runId),
    [state.runs]
  );
  const getEvaluationForRun = useCallback(
    (runId: string) => state.evaluations.find((evaluation) => evaluation.runId === runId),
    [state.evaluations]
  );
  const getReviewDecisionForRun = useCallback(
    (runId: string) => state.reviewDecisions.find((reviewDecision) => reviewDecision.runId === runId),
    [state.reviewDecisions]
  );
  const listJobsForDocument = useCallback(
    (documentId: string) => sortByUpdatedAt(state.jobs.filter((job) => job.documentId === documentId)),
    [state.jobs]
  );
  const listRunsForJob = useCallback(
    (jobId: string) =>
      [...state.runs].filter((run) => run.jobId === jobId).sort((left, right) => left.attemptNumber - right.attemptNumber),
    [state.runs]
  );
  const listStageEventsForRun = useCallback(
    (runId: string) =>
      [...state.stageEvents]
        .filter((stageEvent) => stageEvent.runId === runId)
        .sort((left, right) => left.sequence - right.sequence),
    [state.stageEvents]
  );
  const listArtifactsForRun = useCallback(
    (runId: string) => state.artifacts.filter((artifact) => artifact.runId === runId),
    [state.artifacts]
  );
  const listLedgerForRun = useCallback(
    (runId: string) => state.ledgerItems.filter((ledgerItem) => ledgerItem.runId === runId),
    [state.ledgerItems]
  );
  const listLedgerForJob = useCallback(
    (jobId: string) => state.ledgerItems.filter((ledgerItem) => ledgerItem.jobId === jobId),
    [state.ledgerItems]
  );
  const listComparisonJobs = useCallback(
    (comparisonGroupId: string) =>
      state.jobs.filter((job) => job.comparisonGroupId === comparisonGroupId).sort((left, right) => left.workflowVariant.localeCompare(right.workflowVariant)),
    [state.jobs]
  );
  const runCost = useCallback(
    (runId: string) => rollupRunCost(runId, state.ledgerItems),
    [state.ledgerItems]
  );
  const jobEconomics = useCallback(
    (jobId: string) => {
      const job = state.jobs.find((candidate) => candidate.jobId === jobId);

      if (job === undefined) {
        return undefined;
      }

      return rollupJobEconomics({
        job,
        runs: state.runs.filter((run) => run.jobId === jobId),
        ledgerItems: state.ledgerItems
      });
    },
    [state.jobs, state.ledgerItems, state.runs]
  );

  const submitReview = useCallback((runId: string, input: ReviewFormInput): ReviewSubmitResult => {
    let result: ReviewSubmitResult = {
      ok: false,
      error: "Review could not be applied."
    };

    setState((current) => {
      const run = current.runs.find((candidate) => candidate.runId === runId);

      if (run === undefined) {
        result = {
          ok: false,
          error: "Run not found."
        };
        return current;
      }

      if (run.status !== "AWAITING_REVIEW") {
        result = {
          ok: false,
          error: "Only runs awaiting review can receive a reviewer decision."
        };
        return current;
      }

      const job = current.jobs.find((candidate) => candidate.jobId === run.jobId);

      if (job === undefined) {
        result = {
          ok: false,
          error: "Translation job not found."
        };
        return current;
      }

      const createdAt = fixtureNow;
      const stageSequence =
        Math.max(
          0,
          ...current.stageEvents
            .filter((stageEvent) => stageEvent.runId === run.runId)
            .map((stageEvent) => stageEvent.sequence)
        ) + 1;
      const reviewLedger = {
        ...createHumanReviewLedgerItem(activePriceBook, {
          workspaceId: run.workspaceId,
          runId: run.runId,
          jobId: run.jobId,
          documentId: run.documentId,
          workflowVariant: run.workflowVariant,
          stageName: "reviewer_decision",
          stageSequence,
          priceBookVersion: job.priceBookVersion,
          createdAt,
          reviewerSeconds: input.reviewerSeconds,
          hourlyRateUsd: job.valueModel.humanReviewHourlyRateUsd,
          ...(run.traceId === undefined ? {} : { traceId: run.traceId })
        }),
        ledgerItemId: `led_review_${run.runId}_${input.decision.toLowerCase()}`
      };
      const reviewDecision: ReviewDecision = {
        workspaceId: run.workspaceId,
        reviewDecisionId: `rev_${run.runId}_${input.decision.toLowerCase()}`,
        jobId: run.jobId,
        runId: run.runId,
        documentId: run.documentId,
        decision: input.decision,
        reviewerSeconds: input.reviewerSeconds,
        humanReviewHourlyRateUsd: job.valueModel.humanReviewHourlyRateUsd,
        estimatedReviewCostUsd: reviewLedger.estimatedCostUsd,
        ...(input.reason === undefined || input.reason.trim() === "" ? {} : { reason: input.reason.trim() }),
        createdAt
      };
      const newLedgerItems = [...current.ledgerItems, reviewLedger];
      const updatedRunCost = rollupRunCost(run.runId, newLedgerItems);
      const updatedRun: Run = {
        ...run,
        status: input.decision,
        llmOnlyCostUsd: updatedRunCost.llmOnlyCostUsd,
        fullWorkflowCostUsd: updatedRunCost.fullWorkflowCostUsd,
        humanReviewCostUsd: updatedRunCost.humanReviewCostUsd,
        retryCostUsd: updatedRunCost.retryCostUsd,
        remediationCostUsd: updatedRunCost.remediationCostUsd,
        completedAt: createdAt,
        updatedAt: createdAt
      };
      const newRuns = current.runs.map((candidate) =>
        candidate.runId === run.runId ? updatedRun : candidate
      );
      const interimJob: TranslationJob = {
        ...job,
        status: statusFromDecision(input.decision),
        ...(input.decision === "ACCEPTED" ? { acceptedRunId: run.runId } : {}),
        latestRunId: run.runId,
        updatedAt: createdAt
      };
      const updatedEconomics = rollupJobEconomics({
        job: interimJob,
        runs: newRuns.filter((candidate) => candidate.jobId === job.jobId),
        ledgerItems: newLedgerItems
      });
      const updatedJob: TranslationJob = {
        ...interimJob,
        llmOnlyCostUsd: updatedEconomics.llmOnlyCostUsd,
        fullWorkflowCostUsd: updatedEconomics.fullWorkflowCostUsd,
        ...(updatedEconomics.costPerVerifiedOutcomeUsd === null
          ? {}
          : { costPerVerifiedOutcomeUsd: updatedEconomics.costPerVerifiedOutcomeUsd }),
        unitValueUsd: updatedEconomics.unitValueUsd,
        ...(updatedEconomics.unitMarginUsd === null ? {} : { unitMarginUsd: updatedEconomics.unitMarginUsd })
      };
      result = {
        ok: true,
        reviewDecision
      };

      return {
        ...current,
        jobs: current.jobs.map((candidate) => (candidate.jobId === job.jobId ? updatedJob : candidate)),
        runs: newRuns,
        ledgerItems: newLedgerItems,
        reviewDecisions: [...current.reviewDecisions, reviewDecision]
      };
    });

    return result;
  }, []);

  const value = useMemo<FixtureContextValue>(
    () => ({
      ...state,
      priceBook: activePriceBook,
      getDocument,
      getJob,
      getRun,
      getEvaluationForRun,
      getReviewDecisionForRun,
      listJobsForDocument,
      listRunsForJob,
      listStageEventsForRun,
      listArtifactsForRun,
      listLedgerForRun,
      listLedgerForJob,
      listComparisonJobs,
      runCost,
      jobEconomics,
      submitReview
    }),
    [
      state,
      getDocument,
      getJob,
      getRun,
      getEvaluationForRun,
      getReviewDecisionForRun,
      listJobsForDocument,
      listRunsForJob,
      listStageEventsForRun,
      listArtifactsForRun,
      listLedgerForRun,
      listLedgerForJob,
      listComparisonJobs,
      runCost,
      jobEconomics,
      submitReview
    ]
  );

  return <FixtureContext.Provider value={value}>{children}</FixtureContext.Provider>;
}

export function useFixtureApp(): FixtureContextValue {
  const context = useContext(FixtureContext);

  if (context === undefined) {
    throw new Error("useFixtureApp must be used within FixtureProvider");
  }

  return context;
}
