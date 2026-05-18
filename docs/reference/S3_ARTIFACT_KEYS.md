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
