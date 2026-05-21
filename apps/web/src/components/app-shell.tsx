"use client";

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
  Download,
  FilePlus2,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  Settings,
  ShieldAlert,
  Upload
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { apiClient, ApiClientError, isReadyDocument } from "../lib/api-client";
import { buildInfo } from "../lib/build-info";
import {
  costBasisLabel,
  formatDate,
  formatMoney,
  humanize,
  workflowVariantLabel
} from "./format";
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

type ResourceState<T> =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly error: Error }
  | { readonly status: "ready"; readonly data: T };

type Navigate = (href: string) => void;

const v1Options = {
  enablePolicyChecks: false,
  enableMemory: false,
  preserveLayout: "APPROXIMATE" as const
};

function normalizePath(pathname: string): string {
  const trimmed = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;
  return trimmed === "/" ? "/documents" : trimmed;
}

function useCurrentPath(): [string, Navigate] {
  const [path, setPath] = useState("/documents");

  useEffect(() => {
    const updateFromBrowser = () => {
      const nextPath = normalizePath(window.location.pathname);
      if (window.location.pathname === "/") {
        window.history.replaceState(null, "", nextPath);
      }
      setPath(nextPath);
    };

    updateFromBrowser();
    window.addEventListener("popstate", updateFromBrowser);
    return () => window.removeEventListener("popstate", updateFromBrowser);
  }, []);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest("a[data-app-link]");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (anchor.target !== "" || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const url = new URL(anchor.href);
      if (url.origin !== window.location.origin) {
        return;
      }

      event.preventDefault();
      const nextPath = normalizePath(url.pathname);
      window.history.pushState(null, "", nextPath);
      setPath(nextPath);
      window.scrollTo({ top: 0 });
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const navigate: Navigate = (href) => {
    const nextPath = normalizePath(href);
    window.history.pushState(null, "", nextPath);
    setPath(nextPath);
    window.scrollTo({ top: 0 });
  };

  return [path, navigate];
}

function useResource<T>(loader: () => Promise<T>, key: string): {
  readonly state: ResourceState<T>;
  readonly reload: () => void;
} {
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<ResourceState<T>>({ status: "loading" });

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    loader()
      .then((data) => {
        if (active) {
          setState({ status: "ready", data });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            status: "error",
            error: error instanceof Error ? error : new Error("Request failed")
          });
        }
      });

    return () => {
      active = false;
    };
  }, [key, refresh]);

  return {
    state,
    reload: () => setRefresh((value) => value + 1)
  };
}

function AppLink({
  href,
  children,
  className,
  title
}: {
  readonly href: string;
  readonly children: ReactNode;
  readonly className?: string | undefined;
  readonly title?: string | undefined;
}) {
  return (
    <a href={href} data-app-link="" className={className} title={title}>
      {children}
    </a>
  );
}

function LoadingPanel({ title = "Loading" }: { readonly title?: string }) {
  return (
    <Panel title={title}>
      <div className="status-message">
        <Loader2 aria-hidden="true" size={18} />
        <span>Loading current persisted data.</span>
      </div>
    </Panel>
  );
}

function ErrorPanel({ title, error }: { readonly title: string; readonly error: Error }) {
  return (
    <Panel title={title}>
      <div className="notice error" role="alert">
        {formatError(error)}
      </div>
    </Panel>
  );
}

function formatError(error: Error): string {
  if (error instanceof ApiClientError) {
    return `${error.code}: ${error.message}`;
  }

  return error.message;
}

function renderResource<T>(
  state: ResourceState<T>,
  title: string,
  render: (data: T) => ReactNode
): ReactNode {
  if (state.status === "loading") {
    return <LoadingPanel title={title} />;
  }

  if (state.status === "error") {
    return <ErrorPanel title={title} error={state.error} />;
  }

  return render(state.data);
}

function pathSegments(path: string): ReadonlyArray<string> {
  return path.split("/").filter((segment) => segment.length > 0).map(decodeURIComponent);
}

function shortSha(sha: string): string {
  return sha === "local" ? "local" : sha.slice(0, 12);
}

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(await file.arrayBuffer()));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function openArtifact(
  artifactId: string,
  onStatus: (message: string) => void,
  onError: (message: string) => void
): Promise<void> {
  try {
    onError("");
    const response = await apiClient.getArtifactDownloadUrl(artifactId);
    window.open(response.downloadUrl, "_blank", "noopener,noreferrer");
    onStatus("Private artifact URL opened in a new tab. The signed URL is not displayed in the app.");
  } catch (error) {
    onStatus("");
    onError(formatError(error instanceof Error ? error : new Error("Artifact request failed")));
  }
}

export function AppShell() {
  const [path, navigate] = useCurrentPath();
  const segments = pathSegments(path);

  return (
    <div className="app-shell">
      <header className="top-nav">
        <AppLink href="/documents" className="brand" title="Open documents">
          AgentCore Unit Economics
        </AppLink>
        <nav aria-label="Primary navigation">
          <AppLink href="/documents" title="Documents">
            <FileText aria-hidden="true" size={18} />
            <span className="nav-label">Documents</span>
          </AppLink>
          <AppLink href="/settings/economics" title="Economics">
            <Settings aria-hidden="true" size={18} />
            <span className="nav-label">Economics</span>
          </AppLink>
        </nav>
      </header>
      <main>{renderRoute(segments, navigate)}</main>
    </div>
  );
}

function renderRoute(segments: ReadonlyArray<string>, navigate: Navigate): ReactNode {
  if (segments.length === 1 && segments[0] === "documents") {
    return <DocumentsPage />;
  }

  if (segments.length === 2 && segments[0] === "documents" && segments[1] === "new") {
    return <NewDocumentPage navigate={navigate} />;
  }

  if (segments.length === 2 && segments[0] === "documents") {
    return <DocumentPage documentId={segments[1] ?? ""} />;
  }

  if (
    segments.length === 4 &&
    segments[0] === "documents" &&
    segments[2] === "jobs" &&
    segments[3] === "new"
  ) {
    return <NewJobPage documentId={segments[1] ?? ""} navigate={navigate} />;
  }

  if (segments.length === 2 && segments[0] === "jobs") {
    return <JobPage jobId={segments[1] ?? ""} />;
  }

  if (
    segments.length === 4 &&
    segments[0] === "jobs" &&
    segments[2] === "runs"
  ) {
    return <RunPage jobId={segments[1] ?? ""} runId={segments[3] ?? ""} />;
  }

  if (
    segments.length === 5 &&
    segments[0] === "jobs" &&
    segments[2] === "runs" &&
    segments[4] === "ledger"
  ) {
    return <RunLedgerPage jobId={segments[1] ?? ""} runId={segments[3] ?? ""} />;
  }

  if (
    segments.length === 5 &&
    segments[0] === "jobs" &&
    segments[2] === "runs" &&
    segments[4] === "evaluation"
  ) {
    return <RunEvaluationPage jobId={segments[1] ?? ""} runId={segments[3] ?? ""} />;
  }

  if (
    segments.length === 5 &&
    segments[0] === "jobs" &&
    segments[2] === "runs" &&
    segments[4] === "result"
  ) {
    return <RunResultPage jobId={segments[1] ?? ""} runId={segments[3] ?? ""} />;
  }

  if (segments.length === 2 && segments[0] === "settings" && segments[1] === "economics") {
    return <EconomicsSettingsPage />;
  }

  if (segments.length === 2 && segments[0] === "compare") {
    return <ComparisonPage comparisonGroupId={segments[1] ?? ""} />;
  }

  return <NotFoundPanel title="Route not found" />;
}

function DocumentsPage() {
  const { state, reload } = useResource(() => apiClient.listDocuments(), "documents");

  return (
    <div className="page">
      <PageHeader
        title="Documents"
        subtitle="Controlled Spanish PDFs registered in the persistent dev environment."
        actions={
          <>
            <button className="icon-button" type="button" onClick={reload} title="Refresh documents">
              <RefreshCw aria-hidden="true" size={18} />
            </button>
            <AppLink className="button primary" href="/documents/new">
              <Upload aria-hidden="true" size={18} />
              Upload PDF
            </AppLink>
          </>
        }
      />
      {renderResource(state, "Documents", ({ documents }) => (
        <Panel title="Persisted documents">
          {documents.length === 0 ? (
            <div className="empty-state">No documents have been uploaded through the deployed app yet.</div>
          ) : (
            <DocumentTable documents={documents} />
          )}
        </Panel>
      ))}
      <BuildPanel />
    </div>
  );
}

function DocumentTable({ documents }: { readonly documents: ReadonlyArray<Document> }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Source</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.documentId}>
              <td>
                <strong>{document.title}</strong>
                <div className="muted-text">{document.documentId}</div>
              </td>
              <td>
                <StatusBadge status={document.status} />
              </td>
              <td>
                {document.fileName}
                <div className="muted-text">{Math.round(document.fileSizeBytes / 1024)} KB</div>
              </td>
              <td>{formatDate(document.createdAt)}</td>
              <td>
                <div className="row-actions">
                  <AppLink className="button secondary" href={`/documents/${document.documentId}`}>
                    Open
                  </AppLink>
                  {isReadyDocument(document) ? (
                    <AppLink className="button secondary" href={`/documents/${document.documentId}/jobs/new`}>
                      New job
                    </AppLink>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NewDocumentPage({ navigate }: { readonly navigate: Navigate }) {
  const [title, setTitle] = useState("Procedimiento de Reembolsos y Elegibilidad");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (file === null) {
      setError("Choose a controlled Spanish PDF before uploading.");
      return;
    }

    setSubmitting(true);
    setStatus("Hashing PDF and requesting upload authorization.");
    setError("");

    try {
      const sha256 = await sha256Hex(file);
      const presign = await apiClient.presignDocumentUpload({
        fileName: file.name,
        contentType: "application/pdf",
        sizeBytes: file.size,
        sha256
      });
      setStatus("Uploading PDF bytes directly to private S3 object storage.");
      await apiClient.uploadSourcePdf(presign.uploadUrl, file, presign.requiredHeaders);
      setStatus("Registering persisted document metadata.");
      const created = await apiClient.createDocument({
        documentId: presign.documentId,
        title,
        fileName: file.name,
        s3Key: presign.s3Key,
        contentType: "application/pdf",
        sizeBytes: file.size,
        sha256
      });
      navigate(`/documents/${created.document.documentId}`);
    } catch (caught) {
      setStatus("");
      setError(formatError(caught instanceof Error ? caught : new Error("Upload failed")));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Upload controlled PDF"
        subtitle="The MVP accepts controlled, digitally generated Spanish PDFs only."
        actions={
          <AppLink className="button secondary" href="/documents">
            Documents
          </AppLink>
        }
      />
      <Panel title="Source PDF">
        <form className="form-grid" onSubmit={submit}>
          <label>
            Document title
            <input value={title} onChange={(event) => setTitle(event.target.value)} required />
          </label>
          <label>
            Source PDF
            <input
              type="file"
              accept="application/pdf,.pdf"
              required
              onChange={(event) => setFile(event.target.files?.item(0) ?? null)}
            />
          </label>
          <label>
            Source language
            <input value="Spanish" readOnly />
          </label>
          <label>
            Target language
            <input value="English" readOnly />
          </label>
          <div className="full-span form-actions">
            <button className="button primary" type="submit" disabled={submitting}>
              <Upload aria-hidden="true" size={18} />
              {submitting ? "Uploading" : "Upload and register"}
            </button>
          </div>
        </form>
        <StatusMessages status={status} error={error} />
      </Panel>
    </div>
  );
}

function DocumentPage({ documentId }: { readonly documentId: string }) {
  const { state, reload } = useResource(() => apiClient.getDocumentJobs(documentId), `document:${documentId}`);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const inspect = async () => {
    setBusy(true);
    setStatus("");
    setError("");
    try {
      const document = await apiClient.inspectDocument(documentId);
      setStatus(`Inspection completed with status ${humanize(document.status)}.`);
      reload();
    } catch (caught) {
      setError(formatError(caught instanceof Error ? caught : new Error("Inspection failed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      {renderResource(state, "Document", ({ document, jobs }) => (
        <>
          <PageHeader
            title={document.title}
            subtitle={`${document.fileName} · ${document.documentId}`}
            actions={
              <>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => void openArtifact(document.sourcePdfArtifactId, setStatus, setError)}
                >
                  <Download aria-hidden="true" size={18} />
                  Open source PDF
                </button>
                <button className="button secondary" type="button" onClick={inspect} disabled={busy}>
                  <RefreshCw aria-hidden="true" size={18} />
                  Inspect
                </button>
                <AppLink
                  className="button primary"
                  href={`/documents/${document.documentId}/jobs/new`}
                  title={isReadyDocument(document) ? "Create V1 job" : "Document must be READY before job creation"}
                >
                  <FilePlus2 aria-hidden="true" size={18} />
                  New job
                </AppLink>
              </>
            }
          />
          <StatusMessages status={status} error={error} />
          <div className="grid four">
            <SummaryCard label="Status" value={<StatusBadge status={document.status} />} />
            <SummaryCard label="Pages" value={document.pageCount ?? "N/A"} />
            <SummaryCard label="Text blocks" value={document.textBlockCount ?? "N/A"} />
            <SummaryCard label="Images" value={document.imageCount ?? "N/A"} />
          </div>
          <Panel title="Inspection notes">
            {document.inspectionWarnings.length === 0 ? (
              <div className="empty-state compact">No inspection warnings have been recorded.</div>
            ) : (
              <ul className="warning-list">
                {document.inspectionWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Translation jobs">
            {jobs.length === 0 ? (
              <div className="empty-state">No translation jobs have been created for this document.</div>
            ) : (
              <JobTable jobs={jobs} />
            )}
          </Panel>
        </>
      ))}
    </div>
  );
}

function JobTable({ jobs }: { readonly jobs: ReadonlyArray<TranslationJob> }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Job</th>
            <th>Workflow</th>
            <th>Status</th>
            <th>Full cost</th>
            <th>Unit margin</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.jobId}>
              <td>{job.jobId}</td>
              <td>
                <WorkflowVariantBadge variant={job.workflowVariant} />
              </td>
              <td>
                <StatusBadge status={job.status} />
              </td>
              <td>
                <MoneyValue value={job.fullWorkflowCostUsd} />
              </td>
              <td>
                <MoneyValue value={job.unitMarginUsd} />
              </td>
              <td>
                <AppLink className="button secondary" href={`/jobs/${job.jobId}`}>
                  Open
                </AppLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NewJobPage({ documentId, navigate }: { readonly documentId: string; readonly navigate: Navigate }) {
  const { state } = useResource(
    async () => {
      const [document, currentPriceBook] = await Promise.all([
        apiClient.getDocument(documentId),
        apiClient.getCurrentPriceBook()
      ]);
      return { document, currentPriceBook };
    },
    `new-job:${documentId}`
  );

  return (
    <div className="page">
      {renderResource(state, "New job", ({ document, currentPriceBook }) => (
        <NewJobForm document={document} priceBook={currentPriceBook.priceBook} navigate={navigate} />
      ))}
    </div>
  );
}

function NewJobForm({
  document,
  priceBook,
  navigate
}: {
  readonly document: Document;
  readonly priceBook: PriceBook;
  readonly navigate: Navigate;
}) {
  const [valuePerAcceptedPdfUsd, setValuePerAcceptedPdfUsd] = useState("");
  const [humanReviewHourlyRateUsd, setHumanReviewHourlyRateUsd] = useState(
    priceBook.humanReviewHourlyRateDefaultUsd.toFixed(2)
  );
  const [createComparisonGroup, setCreateComparisonGroup] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const documentReady = isReadyDocument(document);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setStatus("Creating a persisted V1 job.");
    setError("");

    try {
      const created = await apiClient.createJob(document.documentId, {
        workflowVariant: "V1_TEXT_ONLY",
        valueModel: {
          valuePerAcceptedPdfUsd: Number(valuePerAcceptedPdfUsd),
          humanReviewHourlyRateUsd: Number(humanReviewHourlyRateUsd)
        },
        options: v1Options,
        ...(createComparisonGroup ? { createComparisonGroup: true } : {})
      });
      navigate(`/jobs/${created.job.jobId}`);
    } catch (caught) {
      setStatus("");
      setError(formatError(caught instanceof Error ? caught : new Error("Job creation failed")));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Create V1 translation job"
        subtitle={`${document.title} · ${workflowVariantLabel("V1_TEXT_ONLY")}`}
        actions={
          <AppLink className="button secondary" href={`/documents/${document.documentId}`}>
            Document
          </AppLink>
        }
      />
      {!documentReady ? (
        <div className="notice warning" role="status">
          Document status is {humanize(document.status)}. Inspect the document and reach READY before creating jobs.
        </div>
      ) : null}
      <Panel title="Job economics">
        <form className="form-grid" onSubmit={submit}>
          <label>
            Workflow variant
            <input value="V1 text only" readOnly />
          </label>
          <label>
            Price book
            <input value={priceBook.priceBookVersion} readOnly />
          </label>
          <label>
            Value per accepted PDF
            <input
              inputMode="decimal"
              min="0.0001"
              step="0.0001"
              type="number"
              value={valuePerAcceptedPdfUsd}
              onChange={(event) => setValuePerAcceptedPdfUsd(event.target.value)}
              placeholder="0.0000"
              required
            />
          </label>
          <label>
            Human review hourly rate
            <input
              inputMode="decimal"
              min="0.0001"
              step="0.0001"
              type="number"
              value={humanReviewHourlyRateUsd}
              onChange={(event) => setHumanReviewHourlyRateUsd(event.target.value)}
              required
            />
          </label>
          <label className="full-span checkbox-row">
            <input
              type="checkbox"
              checked={createComparisonGroup}
              onChange={(event) => setCreateComparisonGroup(event.target.checked)}
            />
            Create a real persisted comparison group for this job
          </label>
          <div className="full-span form-actions">
            <button className="button primary" type="submit" disabled={!documentReady || submitting}>
              <FilePlus2 aria-hidden="true" size={18} />
              Create job
            </button>
          </div>
        </form>
        <StatusMessages status={status} error={error} />
      </Panel>
    </>
  );
}

function JobPage({ jobId }: { readonly jobId: string }) {
  const { state, reload } = useResource(
    async () => {
      const [runsResponse, economicsResponse] = await Promise.all([
        apiClient.getJobRuns(jobId),
        apiClient.getJobEconomics(jobId)
      ]);
      return {
        job: economicsResponse.job,
        runs: runsResponse.runs,
        economics: economicsResponse.economics
      };
    },
    `job:${jobId}`
  );
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const startRun = async () => {
    setBusy(true);
    setStatus("");
    setError("");
    try {
      const created = await apiClient.startRun(jobId);
      setStatus(`Run ${created.run.runId} executed through the PR-011 pre-Gateway proof runner.`);
      reload();
    } catch (caught) {
      setError(formatError(caught instanceof Error ? caught : new Error("Run creation failed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      {renderResource(state, "Job", ({ job, runs, economics }) => (
        <>
          <PageHeader
            title={`Job ${job.jobId}`}
            subtitle={`Document ${job.documentId} · ${workflowVariantLabel(job.workflowVariant)}`}
            actions={
              <>
                <button className="button primary" type="button" onClick={startRun} disabled={busy}>
                  <Play aria-hidden="true" size={18} />
                  Start run
                </button>
                <AppLink className="button secondary" href={`/documents/${job.documentId}`}>
                  Document
                </AppLink>
              </>
            }
          />
          <StatusMessages status={status} error={error} />
          <div className="grid four">
            <SummaryCard label="Status" value={<StatusBadge status={job.status} />} />
            <SummaryCard label="Attempts" value={job.totalAttemptCount} />
            <SummaryCard label="LLM-only cost" value={<MoneyValue value={economics.llmOnlyCostUsd} />} />
            <SummaryCard label="Full workflow cost" value={<MoneyValue value={economics.fullWorkflowCostUsd} />} />
          </div>
          <Panel title="Job economics">
            <div className="grid four">
              <SummaryCard label="Human review cost" value={<MoneyValue value={economics.humanReviewCostUsd} />} />
              <SummaryCard label="Retry cost" value={<MoneyValue value={economics.retryCostUsd} />} />
              <SummaryCard
                label="Cost per verified outcome"
                value={<MoneyValue value={economics.costPerVerifiedOutcomeUsd} />}
              />
              <SummaryCard label="Unit margin" value={<MoneyValue value={economics.unitMarginUsd} />} />
            </div>
            <p className="muted-text">
              Basis: {costBasisLabel(economics.costBasis)}. Ledger items remain the economics source of truth.
            </p>
          </Panel>
          <Panel title="Runs">
            {runs.length === 0 ? (
              <div className="empty-state">No run attempts have been created for this job.</div>
            ) : (
              <RunTable job={job} runs={runs} />
            )}
          </Panel>
        </>
      ))}
    </div>
  );
}

function RunTable({
  job,
  runs
}: {
  readonly job: TranslationJob;
  readonly runs: ReadonlyArray<Run>;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Attempt</th>
            <th>Status</th>
            <th>Full cost</th>
            <th>Human review</th>
            <th>Created</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.runId}>
              <td>
                #{run.attemptNumber}
                <div className="muted-text">{run.runId}</div>
              </td>
              <td>
                <StatusBadge status={run.status} />
              </td>
              <td>
                <MoneyValue value={run.fullWorkflowCostUsd} />
              </td>
              <td>
                <MoneyValue value={run.humanReviewCostUsd} />
              </td>
              <td>{formatDate(run.createdAt)}</td>
              <td>
                <AppLink className="button secondary" href={`/jobs/${job.jobId}/runs/${run.runId}`}>
                  Open
                </AppLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RunPage({ jobId, runId }: { readonly jobId: string; readonly runId: string }) {
  const { state, reload } = useResource(() => apiClient.getRunTimeline(runId), `run:${runId}:timeline`);

  return (
    <div className="page">
      {renderResource(state, "Run", ({ run, stageEvents }) => (
        <>
          <RunHeader jobId={jobId} run={run} />
          <RunTabs jobId={jobId} runId={runId} />
          <Panel
            title="Stage timeline"
            action={
              <button className="icon-button" type="button" onClick={reload} title="Refresh timeline">
                <RefreshCw aria-hidden="true" size={18} />
              </button>
            }
          >
            {stageEvents.length === 0 ? (
              <div className="empty-state">No stage events exist yet.</div>
            ) : (
              <StageTimeline stageEvents={stageEvents} />
            )}
          </Panel>
        </>
      ))}
    </div>
  );
}

function RunHeader({ jobId, run }: { readonly jobId: string; readonly run: Run }) {
  const executionLabel =
    run.provenance?.executionBackend === "PRE_GATEWAY_STAGE_RUNNER" ? " · pre-Gateway proof" : "";

  return (
    <PageHeader
      title={`Run ${run.runId}`}
      subtitle={`Job ${jobId} · attempt ${run.attemptNumber}${executionLabel}`}
      actions={
        <AppLink className="button secondary" href={`/jobs/${jobId}`}>
          Job
        </AppLink>
      }
    />
  );
}

function RunTabs({ jobId, runId }: { readonly jobId: string; readonly runId: string }) {
  return (
    <Tabs
      links={[
        { href: `/jobs/${jobId}/runs/${runId}`, label: "Timeline" },
        { href: `/jobs/${jobId}/runs/${runId}/evaluation`, label: "Evaluation" },
        { href: `/jobs/${jobId}/runs/${runId}/ledger`, label: "Ledger" },
        { href: `/jobs/${jobId}/runs/${runId}/result`, label: "Result" }
      ]}
    />
  );
}

function StageTimeline({ stageEvents }: { readonly stageEvents: ReadonlyArray<StageEvent> }) {
  return (
    <div className="timeline">
      {stageEvents.map((event) => (
        <div className="timeline-row" key={event.stageEventId}>
          <span className="sequence">{event.sequence}</span>
          <div>
            <strong>{humanize(event.stageName)}</strong>
            <div className="meta-list">
              <span>{event.toolName ?? "No tool"}</span>
              <span>{event.durationMs === undefined ? "N/A" : `${event.durationMs} ms`}</span>
              <span>{event.provenance?.implementationLabel ?? event.traceId ?? "No trace"}</span>
            </div>
          </div>
          <StatusBadge status={event.status} />
        </div>
      ))}
    </div>
  );
}

function RunLedgerPage({ jobId, runId }: { readonly jobId: string; readonly runId: string }) {
  const { state } = useResource(
    async () => {
      const [run, ledger] = await Promise.all([apiClient.getRun(runId), apiClient.getRunLedger(runId)]);
      return { run, ledgerItems: ledger.ledgerItems };
    },
    `run:${runId}:ledger`
  );

  return (
    <div className="page">
      {renderResource(state, "Run ledger", ({ run, ledgerItems }) => (
        <>
          <RunHeader jobId={jobId} run={run} />
          <RunTabs jobId={jobId} runId={runId} />
          <Panel title="Ledger items">
            {ledgerItems.length === 0 ? (
              <div className="empty-state">No ledger items exist for this run yet.</div>
            ) : (
              <LedgerTable ledgerItems={ledgerItems} />
            )}
          </Panel>
        </>
      ))}
    </div>
  );
}

function LedgerTable({ ledgerItems }: { readonly ledgerItems: ReadonlyArray<LedgerItem> }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Stage</th>
            <th>Component</th>
            <th>Unit count</th>
            <th>Estimated cost</th>
            <th>Cost source</th>
            <th>Price book</th>
          </tr>
        </thead>
        <tbody>
          {ledgerItems.map((item) => (
            <tr key={item.ledgerItemId}>
              <td>{humanize(item.stageName)}</td>
              <td>
                {humanize(item.componentType)}
                <div className="muted-text">{item.componentName}</div>
              </td>
              <td>
                {item.unitCount} {humanize(item.billableUnit)}
              </td>
              <td>
                <MoneyValue value={item.estimatedCostUsd} />
              </td>
              <td>{humanize(item.costSource)}</td>
              <td>{item.priceBookVersion}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RunEvaluationPage({ jobId, runId }: { readonly jobId: string; readonly runId: string }) {
  const { state, reload } = useResource(() => apiClient.getRunEvaluation(runId), `run:${runId}:evaluation`);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submitReviewGuardProbe = async () => {
    setBusy(true);
    setStatus("");
    setError("");
    try {
      await apiClient.reviewRun(runId, {
        decision: "ACCEPTED",
        reviewerSeconds: 60,
        reason: "Dev verification reviewability guard probe"
      });
      setStatus("Review decision recorded.");
      reload();
    } catch (caught) {
      setError(formatError(caught instanceof Error ? caught : new Error("Review action failed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      {renderResource(state, "Evaluation", ({ run, evaluation }) => (
        <>
          <RunHeader jobId={jobId} run={run} />
          <RunTabs jobId={jobId} runId={runId} />
          <StatusMessages status={status} error={error} />
          <Panel
            title="Evaluation"
            action={
              <button className="button secondary" type="button" onClick={submitReviewGuardProbe} disabled={busy}>
                <ShieldAlert aria-hidden="true" size={18} />
                Probe review guard
              </button>
            }
          >
            {evaluation === null ? (
              <div className="empty-state">
                No automated evaluation exists yet. Reviewer acceptance remains unavailable until a run reaches
                AWAITING_REVIEW with evaluation evidence.
              </div>
            ) : (
              <>
                <div className="grid four">
                  <SummaryCard label="Score" value={`${Math.round(evaluation.score * 100)}%`} />
                  <SummaryCard label="Passed" value={evaluation.passed ? "Yes" : "No"} />
                  <SummaryCard label="Terminology" value={`${Math.round(evaluation.terminologyScore * 100)}%`} />
                  <SummaryCard label="Layout" value={`${Math.round(evaluation.layoutScore * 100)}%`} />
                </div>
                {evaluation.provenance?.executionBackend === "PRE_GATEWAY_STAGE_RUNNER" ? (
                  <p className="muted-text">
                    Execution basis: PR-011 pre-Gateway development proof. This is not real V1 PDF quality evidence.
                  </p>
                ) : null}
              </>
            )}
          </Panel>
        </>
      ))}
    </div>
  );
}

function RunResultPage({ jobId, runId }: { readonly jobId: string; readonly runId: string }) {
  const { state } = useResource(() => apiClient.getRunArtifacts(runId), `run:${runId}:artifacts`);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="page">
      {renderResource(state, "Run result", ({ run, artifacts }) => (
        <>
          <RunHeader jobId={jobId} run={run} />
          <RunTabs jobId={jobId} runId={runId} />
          <StatusMessages status={status} error={error} />
          <Panel title="Artifacts">
            {artifacts.length === 0 ? (
              <div className="empty-state">No artifacts were found for this run.</div>
            ) : (
              <ArtifactTable artifacts={artifacts} setStatus={setStatus} setError={setError} />
            )}
          </Panel>
        </>
      ))}
    </div>
  );
}

function ArtifactTable({
  artifacts,
  setStatus,
  setError
}: {
  readonly artifacts: ReadonlyArray<Artifact>;
  readonly setStatus: (message: string) => void;
  readonly setError: (message: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Artifact</th>
            <th>Type</th>
            <th>Content type</th>
            <th>Created</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {artifacts.map((artifact) => (
            <tr key={artifact.artifactId}>
              <td>{artifact.artifactId}</td>
              <td>{humanize(artifact.artifactType)}</td>
              <td>{artifact.contentType}</td>
              <td>{formatDate(artifact.createdAt)}</td>
              <td>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => void openArtifact(artifact.artifactId, setStatus, setError)}
                >
                  <Download aria-hidden="true" size={18} />
                  Open
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EconomicsSettingsPage() {
  const { state, reload } = useResource(() => apiClient.getCurrentPriceBook(), "settings:economics");

  return (
    <div className="page">
      <PageHeader
        title="Economics settings"
        subtitle="Current persisted price book used for cost assumptions."
        actions={
          <button className="icon-button" type="button" onClick={reload} title="Refresh price book">
            <RefreshCw aria-hidden="true" size={18} />
          </button>
        }
      />
      {renderResource(state, "Price book", ({ priceBook, setting }) => (
        <>
          <div className="grid four">
            <SummaryCard label="Active setting" value={setting.settingValue} detail={formatDate(setting.updatedAt)} />
            <SummaryCard label="Price book status" value={humanize(priceBook.status)} />
            <SummaryCard
              label="Human review default"
              value={formatMoney(priceBook.humanReviewHourlyRateDefaultUsd)}
            />
            <SummaryCard label="Currency" value={priceBook.currency} />
          </div>
          <Panel title="Model prices">
            {priceBook.modelPrices.length === 0 ? (
              <div className="empty-state">No model prices are present in the active price book.</div>
            ) : (
              <ModelPricesTable priceBook={priceBook} />
            )}
          </Panel>
          <Panel title="Source notes">
            <ul className="warning-list neutral-list">
              {priceBook.sourceNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </Panel>
        </>
      ))}
    </div>
  );
}

function ModelPricesTable({ priceBook }: { readonly priceBook: PriceBook }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Model ID</th>
            <th>Input / 1K</th>
            <th>Output / 1K</th>
            <th>Cache read / 1K</th>
            <th>Cache write / 1K</th>
          </tr>
        </thead>
        <tbody>
          {priceBook.modelPrices.map((price) => (
            <tr key={price.modelId}>
              <td>{price.provider}</td>
              <td>{price.modelId}</td>
              <td>{formatMoney(price.inputTokenPricePer1K)}</td>
              <td>{formatMoney(price.outputTokenPricePer1K)}</td>
              <td>{formatMoney(price.cacheReadTokenPricePer1K)}</td>
              <td>{formatMoney(price.cacheWriteTokenPricePer1K)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComparisonPage({ comparisonGroupId }: { readonly comparisonGroupId: string }) {
  const { state } = useResource(() => apiClient.getComparison(comparisonGroupId), `compare:${comparisonGroupId}`);

  return (
    <div className="page">
      {renderResource(state, "Comparison", ({ jobs }) => (
        <>
          <PageHeader
            title="Comparison group"
            subtitle={`${comparisonGroupId} · real persisted jobs only`}
            actions={
              <AppLink className="button secondary" href="/documents">
                Documents
              </AppLink>
            }
          />
          <Panel title="Jobs">
            {jobs.length === 0 ? (
              <div className="empty-state">
                This comparison group has no persisted jobs. Synthetic comparison rows are not shown.
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Workflow</th>
                      <th>Status</th>
                      <th>Full workflow cost</th>
                      <th>Unit margin</th>
                      <th>Basis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map(({ job, economics }) => (
                      <tr key={job.jobId}>
                        <td>
                          <WorkflowVariantBadge variant={job.workflowVariant} />
                        </td>
                        <td>
                          <StatusBadge status={job.status} />
                        </td>
                        <td>
                          <MoneyValue value={economics.fullWorkflowCostUsd} />
                        </td>
                        <td>
                          <MoneyValue value={economics.unitMarginUsd} />
                        </td>
                        <td>
                          <CostBasisBadge costBasis={economics.costBasis} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      ))}
    </div>
  );
}

function StatusMessages({ status, error }: { readonly status: string; readonly error: string }) {
  return (
    <>
      {status.length === 0 ? null : (
        <div className="notice success" role="status">
          {status}
        </div>
      )}
      {error.length === 0 ? null : (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
    </>
  );
}

function BuildPanel() {
  const buildFacts = useMemo(
    () => [
      { label: "Build", value: shortSha(buildInfo.sha) },
      { label: "Stage", value: buildInfo.stage },
      { label: "Region", value: buildInfo.region },
      { label: "API", value: "same-origin /api" }
    ],
    []
  );

  return (
    <Panel title="Deployed build identity">
      <div className="build-grid">
        {buildFacts.map((fact) => (
          <div key={fact.label}>
            <span>{fact.label}</span>
            <strong>{fact.value}</strong>
          </div>
        ))}
      </div>
      <p className="muted-text">
        Browser authentication and API origin proof are enforced at CloudFront. No API token or signed S3 URL is stored
        in page state.
      </p>
    </Panel>
  );
}
