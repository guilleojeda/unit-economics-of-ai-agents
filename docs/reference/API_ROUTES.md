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

## Comparison and settings

```text
GET /api/compare
GET /api/price-books/current
PUT /api/price-books/current
```

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

## Mutating route retry contract

Mutating routes must define an idempotency key, client request ID, conditional write, or equivalent stable request identity before they are accepted as product behavior.

Repeated identical submissions must return the existing resource or an equivalent stable response. Conflicting repeated submissions must fail without creating duplicate `Document`, `Artifact`, `TranslationJob`, `Run`, `StageEvent`, `EvaluationResult`, `ReviewDecision`, or `LedgerItem` records.

This contract applies at minimum to document creation, inspection, job creation, run start, stage/tool result persistence, and review decisions.
