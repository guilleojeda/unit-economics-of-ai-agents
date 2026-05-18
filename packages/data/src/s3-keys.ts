import type { StageName } from "@agentcore-pdf-translator/schemas";

export type ArtifactBucketOptions = {
  readonly stage: string;
  readonly accountId: string;
  readonly region?: "us-east-1";
};

export type DocumentKeyOptions = {
  readonly workspaceId: string;
  readonly documentId: string;
};

export type DocumentInspectionKeyOptions = DocumentKeyOptions & {
  readonly artifactId: string;
};

export type RunStageKeyOptions = {
  readonly workspaceId: string;
  readonly jobId: string;
  readonly runId: string;
};

export type StageFileKeyOptions = RunStageKeyOptions & {
  readonly sequence: number;
  readonly stageName: StageName;
  readonly fileName: string;
};

export type ImageAssetKeyOptions = RunStageKeyOptions & {
  readonly pageNumber: number;
  readonly imageIndex: number;
  readonly extension: string;
};

export type PreviewKeyOptions = RunStageKeyOptions & {
  readonly pageNumber: number;
};

function padSequence(sequence: number): string {
  return sequence.toString().padStart(3, "0");
}

function stagePrefix(options: Omit<StageFileKeyOptions, "fileName">): string {
  return [
    "workspaces",
    options.workspaceId,
    "jobs",
    options.jobId,
    "runs",
    options.runId,
    "stages",
    `${padSequence(options.sequence)}-${options.stageName}`
  ].join("/");
}

export function buildArtifactBucketName(options: ArtifactBucketOptions): string {
  return `agentcore-pdf-translator-${options.stage}-${options.accountId}-${options.region ?? "us-east-1"}`;
}

export function sourcePdfKey(options: DocumentKeyOptions): string {
  return `workspaces/${options.workspaceId}/documents/${options.documentId}/source/source.pdf`;
}

export function documentInspectionKey(options: DocumentInspectionKeyOptions): string {
  return [
    "workspaces",
    options.workspaceId,
    "documents",
    options.documentId,
    "inspection",
    `inspection-${options.artifactId}.json`
  ].join("/");
}

export function stageFileKey(options: StageFileKeyOptions): string {
  return `${stagePrefix(options)}/${options.fileName}`;
}

export function inspectionStageKey(options: RunStageKeyOptions): string {
  return stageFileKey({
    ...options,
    sequence: 1,
    stageName: "inspect_pdf",
    fileName: "inspection.json"
  });
}

export function textLayoutKey(options: RunStageKeyOptions): string {
  return stageFileKey({
    ...options,
    sequence: 2,
    stageName: "extract_text_layout",
    fileName: "text-layout.json"
  });
}

export function imageManifestKey(options: RunStageKeyOptions): string {
  return stageFileKey({
    ...options,
    sequence: 3,
    stageName: "extract_images",
    fileName: "image-manifest.json"
  });
}

export function imageAssetKey(options: ImageAssetKeyOptions): string {
  return [
    stagePrefix({
      ...options,
      sequence: 3,
      stageName: "extract_images"
    }),
    "images",
    `page-${options.pageNumber}`,
    `image-${options.imageIndex}.${options.extension}`
  ].join("/");
}

export function sourceChunksKey(options: RunStageKeyOptions): string {
  return stageFileKey({
    ...options,
    sequence: 4,
    stageName: "chunk_and_align",
    fileName: "source-chunks.json"
  });
}

export function translatedChunksKey(options: RunStageKeyOptions): string {
  return stageFileKey({
    ...options,
    sequence: 5,
    stageName: "translate_text_chunks",
    fileName: "translated-chunks.json"
  });
}

export function imageTranslationsKey(options: RunStageKeyOptions): string {
  return stageFileKey({
    ...options,
    sequence: 6,
    stageName: "translate_image_text",
    fileName: "image-translations.json"
  });
}

export function translatedPdfKey(options: RunStageKeyOptions): string {
  return stageFileKey({
    ...options,
    sequence: 7,
    stageName: "recompose_pdf",
    fileName: "translated.pdf"
  });
}

export function pdfPreviewKey(options: PreviewKeyOptions): string {
  return [
    stagePrefix({
      ...options,
      sequence: 7,
      stageName: "recompose_pdf"
    }),
    "previews",
    `page-${options.pageNumber}.png`
  ].join("/");
}

export function evaluationKey(options: RunStageKeyOptions): string {
  return stageFileKey({
    ...options,
    sequence: 8,
    stageName: "evaluate_translation",
    fileName: "evaluation.json"
  });
}

export function ledgerExportKey(options: RunStageKeyOptions): string {
  return `workspaces/${options.workspaceId}/jobs/${options.jobId}/runs/${options.runId}/ledger/ledger-export.json`;
}
