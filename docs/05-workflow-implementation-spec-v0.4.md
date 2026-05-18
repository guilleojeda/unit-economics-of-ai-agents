# 05 — Workflow implementation spec v0.4

## Execution architecture

```text
Web UI
  → Control API
    → DynamoDB: create TranslationJob / Run
    → AgentCore Runtime: invoke Strands agent with runId/jobId/documentId
      → Strands stage coordinator
        → AgentCore Gateway tools
          → Lambda tools
            → S3 artifacts
            → Bedrock Converse for translation/evaluation where needed
        → repositories write StageEvents, Artifacts, LedgerItems
    → Control API returns run status / timeline / ledger / artifacts
```

Use TypeScript Strands for the AgentCore Runtime app. Use AgentCore Gateway for the tool plane. Use Bedrock Converse inside translation and evaluation tools.

## Monorepo implementation layout

```text
/apps/web
/apps/control-api
/apps/agent-runtime
/apps/tools/pdf-pipeline-lambda
/apps/tools/translation-lambda
/apps/tools/evaluation-lambda
/packages/schemas
/packages/data
/packages/costing
/packages/bedrock
/packages/gateway
/infra
```

PDF extraction/recomposition can be Python if TypeScript libraries are weaker.

## Control API run-start flow

`POST /api/jobs/{jobId}/runs` should create a technical attempt and invoke the agent.

```ts
async function startRun(jobId: string, reason: RunStartReason): Promise<Run> {
  const job = await jobRepo.get(jobId);
  assertJobCanStartRun(job);

  const document = await documentRepo.get(job.documentId);
  assertDocumentReady(document);

  const run = await runRepo.create({
    workspaceId: job.workspaceId,
    jobId: job.jobId,
    documentId: job.documentId,
    attemptNumber: job.totalAttemptCount + 1,
    workflowVariant: job.workflowVariant,
    status: "QUEUED",
    sourceLanguage: job.sourceLanguage,
    targetLanguage: job.targetLanguage,
    sourcePdfArtifactId: document.sourcePdfArtifactId,
    llmOnlyCostUsd: 0,
    fullWorkflowCostUsd: 0,
    humanReviewCostUsd: 0,
    retryCostUsd: 0,
    remediationCostUsd: 0,
    warnings: [],
  });

  await jobRepo.markRunning(job.jobId, run.runId);

  await agentRuntimeClient.invoke({
    runId: run.runId,
    jobId: job.jobId,
    documentId: document.documentId,
    workspaceId: job.workspaceId,
  });

  return run;
}
```

The agent should not create the `Run`; the Control API should.

## Agent Runtime invocation contract

```ts
export const RunExecutionRequestSchema = z.object({
  workspaceId: z.string(),
  documentId: z.string(),
  jobId: z.string(),
  runId: z.string(),
});

export type RunExecutionResult = {
  workspaceId: string;
  documentId: string;
  jobId: string;
  runId: string;
  status: "AWAITING_REVIEW" | "FAILED";
  translatedPdfArtifactId?: string;
  evaluationResultId?: string;
  llmOnlyCostUsd: number;
  fullWorkflowCostUsd: number;
  warnings: string[];
  failureReason?: string;
  traceId?: string;
};
```

Prefer container-based TypeScript deployment through the AgentCore CLI path.

## Agent runtime structure

```text
/apps/agent-runtime/src/index.ts
/apps/agent-runtime/src/execute-run.ts
/apps/agent-runtime/src/stage-plan.ts
/apps/agent-runtime/src/stage-runner.ts
/apps/agent-runtime/src/gateway-tools.ts
/apps/agent-runtime/src/context.ts
/apps/agent-runtime/src/retry-policy.ts
/apps/agent-runtime/src/errors.ts
```

The Strands agent should be constrained to workflow coordination. It should not accept arbitrary user instructions for a translation job.

## Stage plans

V1:

```text
001 inspect_pdf
002 extract_text_layout
003 chunk_and_align
004 translate_text_chunks
005 recompose_pdf
006 evaluate_translation
007 finalize_economics
```

V2:

```text
001 inspect_pdf
002 extract_text_layout
003 extract_images
004 chunk_and_align
005 translate_text_chunks
006 translate_image_text
007 recompose_pdf
008 evaluate_translation
009 finalize_economics
```

V3:

```text
001 inspect_pdf
002 route_document
003 extract_text_layout
004 selective_extract_images
005 chunk_and_align
006 batch_translate_text_chunks
007 selective_translate_image_text
008 recompose_pdf
009 evaluate_translation
010 finalize_economics
```

`route_document`, `selective_extract_images`, and `batch_translate_text_chunks` can initially be lightweight application logic around the same underlying tools.

## Stage runner requirements

The stage runner is the enforcement point for auditability. No tool should update the `Run` directly.

For each stage:

```text
1. Create StageEvent with RUNNING status.
2. Build tool request from context and prior artifacts.
3. Invoke Gateway tool or internal function.
4. Validate ToolResponseBase with Zod.
5. Persist artifact drafts.
6. Persist ledger item drafts.
7. Update execution context with output artifacts, metrics, warnings.
8. Mark StageEvent SUCCEEDED or FAILED.
9. Roll up run cost.
```

If a stage retry occurs, create retry ledger evidence and increment stage retry count.

## Repository interfaces

Create repository interfaces first, then implement DynamoDB behind them.

Required repositories:

```text
DocumentRepo
TranslationJobRepo
RunRepo
StageEventRepo
ArtifactRepo
LedgerRepo
EvaluationRepo
ReviewDecisionRepo
PriceBookRepo
```

Required behaviors:

```text
DocumentRepo.get / updateInspectionCache
TranslationJobRepo.get / markRunning / updateAwaitingReview / markAccepted / markRejected / markEscalated / markFailedIfNoOpenAttempts / updateEconomics
RunRepo.get / create / updateStatus / updateAfterExecution / markFailed / updateCostRollup
StageEventRepo.createRunning / createSkipped / markSucceeded / markFailed
ArtifactRepo.get / persistDrafts / createPresignedGetUrl
LedgerRepo.persistDrafts / createRetryLedgerItem / listByRun / listByJob
EvaluationRepo.create / getLatestForRun
ReviewDecisionRepo.create
```

## Gateway Lambda targets

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

Lambda dispatch must strip target prefix:

```ts
function stripGatewayTargetPrefix(toolName: string): string {
  const parts = toolName.split("___");
  return parts.length === 2 ? parts[1] : toolName;
}
```

## Tool responsibilities

```text
inspect_pdf:
  Read source PDF from S3. Calculate page count, text blocks, image count, scanned-page estimate, source language, layout complexity. Write INSPECTION_JSON.

extract_text_layout:
  Extract text blocks with page coordinates, stable block IDs, reading order, block types. Write TEXT_LAYOUT_JSON.

extract_images:
  Extract embedded images and bounding boxes. Write IMAGE_ASSET and IMAGE_MANIFEST_JSON. Assign materiality.

chunk_and_align:
  Group blocks into chunks, preserve source block IDs, detect glossary terms. Write SOURCE_CHUNKS_JSON.

translate_text_chunks:
  Call Bedrock Converse with structured translation prompt. Validate one output per input chunk. Write TRANSLATED_CHUNKS_JSON. Create model/tool ledger rows.

translate_image_text:
  Translate image text into annotations/callouts/captions. For V2 translate likely text-bearing images. For V3 translate only MEDIUM/HIGH materiality image text.

recompose_pdf:
  Create translated PDF with approximate layout preservation and preview PNGs. Write TRANSLATED_PDF and PDF_PREVIEW_PNG.

evaluate_translation:
  Verify artifacts, missing chunks, untranslated Spanish residue, glossary consistency, PDF validity, layout warnings, semantic coverage. Write EVALUATION_JSON.
```

## Bedrock Converse wrapper

All model calls must go through `/packages/bedrock/src/converse-json.ts`.

```ts
export type ConverseJsonArgs<TInput> = {
  modelId: string;
  system: string;
  user: TInput;
  temperature: number;
  maxTokens: number;
  requestMetadata: Record<string, string>;
};

export type ConverseJsonResult<TOutput> = {
  parsed: TOutput;
  rawText: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cacheReadInputTokens?: number;
    cacheWriteInputTokens?: number;
  };
  latencyMs?: number;
  modelId: string;
};
```

## Translation prompt

```text
You are a professional Spanish-to-English document translator.

Translate the provided Spanish document chunks into clear, accurate English.

Rules:
1. Preserve the meaning of every source chunk.
2. Do not summarize.
3. Do not omit content.
4. Preserve numbers, dates, currency, IDs, and proper nouns.
5. Use the required glossary exactly where applicable.
6. Keep each output chunk aligned to the same chunkId as the input.
7. Return only valid JSON matching the requested schema.
8. Do not include markdown, commentary, explanations, or extra keys.
```

Validation:

```text
Every input chunkId must appear exactly once.
No extra chunkId may appear.
translatedText must be non-empty.
sourceBlockIds must match the source chunk.
Glossary terms must be checked deterministically after translation.
```

If validation fails, retry once with a repair prompt. If repair fails, mark the stage failed.

## Translation repair prompt

```text
You are repairing a JSON translation response.

Return only valid JSON matching the requested schema.
Do not retranslate chunks that are already valid unless needed.
Fix only these issues:
- missing chunk IDs
- extra chunk IDs
- invalid JSON
- empty translatedText
- schema mismatch
```

## Image translation prompt

```text
You translate short Spanish text found inside document images.

Rules:
1. Translate only the text supplied in the input.
2. Do not infer text that is not present.
3. Keep translations concise enough for diagram labels.
4. Preserve process-step meaning.
5. Return only valid JSON matching the schema.
```

## Evaluation prompt

```text
You are evaluating a Spanish-to-English document translation.

Assess whether the English translation preserves the meaning of the Spanish source text.

Rules:
1. Do not reward fluent English if source content is missing.
2. Penalize missing chunks.
3. Penalize mistranslated required glossary terms.
4. Penalize untranslated Spanish text in the final output.
5. Treat untranslated image text as a warning for V1_TEXT_ONLY unless the image is material.
6. Return only valid JSON matching the requested schema.
```

Deterministic overrides:

```text
Fail if missingChunkCount > 0.
Fail if semanticCoverageScore < 0.85.
Fail if terminologyScore < 0.80.
Fail if translated PDF is missing or invalid.
Warn but do not auto-fail V1 for non-material untranslated image text.
```

## Review decision flow

Reviewer decisions are outside the agent.

```text
1. Assert run status is AWAITING_REVIEW.
2. Calculate human review cost from reviewerSeconds and hourly rate.
3. Create ReviewDecision.
4. Persist HUMAN_REVIEW LedgerItem.
5. Update Run status to ACCEPTED, REJECTED, or ESCALATED.
6. Update TranslationJob status.
7. Recalculate run and job economics.
```

## Retry policy

Retryable:

```text
Bedrock throttling
Bedrock transient service unavailable
Gateway transient timeout
Lambda transient error
S3 transient read/write error
DynamoDB conditional failure only when safe to retry
```

Not retryable:

```text
Unsupported PDF
Invalid source artifact
Schema mismatch after repair retry
Missing required artifact
Evaluation deterministic failure
Reviewer rejection
```

Suggested limits:

```text
inspect_pdf: 1 retry
extract_text_layout: 1 retry
extract_images: 1 retry
chunk_and_align: 0 retries unless pure code exception is transient
translate_text_chunks: 2 transient retries + 1 repair retry
translate_image_text: 2 transient retries + 1 repair retry
recompose_pdf: 1 retry
evaluate_translation: 1 retry + 1 repair retry
```

## Instrumentation and idempotency

Ledger rows:

```text
MODEL_INFERENCE from Bedrock Converse response usage
AGENTCORE_GATEWAY from counted Gateway tool invocation × price book
HUMAN_REVIEW from reviewerSeconds × hourly rate
EXTERNAL_SERVICE from deterministic units such as page/image/document if Textract/BDA is later added
RETRY from retry attempts and additional model/tool usage
REMEDIATION from follow-up attempts or escalated human work
```

Trace linkage:

```text
Run.traceId
StageEvent.traceId
StageEvent.spanId
LedgerItem.traceId
LedgerItem.spanId
```

Idempotency:

```text
idempotencyKey = runId#stageSequence#stageName
Never overwrite source artifacts.
Never mutate Document source PDF.
Avoid duplicate ledger rows unless they represent a retry attempt.
```

## Acceptance criteria for this layer

```text
POST /api/documents/presign returns an upload URL.
POST /api/documents creates a Document.
POST /api/documents/{documentId}/inspect creates inspection artifact and updates Document cache.
POST /api/documents/{documentId}/jobs creates a TranslationJob.
POST /api/jobs/{jobId}/runs creates a Run and invokes AgentCore Runtime.
AgentCore Runtime loads the Run, Job, Document, and active PriceBook.
The agent executes the correct stage plan for V1, V2, or V3.
Each stage creates a StageEvent.
Each durable output creates an Artifact.
Each model/tool/review/retry cost creates a LedgerItem.
translate_text_chunks records Bedrock input and output token usage.
evaluate_translation records deterministic checks and model-based scores.
recompose_pdf creates a translated PDF artifact.
The run ends in AWAITING_REVIEW unless a technical failure occurs.
POST /api/runs/{runId}/review updates Run and TranslationJob outcome.
Job economics are recalculated after run completion and after review.
The ledger view can show LLM-only cost versus full workflow cost.
The comparison view can compare V1, V2, and V3 jobs for the same document.
```
