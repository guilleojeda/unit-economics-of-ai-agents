import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { webcrypto } from "node:crypto";
import type {
  Artifact,
  Document,
  Run
} from "@agentcore-pdf-translator/schemas";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { AppShell } from "./app-shell";

const now = "2026-01-15T12:00:00.000Z";

const readyDocument: Document = {
  workspaceId: "dev",
  documentId: "doc_1",
  title: "Procedimiento de Reembolsos y Elegibilidad",
  sourceLanguage: "es",
  targetLanguage: "en",
  status: "READY",
  sourcePdfArtifactId: "art_source_1",
  sourcePdfS3Bucket: "artifact-bucket",
  sourcePdfS3Key: "workspaces/dev/documents/doc_1/source.pdf",
  fileName: "procedimiento-reembolsos-elegibilidad.pdf",
  fileSizeBytes: 1024,
  sha256: "0".repeat(64),
  pageCount: 4,
  textBlockCount: 16,
  imageCount: 1,
  inspectionWarnings: [],
  createdAt: now,
  updatedAt: now
};

const sourceArtifact: Artifact = {
  workspaceId: "dev",
  artifactId: "art_source_1",
  documentId: "doc_1",
  artifactType: "SOURCE_PDF",
  s3Bucket: "artifact-bucket",
  s3Key: "workspaces/dev/documents/doc_1/source.pdf",
  contentType: "application/pdf",
  sizeBytes: 1024,
  sha256: "0".repeat(64),
  language: "es",
  createdAt: now
};

const run: Run = {
  workspaceId: "dev",
  runId: "run_1",
  jobId: "job_1",
  documentId: "doc_1",
  attemptNumber: 1,
  workflowVariant: "V1_TEXT_ONLY",
  status: "CREATED",
  sourceLanguage: "es",
  targetLanguage: "en",
  sourcePdfArtifactId: "art_source_1",
  llmOnlyCostUsd: 0,
  fullWorkflowCostUsd: 0,
  humanReviewCostUsd: 0,
  retryCostUsd: 0,
  remediationCostUsd: 0,
  warnings: [],
  createdAt: now,
  updatedAt: now
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });
}

type MockHandler = (init: RequestInit | undefined) => Response | Promise<Response>;

function installFetchMock(routes: Readonly<Record<string, MockHandler>>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === "string" || input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl, window.location.origin);
    const key = `${init?.method ?? "GET"} ${url.pathname}${url.search}`;
    const handler = routes[key] ?? routes[`GET ${url.pathname}${url.search}`];
    if (handler === undefined) {
      return jsonResponse(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: `Unhandled test route ${key}`
          }
        },
        404
      );
    }

    return handler(init);
  });
}

function renderAt(path: string) {
  window.history.pushState(null, "", path);
  return render(<AppShell />);
}

beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal("open", vi.fn());
  vi.stubGlobal("scrollTo", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("deployed app shell", () => {
  test("loads the document library from the persistent Control API", async () => {
    vi.stubGlobal(
      "fetch",
      installFetchMock({
        "GET /api/documents": () => jsonResponse({ documents: [readyDocument] })
      })
    );

    renderAt("/documents");

    expect(await screen.findByRole("heading", { name: "Documents" })).toBeDefined();
    expect(await screen.findByText("Procedimiento de Reembolsos y Elegibilidad")).toBeDefined();
    expect(screen.getByText("procedimiento-reembolsos-elegibilidad.pdf")).toBeDefined();
    expect(screen.getByText("same-origin /api")).toBeDefined();
  });

  test("does not show synthetic comparison rows when a comparison group has no persisted jobs", async () => {
    vi.stubGlobal(
      "fetch",
      installFetchMock({
        "GET /api/compare?comparisonGroupId=cmp_empty": () =>
          jsonResponse({ comparisonGroupId: "cmp_empty", jobs: [] })
      })
    );

    renderAt("/compare/cmp_empty");

    expect(await screen.findByText(/Synthetic comparison rows are not shown/u)).toBeDefined();
    expect(screen.queryByText("V2 Text + image annotation")).toBeNull();
    expect(screen.queryByText("V3 Optimized")).toBeNull();
  });

  test("uploads a source PDF through presign without displaying the signed URL", async () => {
    const user = userEvent.setup();
    const createdDocument = {
      ...readyDocument,
      documentId: "doc_upload",
      fileName: "controlled.pdf",
      sourcePdfS3Key: "workspaces/dev/documents/doc_upload/source.pdf"
    };
    const uploadUrl = "https://uploads.example.test/signed?X-Amz-Signature=secret";
    const fetchMock = installFetchMock({
      "POST /api/documents/presign": () =>
        jsonResponse({
          documentId: "doc_upload",
          s3Key: "workspaces/dev/documents/doc_upload/source.pdf",
          uploadUrl,
          expiresInSeconds: 300,
          requiredHeaders: {
            "content-type": "application/pdf"
          },
          maxSizeBytes: 10_485_760
        }),
      "PUT /signed?X-Amz-Signature=secret": () => new Response(null, { status: 200 }),
      "POST /api/documents": () =>
        jsonResponse(
          {
            document: createdDocument,
            sourceArtifact: { ...sourceArtifact, documentId: "doc_upload" }
          },
          201
        ),
      "GET /api/documents/doc_upload/jobs": () => jsonResponse({ document: createdDocument, jobs: [] })
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = renderAt("/documents/new");

    const file = new File(["%PDF-1.7\ncontrolled"], "controlled.pdf", { type: "application/pdf" });
    const input = await screen.findByLabelText("Source PDF");
    await user.upload(input, file);
    expect((input as HTMLInputElement).files?.item(0)?.name).toBe("controlled.pdf");
    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);

    expect(await screen.findByText("controlled.pdf · doc_upload")).toBeDefined();
    expect(screen.queryByText(/X-Amz-Signature/u)).toBeNull();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(uploadUrl, expect.objectContaining({ method: "PUT" })));
  });

  test("surfaces the reviewability guard instead of accepting a non-reviewable run", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      installFetchMock({
        "GET /api/runs/run_1/evaluation": () => jsonResponse({ run, evaluation: null }),
        "POST /api/runs/run_1/review": () =>
          jsonResponse(
            {
              error: {
                code: "RUN_NOT_REVIEWABLE",
                message: "Run is not reviewable"
              }
            },
            409
          )
      })
    );

    renderAt("/jobs/job_1/runs/run_1/evaluation");

    await user.click(await screen.findByRole("button", { name: "Probe review guard" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("RUN_NOT_REVIEWABLE");
  });
});
