# Open Decisions

These are not blockers for the first implementation slice:

```text
1. Exact Bedrock translation model ID.
2. Exact Bedrock evaluator model ID.
3. PDF library: PyMuPDF/reportlab/pypdfium2 versus TypeScript alternative.
4. Whether PdfPipelineTools is Python container Lambda or TypeScript Lambda.
5. Whether frontend hosting is S3 + CloudFront or Amplify.
6. Whether dev API protection is basic auth, private access, or Cognito.
7. Whether runtime cost is initially omitted, estimated, or reconciled.
8. Whether AgentCore Policy is implemented before or after first end-to-end V1.
```

For the first slice, use configuration placeholders and tests. Do not block on these decisions.
