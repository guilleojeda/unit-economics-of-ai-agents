import { describe, expect, it } from "vitest";
import {
  assertDocumentTransition,
  assertJobTransition,
  assertRunTransition,
  buildArtifactBucketName,
  canCreateJobForDocumentStatus,
  createEntityId,
  documentInspectionKey,
  evaluationKey,
  imageAssetKey,
  InvalidStateTransitionError,
  ledgerExportKey,
  pdfPreviewKey,
  sourcePdfKey,
  translatedPdfKey
} from "../src/index.js";

describe("state transition guards", () => {
  it("allows documented document, job, and run transitions", () => {
    expect(() => assertDocumentTransition("UPLOADED", "INSPECTING")).not.toThrow();
    expect(() => assertDocumentTransition("INSPECTING", "READY")).not.toThrow();
    expect(() => assertJobTransition("CREATED", "RUNNING")).not.toThrow();
    expect(() => assertJobTransition("AWAITING_REVIEW", "ACCEPTED")).not.toThrow();
    expect(() => assertRunTransition("CREATED", "QUEUED")).not.toThrow();
    expect(() => assertRunTransition("EVALUATING", "AWAITING_REVIEW")).not.toThrow();
    expect(() => assertRunTransition("AWAITING_REVIEW", "REJECTED")).not.toThrow();
  });

  it("rejects invalid and terminal transitions", () => {
    expect(() => assertDocumentTransition("UNSUPPORTED", "READY")).toThrow(
      InvalidStateTransitionError
    );
    expect(() => assertJobTransition("ACCEPTED", "RUNNING")).toThrow(
      InvalidStateTransitionError
    );
    expect(() => assertJobTransition("REJECTED", "RUNNING")).toThrow(
      InvalidStateTransitionError
    );
    expect(() => assertRunTransition("FAILED", "RUNNING")).toThrow(InvalidStateTransitionError);
    expect(() => assertRunTransition("ACCEPTED", "REJECTED")).toThrow(
      InvalidStateTransitionError
    );
  });

  it("allows job creation only for ready documents", () => {
    expect(canCreateJobForDocumentStatus("READY")).toBe(true);
    expect(canCreateJobForDocumentStatus("UNSUPPORTED")).toBe(false);
    expect(canCreateJobForDocumentStatus("FAILED_INSPECTION")).toBe(false);
  });
});

describe("S3 key builders", () => {
  const runOptions = {
    workspaceId: "ws_default",
    jobId: "job_01",
    runId: "run_01"
  } as const;

  it("builds the documented artifact bucket name", () => {
    expect(
      buildArtifactBucketName({
        stage: "dev",
        accountId: "123456789012"
      })
    ).toBe("agentcore-pdf-translator-dev-123456789012-us-east-1");
  });

  it("builds source and document inspection keys", () => {
    expect(sourcePdfKey({ workspaceId: "ws_default", documentId: "doc_01" })).toBe(
      "workspaces/ws_default/documents/doc_01/source/source.pdf"
    );
    expect(
      documentInspectionKey({
        workspaceId: "ws_default",
        documentId: "doc_01",
        artifactId: "art_01"
      })
    ).toBe("workspaces/ws_default/documents/doc_01/inspection/inspection-art_01.json");
  });

  it("builds run artifact keys without raw PDF bytes", () => {
    expect(translatedPdfKey(runOptions)).toBe(
      "workspaces/ws_default/jobs/job_01/runs/run_01/stages/007-recompose_pdf/translated.pdf"
    );
    expect(
      imageAssetKey({
        ...runOptions,
        pageNumber: 4,
        imageIndex: 2,
        extension: "png"
      })
    ).toBe(
      "workspaces/ws_default/jobs/job_01/runs/run_01/stages/003-extract_images/images/page-4/image-2.png"
    );
    expect(pdfPreviewKey({ ...runOptions, pageNumber: 1 })).toBe(
      "workspaces/ws_default/jobs/job_01/runs/run_01/stages/007-recompose_pdf/previews/page-1.png"
    );
    expect(evaluationKey(runOptions)).toBe(
      "workspaces/ws_default/jobs/job_01/runs/run_01/stages/008-evaluate_translation/evaluation.json"
    );
    expect(ledgerExportKey(runOptions)).toBe(
      "workspaces/ws_default/jobs/job_01/runs/run_01/ledger/ledger-export.json"
    );
  });
});

describe("ID generation", () => {
  it("adds the requested entity prefix", () => {
    expect(createEntityId("job", new Date("2026-05-18T12:00:00.000Z"))).toMatch(/^job_/u);
  });
});
