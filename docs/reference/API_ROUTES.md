# API Routes Reference

## Documents

```text
POST /api/documents/presign
POST /api/documents
GET  /api/documents
GET  /api/documents/{documentId}
POST /api/documents/{documentId}/inspect
GET  /api/documents/{documentId}/jobs
```

`POST /api/documents` registers the canonical `SOURCE_PDF` artifact for a `Document`. After registration, that source artifact and its object identity, S3 key, size, checksum/hash, and source metadata are immutable for the document. Repeated identical creation requests may return the existing resource, but conflicting requests must fail. A different source PDF requires a different `Document`.

## Jobs

```text
POST /api/documents/{documentId}/jobs
GET  /api/jobs
GET  /api/jobs/{jobId}
GET  /api/jobs/{jobId}/runs
GET  /api/jobs/{jobId}/ledger
GET  /api/jobs/{jobId}/economics
POST /api/jobs/{jobId}/runs
```

## Runs

```text
GET /api/runs/{runId}
GET /api/runs/{runId}/timeline
GET /api/runs/{runId}/artifacts
GET /api/runs/{runId}/evaluation
GET /api/runs/{runId}/ledger
POST /api/runs/{runId}/review
```

## Artifacts

```text
GET /api/artifacts/{artifactId}/download-url
```

The artifact download/access route returns short-lived private access for an authorized `Artifact` record. It must resolve by `artifactId`, enforce workspace and resource ownership, and reject cross-workspace, missing, or arbitrary-key requests. It must not make S3 objects public and must not return raw PDF bytes in normal JSON API responses.

## Comparison and settings

```text
GET /api/compare
GET /api/price-books/current
PUT /api/price-books/current
```

`PUT /api/price-books/current` activates an append-only price-book version or creates a new version and activates it. It must not mutate a price-book version already referenced by jobs, review decisions, or ledger rows.

## Error shape

```json
{
  "error": {
    "code": "DOCUMENT_UNSUPPORTED",
    "message": "This PDF appears to contain scanned pages. OCR workflow is not enabled for the MVP.",
    "details": {
      "estimatedScannedPageCount": 4
    }
  }
}
```

## Environment, workspace, and validation scoping

All product API routes must resolve the effective workspace from the authenticated dev access context, deployment configuration, or another documented server-side mechanism. API handlers must not trust a client-supplied `workspaceId` as the authorization boundary.

Reads, writes, comparisons, artifact access, and validation evidence must be scoped to the resolved workspace and the deployed environment that produced the request. Cross-workspace resources, wrong-environment resources, and resources from a different AWS account/stage must be rejected or clearly excluded from product and validation responses.

When deployed verification sends a `validationRunId` header or equivalent stable selector, the API should propagate it into logs, telemetry, and persisted validation-related workflow records where practical. This selector is correlation evidence only; it must not become a product mode and must not change workflow behavior.

## Evidence hygiene and secret redaction

Deployed verification evidence, CI artifacts, job summaries, logs, telemetry, and `PLAN.md` must record stable identifiers and outcomes without leaking secrets or private artifact access. Safe evidence includes resource IDs, artifact IDs, S3 bucket/key pairs, checksums/hashes, trace IDs, request IDs, status codes, route names, timestamps, cost totals, and redacted snippets where explicitly needed.

Do not record AWS credentials, OIDC tokens, auth headers, cookies, API keys, full presigned upload/download URLs, signed query strings, raw PDF/image bytes, full extracted document text, full translated document text, Bedrock prompts, or raw model responses in durable evidence stores. If direct verification needs a presigned URL or signed request, record that it was issued and used, plus the artifact ID, expiry window, status code, and relevant request ID; redact the signature, token, and query string.

## Mutating route retry contract

Mutating routes must define an idempotency key, client request ID, conditional write, or equivalent stable request identity before they are accepted as product behavior.

Repeated identical submissions must return the existing resource or an equivalent stable response. Conflicting repeated submissions must fail without creating duplicate `Document`, `Artifact`, `TranslationJob`, `Run`, `StageEvent`, `EvaluationResult`, `ReviewDecision`, or `LedgerItem` records.

This contract applies at minimum to document creation, inspection, job creation, run start, stage/tool result persistence, and review decisions.

## Multi-record consistency

Any route that persists more than one product record or artifact object must define a transactional, conditional, or recoverably staged commit boundary before it is accepted as product behavior. A success response must not be returned until all records required for the visible outcome are committed and can be read back consistently.

Document creation must not leave a `Document` without its canonical `SOURCE_PDF` `Artifact` metadata. Job and run creation must not leave job, run, price-book, value-model, or latest-run state contradictory. Stage/tool result persistence must not leave a terminal `StageEvent` without its required Artifacts, EvaluationResult, and LedgerItems. Review submission must not leave a terminal run/job state without exactly one matching `ReviewDecision` and `HUMAN_REVIEW` `LedgerItem`.

If a partial write or downstream persistence failure occurs, the API must either roll back the visible outcome or persist an explicit failed/incomplete state that blocks misleading economics, review, or comparison claims until recovery completes. Read endpoints must not silently compute accepted economics, verified outcomes, or apples-to-apples comparisons from incomplete record groups.

## Destructive operations and retention

The MVP API surface has no `DELETE`, purge, hard-reset, or cleanup routes for `Document`, `TranslationJob`, `Run`, `StageEvent`, `Artifact`, `LedgerItem`, `EvaluationResult`, `ReviewDecision`, `PriceBook`, or artifact object evidence.

Future archive, retention, cleanup, or deletion behavior requires an explicit story and must be additive or migration-backed. It must preserve the records needed to prove job economics, failed/rejected work cost, review decisions, artifact lineage, comparison claims, and deployed validation evidence. It must not delete S3 objects that are still referenced by retained `Artifact` records, and it must not make ledger-derived costs disappear from historical jobs.

## Comparison prerequisites

Comparison responses that present V1/V2/V3 economics, quality, or optimization claims must either prove matching comparison prerequisites or explicitly block/label mismatches. The minimum prerequisites are the same source document, same canonical source artifact identity/checksum, compatible comparison group lineage, matching workspace/environment identity, matching `PriceBook` version, matching business value assumptions, matching translation/evaluator model plus prompt/configuration versions or labels where those settings affect the claim, and compatible workflow implementation provenance. Implementation provenance includes the deployed commit SHA/build ID and, when applicable, runtime image tag/digest and tool Lambda version/alias that produced each compared run. Historical jobs may still be compared, but stale, wrong-environment, wrong-workspace, or build-mismatched evidence must be labeled or blocked for direct apples-to-apples claims.
