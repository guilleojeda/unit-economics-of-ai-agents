# Tool Contracts Reference

## Gateway targets

```text
PdfPipelineTools
  inspect_pdf
  extract_text_layout
  extract_images
  recompose_pdf

TranslationTools
  chunk_and_align
  translate_text_chunks
  translate_image_text

EvaluationTools
  evaluate_translation
```

## Common request

```ts
type ArtifactRef = {
  artifactId: string;
  artifactType: string;
  s3Bucket: string;
  s3Key: string;
  contentType?: string;
  sizeBytes?: number;
  sha256?: string;
};

type ToolRequestBase = {
  workspaceId: string;
  documentId: string;
  jobId: string;
  runId: string;
  workflowVariant: "V1_TEXT_ONLY" | "V2_TEXT_AND_IMAGE_ANNOTATION" | "V3_OPTIMIZED";
  sourceLanguage: "es";
  targetLanguage: "en";
  priceBookVersion: string;
  inputArtifacts: ArtifactRef[];
  executionContext?: {
    stage?: "dev";
    awsRegion?: "us-east-1";
    awsAccountId?: string;
    deployArtifactId?: string;
    deployedCommitSha?: string;
    buildId?: string;
    runtimeImageTagOrDigest?: string;
    toolVersion?: string;
    validationRunId?: string;
  };
  traceContext?: { traceId?: string; parentSpanId?: string };
  options: {
    enableImageTranslation: boolean;
    enablePolicyChecks: boolean;
    enableMemory: boolean;
    preserveLayout: "APPROXIMATE";
  };
};
```

Tool requests that operate on source PDFs, intermediate JSON, image assets, previews, or translated PDFs must include the relevant artifact IDs and S3 keys in `inputArtifacts` or a stage-specific equivalent. Gateway tools must not receive raw PDF bytes and must not infer file inputs only from a mutable document title, display name, local path, or bare `documentId`.

File-bearing and cost-bearing tool requests should also carry execution context when it is available from the deployed environment. Persisted StageEvents, Artifacts, LedgerItems, and EvaluationResults should retain enough provenance to identify which deployed environment, commit/build, runtime image, tool version, and validation run produced the result. Validation selectors are for correlation only and must not create replay, synthetic, live-capture, recording, or presentation behavior.

Tool logs, telemetry, validation records, and `PLAN.md` evidence must not store raw PDF/image bytes, full extracted or translated document text, full Bedrock prompts, raw model responses, auth material, or full presigned URLs. Persist durable content as private artifacts and record artifact IDs, S3 keys, checksums, request IDs, model IDs, token usage, latency, and validation summaries instead.

Tool and runtime persistence must preserve economic evidence. Duplicate delivery for the same invocation identity must be idempotent, while deliberate retry or remediation work must use a distinct attempt or invocation identity with its own StageEvent, Artifact, EvaluationResult, and LedgerItem evidence. Tools and runtime code must not delete or overwrite prior StageEvents, Artifacts, LedgerItems, EvaluationResults, ReviewDecisions, or S3 artifact objects to make a later attempt look cheaper or cleaner.

Tool result persistence must commit each invocation result as an atomic or recoverably staged group. A stage cannot be marked terminal success unless required artifact metadata, S3 object metadata, evaluation output where applicable, and LedgerItems for the invocation are committed consistently. If persistence fails after any subset is written, the run must remain retryable or explicitly failed/incomplete, and product reads must not present partial artifacts, partial cost, or partial evaluation as a successful stage outcome.

## Common response

```ts
type ToolResponseBase = {
  status: "SUCCEEDED" | "FAILED";
  stageName: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  artifacts: ArtifactDraft[];
  metrics: Record<string, number | string | boolean>;
  ledgerItems: LedgerItemDraft[];
  warnings: string[];
  error?: { code: string; message: string };
  traceContext?: { traceId?: string; spanId?: string; parentSpanId?: string };
};
```

## Tool names

```text
PdfPipelineTools___inspect_pdf
PdfPipelineTools___extract_text_layout
PdfPipelineTools___extract_images
PdfPipelineTools___recompose_pdf
TranslationTools___chunk_and_align
TranslationTools___translate_text_chunks
TranslationTools___translate_image_text
EvaluationTools___evaluate_translation
```

Lambda dispatch must strip the `TargetName___tool_name` prefix before routing.
