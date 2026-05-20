# S3 Artifact Keys Reference

Bucket:

```text
agentcore-pdf-translator-{stage}-{accountId}-us-east-1
```

Keys:

```text
workspaces/{workspaceId}/documents/{documentId}/source/source.pdf
workspaces/{workspaceId}/documents/{documentId}/inspection/inspection-{artifactId}.json
workspaces/{workspaceId}/jobs/{jobId}/runs/{runId}/stages/001-inspect_pdf/inspection.json
workspaces/{workspaceId}/jobs/{jobId}/runs/{runId}/stages/002-extract_text_layout/text-layout.json
workspaces/{workspaceId}/jobs/{jobId}/runs/{runId}/stages/003-extract_images/image-manifest.json
workspaces/{workspaceId}/jobs/{jobId}/runs/{runId}/stages/003-extract_images/images/page-{pageNumber}/image-{imageIndex}.{ext}
workspaces/{workspaceId}/jobs/{jobId}/runs/{runId}/stages/004-chunk_and_align/source-chunks.json
workspaces/{workspaceId}/jobs/{jobId}/runs/{runId}/stages/005-translate_text_chunks/translated-chunks.json
workspaces/{workspaceId}/jobs/{jobId}/runs/{runId}/stages/006-translate_image_text/image-translations.json
workspaces/{workspaceId}/jobs/{jobId}/runs/{runId}/stages/007-recompose_pdf/translated.pdf
workspaces/{workspaceId}/jobs/{jobId}/runs/{runId}/stages/007-recompose_pdf/previews/page-{pageNumber}.png
workspaces/{workspaceId}/jobs/{jobId}/runs/{runId}/stages/008-evaluate_translation/evaluation.json
workspaces/{workspaceId}/jobs/{jobId}/runs/{runId}/ledger/ledger-export.json
```

Store `s3Bucket` and `s3Key`, not raw `s3://...` strings.

Artifact records should also store integrity metadata when available, including content type, size, and checksum/hash. Product APIs, AgentCore requests, and Gateway tool requests should pass artifact IDs and S3 keys, not raw PDF bytes.

Document creation must only register source PDFs at repository-generated keys under the expected workspace/document prefix. Clients must not be allowed to register arbitrary S3 keys as source artifacts.

Artifact buckets and objects remain private. Reviewer-visible source PDFs, translated PDFs, previews, evaluation files, image assets, and route/skipped-stage evidence should be opened through Control API-generated short-lived access for authorized `Artifact` records. Do not use public S3 objects, arbitrary client-supplied S3 keys, or raw PDF bytes in JSON API responses as an artifact-viewing shortcut.
