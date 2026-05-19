"use client";

import Link from "next/link";
import { AlertTriangle, Check, Eye, GitCompare, Plus, Upload } from "lucide-react";
import { useState } from "react";
import type {
  LedgerItem,
  ReviewDecisionValue,
  Run,
  TranslationJob
} from "@agentcore-pdf-translator/schemas";
import {
  costBasisLabel,
  formatDate,
  formatMoney,
  formatPercent,
  humanize,
  workflowVariantLabel
} from "./format";
import { useFixtureApp } from "./fixture-context";
import {
  CostBasisBadge,
  MoneyValue,
  NotFoundPanel,
  PageHeader,
  Panel,
  StatusBadge,
  SummaryCard,
  Tabs,
  WorkflowVariantBadge
} from "./ui";

function latestJob(jobs: ReadonlyArray<TranslationJob>): TranslationJob | undefined {
  return [...jobs].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
}

function latestAcceptedJob(jobs: ReadonlyArray<TranslationJob>): TranslationJob | undefined {
  return [...jobs]
    .filter((job) => job.status === "ACCEPTED")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
}

function runTabs(jobId: string, runId: string) {
  return [
    { href: `/jobs/${jobId}/runs/${runId}`, label: "Timeline" },
    { href: `/jobs/${jobId}/runs/${runId}/result`, label: "Result" },
    { href: `/jobs/${jobId}/runs/${runId}/evaluation`, label: "Evaluation" },
    { href: `/jobs/${jobId}/runs/${runId}/ledger`, label: "Ledger" }
  ];
}

function OutcomeCell({ job }: { readonly job: TranslationJob }) {
  const app = useFixtureApp();
  const economics = app.jobEconomics(job.jobId);

  return (
    <div>
      <StatusBadge status={job.status} />
      <div className="meta-list">
        <span>Full cost {formatMoney(economics?.fullWorkflowCostUsd ?? job.fullWorkflowCostUsd)}</span>
        <span>Margin {formatMoney(economics?.unitMarginUsd ?? job.unitMarginUsd)}</span>
      </div>
    </div>
  );
}

export function DocumentsPageContent() {
  const app = useFixtureApp();

  return (
    <div className="page">
      <PageHeader
        title="Documents"
        subtitle="Document to TranslationJob to Run to ReviewDecision to Economics."
        actions={
          <Link className="button primary" href="/documents/new">
            <Upload aria-hidden="true" size={18} />
            Upload PDF
          </Link>
        }
      />
      <Panel title="Document Library">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Document</th>
                <th>Source / Target</th>
                <th>Pages</th>
                <th>Images</th>
                <th>Status</th>
                <th>Latest job outcome</th>
                <th>Latest full workflow cost</th>
                <th>Latest unit margin</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {app.documents.map((document) => {
                const documentJobs = app.listJobsForDocument(document.documentId);
                const currentJob = latestJob(documentJobs);
                const acceptedJob = latestAcceptedJob(documentJobs);

                return (
                  <tr key={document.documentId}>
                    <td>
                      <strong>{document.title}</strong>
                      <div className="meta-list">
                        <span>{document.fileName}</span>
                      </div>
                    </td>
                    <td>{document.sourceLanguage} to {document.targetLanguage}</td>
                    <td>{document.pageCount ?? "N/A"}</td>
                    <td>{document.imageCount ?? "N/A"}</td>
                    <td><StatusBadge status={document.status} /></td>
                    <td>{currentJob === undefined ? "N/A" : <OutcomeCell job={currentJob} />}</td>
                    <td><MoneyValue value={currentJob?.fullWorkflowCostUsd} /></td>
                    <td><MoneyValue value={acceptedJob?.unitMarginUsd} /></td>
                    <td>{formatDate(document.updatedAt)}</td>
                    <td>
                      <div className="page-actions">
                        <Link className="icon-button" href={`/documents/${document.documentId}`} aria-label={`Open ${document.title}`}>
                          <Eye aria-hidden="true" size={17} />
                        </Link>
                        <Link className="icon-button" href={`/documents/${document.documentId}/jobs/new`} aria-label={`Start job for ${document.title}`}>
                          <Plus aria-hidden="true" size={17} />
                        </Link>
                        <Link className="icon-button" href="/compare/cmp_refunds" aria-label={`Compare jobs for ${document.title}`}>
                          <GitCompare aria-hidden="true" size={17} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

export function UploadDocumentPageContent() {
  return (
    <div className="page">
      <PageHeader title="Upload Document" subtitle="Controlled digitally generated Spanish PDFs only." />
      <Panel title="Document Intake">
        <div className="form-grid">
          <label>
            Source file
            <input type="file" accept="application/pdf" disabled />
          </label>
          <label>
            Source language
            <input value="Spanish" readOnly />
          </label>
          <label>
            Target language
            <input value="English" readOnly />
          </label>
          <label>
            Layout preservation
            <input value="Approximate" readOnly />
          </label>
        </div>
      </Panel>
      <Panel title="Supported Fixture">
        <div className="grid three">
          <SummaryCard label="PDF type" value="Digital" detail="Scanned-page estimate: 0" />
          <SummaryCard label="Pages" value="4" detail="Refund eligibility procedure" />
          <SummaryCard label="Status" value={<StatusBadge status="READY" />} detail="Usable for local UI checks" />
        </div>
      </Panel>
    </div>
  );
}

export function DocumentDetailPageContent({ documentId }: { readonly documentId: string }) {
  const app = useFixtureApp();
  const document = app.getDocument(documentId);

  if (document === undefined) {
    return <NotFoundPanel title="Document" />;
  }

  const documentJobs = app.listJobsForDocument(document.documentId);

  return (
    <div className="page">
      <PageHeader
        title={document.title}
        subtitle={`${document.sourceLanguage} to ${document.targetLanguage} PDF with ${document.pageCount ?? 0} pages and ${document.imageCount ?? 0} images.`}
        actions={
          <Link className="button primary" href={`/documents/${document.documentId}/jobs/new`}>
            <Plus aria-hidden="true" size={18} />
            Start Job
          </Link>
        }
      />
      <div className="grid four">
        <SummaryCard label="Document status" value={<StatusBadge status={document.status} />} />
        <SummaryCard label="Text blocks" value={document.textBlockCount ?? "N/A"} />
        <SummaryCard label="Scanned pages" value={document.estimatedScannedPageCount ?? "N/A"} />
        <SummaryCard label="Layout score" value={formatPercent(document.layoutComplexityScore)} detail="Complexity estimate" />
      </div>
      <Panel title="Inspection Results">
        <div className="grid two">
          <div>
            <dl className="meta-list">
              <dt>Source artifact</dt>
              <dd>{document.sourcePdfArtifactId}</dd>
              <dt>S3 key</dt>
              <dd>{document.sourcePdfS3Key}</dd>
            </dl>
            {document.inspectionWarnings.length === 0 ? null : (
              <ul className="warning-list">
                {document.inspectionWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="pdf-preview">
            <div className="pdf-page">
              <h3>{document.title}</h3>
              <p>Resumen, reglas, tabla SLA y diagrama de proceso con etiquetas en Espanol.</p>
            </div>
          </div>
        </div>
      </Panel>
      <Panel title="Translation Jobs">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Variant</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Accepted run</th>
                <th>LLM-only cost</th>
                <th>Full workflow cost</th>
                <th>Unit value</th>
                <th>Unit margin</th>
                <th>Created</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {documentJobs.map((job) => {
                const economics = app.jobEconomics(job.jobId);

                return (
                  <tr key={job.jobId}>
                    <td><WorkflowVariantBadge variant={job.workflowVariant} /></td>
                    <td><StatusBadge status={job.status} /></td>
                    <td>{job.totalAttemptCount}</td>
                    <td>{job.acceptedRunId ?? "N/A"}</td>
                    <td>{formatMoney(economics?.llmOnlyCostUsd ?? job.llmOnlyCostUsd)}</td>
                    <td>{formatMoney(economics?.fullWorkflowCostUsd ?? job.fullWorkflowCostUsd)}</td>
                    <td>{formatMoney(job.unitValueUsd)}</td>
                    <td>{formatMoney(economics?.unitMarginUsd ?? job.unitMarginUsd)}</td>
                    <td>{formatDate(job.createdAt)}</td>
                    <td><Link className="icon-button" href={`/jobs/${job.jobId}`} aria-label={`Open ${workflowVariantLabel(job.workflowVariant)}`}><Eye aria-hidden="true" size={17} /></Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

export function CreateJobPageContent({ documentId }: { readonly documentId: string }) {
  const app = useFixtureApp();
  const document = app.getDocument(documentId);

  if (document === undefined) {
    return <NotFoundPanel title="Create Translation Job" />;
  }

  return (
    <div className="page">
      <PageHeader title="Create Translation Job" subtitle={document.title} />
      <Panel title="Value Model">
        <div className="form-grid">
          <label>Workflow variant<select defaultValue="V1_TEXT_ONLY"><option>V1_TEXT_ONLY</option><option>V2_TEXT_AND_IMAGE_ANNOTATION</option><option>V3_OPTIMIZED</option></select></label>
          <label>Value per accepted PDF<input defaultValue="75.00" inputMode="decimal" /></label>
          <label>Manual translation baseline<input defaultValue="60.00" inputMode="decimal" /></label>
          <label>Manual review baseline<input defaultValue="15.00" inputMode="decimal" /></label>
          <label>Human review hourly rate<input defaultValue="90.00" inputMode="decimal" /></label>
          <label>Layout preservation<input value="APPROXIMATE" readOnly /></label>
        </div>
      </Panel>
      <Panel title="Fixture Jobs">
        <div className="grid three">
          {app.listJobsForDocument(document.documentId).map((job) => (
            <Link key={job.jobId} className="summary-card" href={`/jobs/${job.jobId}`}>
              <span>{workflowVariantLabel(job.workflowVariant)}</span>
              <strong><StatusBadge status={job.status} /></strong>
              <small>{formatMoney(job.fullWorkflowCostUsd)} full workflow cost</small>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function JobDetailPageContent({ jobId }: { readonly jobId: string }) {
  const app = useFixtureApp();
  const job = app.getJob(jobId);

  if (job === undefined) {
    return <NotFoundPanel title="Translation Job" />;
  }

  const document = app.getDocument(job.documentId);
  const runs = app.listRunsForJob(job.jobId);
  const economics = app.jobEconomics(job.jobId);

  return (
    <div className="page">
      <PageHeader title="Translation Job" subtitle={document?.title} actions={<WorkflowVariantBadge variant={job.workflowVariant} />} />
      <div className="grid four">
        <SummaryCard label="Job status" value={<StatusBadge status={job.status} />} />
        <SummaryCard label="Total attempts" value={runs.length} />
        <SummaryCard label="LLM-only cost" value={formatMoney(economics?.llmOnlyCostUsd)} />
        <SummaryCard label="Full workflow cost" value={formatMoney(economics?.fullWorkflowCostUsd)} />
        <SummaryCard label="Cost per verified outcome" value={formatMoney(economics?.costPerVerifiedOutcomeUsd)} />
        <SummaryCard label="Unit value" value={formatMoney(economics?.unitValueUsd ?? job.unitValueUsd)} />
        <SummaryCard label="Unit margin" value={formatMoney(economics?.unitMarginUsd)} />
        <SummaryCard label="Cost basis" value={<CostBasisBadge costBasis={job.costBasis} />} />
      </div>
      <Panel title="Run Attempts">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Attempt</th><th>Status</th><th>Started</th><th>Completed</th><th>Evaluation</th><th>Review</th><th>Full cost</th><th>Open</th></tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const evaluation = app.getEvaluationForRun(run.runId);
                const review = app.getReviewDecisionForRun(run.runId);

                return (
                  <tr key={run.runId}>
                    <td>{run.attemptNumber}</td>
                    <td><StatusBadge status={run.status} /></td>
                    <td>{formatDate(run.startedAt)}</td>
                    <td>{formatDate(run.completedAt)}</td>
                    <td>{formatPercent(evaluation?.score)}</td>
                    <td>{review?.decision ?? "N/A"}</td>
                    <td>{formatMoney(app.runCost(run.runId).fullWorkflowCostUsd)}</td>
                    <td><Link className="icon-button" href={`/jobs/${job.jobId}/runs/${run.runId}`} aria-label={`Open run ${run.runId}`}><Eye aria-hidden="true" size={17} /></Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

export function RunDetailPageContent({ jobId, runId }: { readonly jobId: string; readonly runId: string }) {
  const app = useFixtureApp();
  const run = app.getRun(runId);
  const job = app.getJob(jobId);

  if (run === undefined || job === undefined) {
    return <NotFoundPanel title="Run" />;
  }

  const events = app.listStageEventsForRun(run.runId);

  return (
    <div className="page">
      <PageHeader title={`Run ${run.attemptNumber}`} subtitle={`${workflowVariantLabel(run.workflowVariant)} technical attempt for ${job.jobId}`} actions={<StatusBadge status={run.status} />} />
      <Tabs links={runTabs(job.jobId, run.runId)} />
      <div className="grid four">
        <SummaryCard label="LLM-only cost" value={formatMoney(app.runCost(run.runId).llmOnlyCostUsd)} />
        <SummaryCard label="Full workflow cost" value={formatMoney(app.runCost(run.runId).fullWorkflowCostUsd)} />
        <SummaryCard label="Human review cost" value={formatMoney(app.runCost(run.runId).humanReviewCostUsd)} />
        <SummaryCard label="Trace ID" value={run.traceId ?? "N/A"} />
      </div>
      <Panel title="Stage Timeline">
        <div className="timeline">
          {events.map((event) => (
            <div className="timeline-row" key={event.stageEventId}>
              <span className="sequence">{event.sequence}</span>
              <div>
                <strong>{humanize(event.stageName)}</strong>
                <div className="meta-list">
                  <span>{event.durationMs ?? 0} ms</span>
                  <span>{event.toolName ?? "Internal stage"}</span>
                  <span>{event.modelId ?? "No model"}</span>
                  <span>{event.outputArtifactIds.length} outputs</span>
                  <span>Retries {event.retryCount}</span>
                  <span>{event.traceId ?? "No trace"}</span>
                </div>
                {event.warnings.length === 0 ? null : (
                  <ul className="warning-list">
                    {event.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                )}
              </div>
              <StatusBadge status={event.status} />
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function ResultPageContent({ jobId, runId }: { readonly jobId: string; readonly runId: string }) {
  const app = useFixtureApp();
  const run = app.getRun(runId);

  if (run === undefined || app.getJob(jobId) === undefined) {
    return <NotFoundPanel title="PDF Result" />;
  }

  const artifacts = app.listArtifactsForRun(run.runId);

  return (
    <div className="page">
      <PageHeader title="PDF Result" subtitle={workflowVariantLabel(run.workflowVariant)} actions={<StatusBadge status={run.status} />} />
      <Tabs links={runTabs(jobId, runId)} />
      <div className="grid two">
        <section className="pdf-preview" aria-label="Source Spanish PDF preview">
          <div className="pdf-page">
            <h3>Procedimiento de Reembolsos y Elegibilidad</h3>
            <p>Recibir solicitud, validar compra, evaluar elegibilidad, aprobar reembolso.</p>
          </div>
        </section>
        <section className="pdf-preview" aria-label="Translated English PDF preview">
          <div className="pdf-page">
            <h3>Refunds and Eligibility Procedure</h3>
            <p>Receive request, validate purchase, evaluate eligibility, approve refund.</p>
            {run.workflowVariant === "V1_TEXT_ONLY" ? <p><AlertTriangle aria-hidden="true" size={16} /> Diagram labels remain in Spanish.</p> : null}
          </div>
        </section>
      </div>
      <Panel title="Artifacts">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Artifact</th><th>Type</th><th>Content type</th><th>S3 key</th></tr></thead>
            <tbody>
              {artifacts.map((artifact) => (
                <tr key={artifact.artifactId}><td>{artifact.artifactId}</td><td>{humanize(artifact.artifactType)}</td><td>{artifact.contentType}</td><td>{artifact.s3Key}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

export function EvaluationPageContent({ jobId, runId }: { readonly jobId: string; readonly runId: string }) {
  const app = useFixtureApp();
  const run = app.getRun(runId);
  const evaluation = app.getEvaluationForRun(runId);

  if (run === undefined || app.getJob(jobId) === undefined || evaluation === undefined) {
    return <NotFoundPanel title="Evaluation" />;
  }

  return (
    <div className="page">
      <PageHeader title="Evaluation" subtitle={evaluation.notes} actions={<StatusBadge status={run.status} />} />
      <Tabs links={runTabs(jobId, runId)} />
      <div className="grid four">
        <SummaryCard label="Overall score" value={formatPercent(evaluation.score)} />
        <SummaryCard label="Passed checks" value={evaluation.passed ? <StatusBadge status="SUCCEEDED" /> : <StatusBadge status="FAILED" />} />
        <SummaryCard label="Semantic coverage" value={formatPercent(evaluation.semanticCoverageScore)} />
        <SummaryCard label="Terminology score" value={formatPercent(evaluation.terminologyScore)} />
        <SummaryCard label="Layout score" value={formatPercent(evaluation.layoutScore)} />
        <SummaryCard label="Image text score" value={formatPercent(evaluation.imageTextHandlingScore)} />
        <SummaryCard label="Missing chunks" value={evaluation.missingChunkCount} />
        <SummaryCard label="Untranslated Spanish" value={evaluation.untranslatedSpanishCount} />
      </div>
      <Panel title="Warnings">
        {[...evaluation.layoutWarnings, ...evaluation.terminologyWarnings, ...evaluation.imageWarnings].length === 0 ? (
          <div className="empty-state">No evaluation warnings.</div>
        ) : (
          <ul className="warning-list">
            {[...evaluation.layoutWarnings, ...evaluation.terminologyWarnings, ...evaluation.imageWarnings].map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        )}
      </Panel>
      <ReviewDecisionForm run={run} />
    </div>
  );
}

function ReviewDecisionForm({ run }: { readonly run: Run }) {
  const app = useFixtureApp();
  const [decision, setDecision] = useState<ReviewDecisionValue>("ACCEPTED");
  const [seconds, setSeconds] = useState("240");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<string | undefined>(undefined);
  const existingReview = app.getReviewDecisionForRun(run.runId);
  const isReviewable = run.status === "AWAITING_REVIEW";

  return (
    <Panel title="Reviewer Decision">
      {existingReview === undefined ? null : (
        <div className="summary-card">
          <span>Current decision</span>
          <strong>{humanize(existingReview.decision)}</strong>
          <small>{formatMoney(existingReview.estimatedReviewCostUsd)} review cost</small>
        </div>
      )}
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          const result = app.submitReview(run.runId, {
            decision,
            reviewerSeconds: Number(seconds),
            ...(reason.trim() === "" ? {} : { reason })
          });
          setMessage(result.ok ? `${humanize(result.reviewDecision.decision)} decision saved.` : result.error);
        }}
      >
        <label>
          Decision
          <select value={decision} onChange={(event) => setDecision(event.currentTarget.value as ReviewDecisionValue)} disabled={!isReviewable}>
            <option value="ACCEPTED">Accept</option>
            <option value="REJECTED">Reject</option>
            <option value="ESCALATED">Escalate</option>
          </select>
        </label>
        <label>
          Reviewer seconds
          <input value={seconds} onChange={(event) => setSeconds(event.currentTarget.value)} inputMode="numeric" disabled={!isReviewable} />
        </label>
        <label className="full-span">
          Reason
          <textarea value={reason} onChange={(event) => setReason(event.currentTarget.value)} disabled={!isReviewable} />
        </label>
        <div className="page-actions full-span">
          <button className="button primary" type="submit" disabled={!isReviewable || Number(seconds) <= 0}>
            <Check aria-hidden="true" size={18} />
            Save Decision
          </button>
        </div>
        {message === undefined ? null : <p className="full-span" role="status">{message}</p>}
      </form>
    </Panel>
  );
}

export function LedgerPageContent({ jobId, runId }: { readonly jobId: string; readonly runId: string }) {
  const app = useFixtureApp();
  const run = app.getRun(runId);

  if (run === undefined || app.getJob(jobId) === undefined) {
    return <NotFoundPanel title="Cost Ledger" />;
  }

  const ledger = app.listLedgerForRun(run.runId);
  const cost = app.runCost(run.runId);

  return (
    <div className="page">
      <PageHeader title="Cost Ledger" subtitle="LedgerItems are the source of truth for economics." actions={<StatusBadge status={run.status} />} />
      <Tabs links={runTabs(jobId, runId)} />
      <div className="grid four">
        <SummaryCard label="LLM-only cost" value={formatMoney(cost.llmOnlyCostUsd)} />
        <SummaryCard label="Full workflow cost" value={formatMoney(cost.fullWorkflowCostUsd)} />
        <SummaryCard label="Non-model cost" value={formatMoney(cost.fullWorkflowCostUsd - cost.llmOnlyCostUsd)} />
        <SummaryCard label="Human review cost" value={formatMoney(cost.humanReviewCostUsd)} />
      </div>
      <LedgerTable ledger={ledger} />
    </div>
  );
}

function LedgerTable({ ledger }: { readonly ledger: ReadonlyArray<LedgerItem> }) {
  return (
    <Panel title="Ledger Rows">
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Stage</th><th>Component type</th><th>Component name</th><th>Billable unit</th><th>Unit count</th><th>Unit price</th><th>Estimated cost</th><th>Cost source</th><th>Trace</th></tr>
          </thead>
          <tbody>
            {ledger.map((item) => (
              <tr key={item.ledgerItemId}>
                <td>{humanize(item.stageName)}</td>
                <td>{humanize(item.componentType)}</td>
                <td>{item.componentName}</td>
                <td>{humanize(item.billableUnit)}</td>
                <td>{item.unitCount}</td>
                <td>{formatMoney(item.unitPriceUsd)}</td>
                <td>{formatMoney(item.estimatedCostUsd)}</td>
                <td>{humanize(item.costSource)}</td>
                <td>{item.traceId ?? "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function ComparisonPageContent({ comparisonGroupId }: { readonly comparisonGroupId: string }) {
  const app = useFixtureApp();
  const comparisonJobs = app.listComparisonJobs(comparisonGroupId);

  if (comparisonJobs.length === 0) {
    return <NotFoundPanel title="Comparison" />;
  }

  const economics = comparisonJobs.map((job) => ({ job, economics: app.jobEconomics(job.jobId) }));
  const maxCost = Math.max(...economics.map((item) => item.economics?.fullWorkflowCostUsd ?? 0), 1);

  return (
    <div className="page">
      <PageHeader title="V1 / V2 / V3 Comparison" subtitle="Same controlled document and comparison group." />
      <Panel title="Variant Economics">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Variant</th><th>Job status</th><th>Accepted run</th><th>Evaluation score</th><th>Reviewer decision</th><th>LLM-only cost</th><th>Full workflow cost</th><th>Human review cost</th><th>Cost per verified outcome</th><th>Unit value</th><th>Unit margin</th></tr>
            </thead>
            <tbody>
              {economics.map(({ job, economics: jobEconomicsValue }) => {
                const latestRun = job.latestRunId === undefined ? undefined : app.getRun(job.latestRunId);
                const evaluation = latestRun === undefined ? undefined : app.getEvaluationForRun(latestRun.runId);
                const review = latestRun === undefined ? undefined : app.getReviewDecisionForRun(latestRun.runId);

                return (
                  <tr key={job.jobId}>
                    <td><WorkflowVariantBadge variant={job.workflowVariant} /></td>
                    <td><StatusBadge status={job.status} /></td>
                    <td>{job.acceptedRunId ?? "N/A"}</td>
                    <td>{formatPercent(evaluation?.score)}</td>
                    <td>{review?.decision ?? "N/A"}</td>
                    <td>{formatMoney(jobEconomicsValue?.llmOnlyCostUsd)}</td>
                    <td>{formatMoney(jobEconomicsValue?.fullWorkflowCostUsd)}</td>
                    <td>{formatMoney(jobEconomicsValue?.humanReviewCostUsd)}</td>
                    <td>{formatMoney(jobEconomicsValue?.costPerVerifiedOutcomeUsd)}</td>
                    <td>{formatMoney(jobEconomicsValue?.unitValueUsd)}</td>
                    <td>{formatMoney(jobEconomicsValue?.unitMarginUsd)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Full Workflow Cost by Variant">
        <div className="stacked-bars">
          {economics.map(({ job, economics: jobEconomicsValue }) => {
            const cost = jobEconomicsValue?.fullWorkflowCostUsd ?? 0;

            return (
              <div className="bar-row" key={job.jobId}>
                <div className="bar-label"><strong>{workflowVariantLabel(job.workflowVariant)}</strong><span>{formatMoney(cost)}</span></div>
                <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max((cost / maxCost) * 100, 3)}%` }} /></div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

export function EconomicsSettingsPageContent() {
  const app = useFixtureApp();

  return (
    <div className="page">
      <PageHeader title="Economics Settings" subtitle="Configured estimates are not AWS-bill-reconciled actuals." />
      <div className="grid four">
        <SummaryCard label="Price book" value={app.priceBook.priceBookVersion} />
        <SummaryCard label="Status" value={<span className="badge green">{app.priceBook.status}</span>} />
        <SummaryCard label="Currency" value={app.priceBook.currency} />
        <SummaryCard label="Default review rate" value={formatMoney(app.priceBook.humanReviewHourlyRateDefaultUsd)} />
      </div>
      <Panel title="Model Prices">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Model</th><th>Input / 1K</th><th>Output / 1K</th><th>Provider</th></tr></thead>
            <tbody>
              {app.priceBook.modelPrices.map((price) => (
                <tr key={price.modelId}><td>{price.modelId}</td><td>{formatMoney(price.inputTokenPricePer1K)}</td><td>{formatMoney(price.outputTokenPricePer1K)}</td><td>{price.provider}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Cost Basis">
        <div className="grid two">
          <SummaryCard label="Displayed basis" value={costBasisLabel("TELEMETRY_DERIVED_PRICE_BOOK_ESTIMATE")} detail="Ledger units multiplied by configured fixture rates" />
          <SummaryCard label="Source notes" value={app.priceBook.sourceNotes.join(", ")} />
        </div>
      </Panel>
    </div>
  );
}
