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
type ToolRequestBase = {
  workspaceId: string;
  documentId: string;
  jobId: string;
  runId: string;
  workflowVariant: "V1_TEXT_ONLY" | "V2_TEXT_AND_IMAGE_ANNOTATION" | "V3_OPTIMIZED";
  sourceLanguage: "es";
  targetLanguage: "en";
  priceBookVersion: string;
  traceContext?: { traceId?: string; parentSpanId?: string };
  options: {
    enableImageTranslation: boolean;
    enablePolicyChecks: boolean;
    enableMemory: boolean;
    preserveLayout: "APPROXIMATE";
  };
};
```

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
