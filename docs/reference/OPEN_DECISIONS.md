# Open Decisions

These are not blockers for the first implementation slice, but they must not remain ambiguous when their owning story is implemented.

```text
1. Exact Bedrock translation model ID.
   Owner: PR-013.
   Requirement: configure through deployment/runtime config; do not hard-code in source.

2. Exact Bedrock evaluator model ID.
   Owner: PR-013.
   Requirement: configure through deployment/runtime config; do not hard-code in source.

3. PDF library: PyMuPDF/reportlab/pypdfium2 versus TypeScript alternative.
   Owner: PR-013.
   Requirement: resolve before implementing real PDF inspection, extraction, and recomposition.

4. Whether PdfPipelineTools is Python container Lambda or TypeScript Lambda.
   Owner: PR-013.
   Requirement: resolve before implementing real PDF tools; PR-012 infrastructure must not make this impossible to change.

5. Whether frontend hosting is S3 + CloudFront or Amplify.
   Owner: PR-010A.
   Requirement: document the selected dev hosting approach and deploy it through CI/IaC.

6. Whether dev API protection is basic auth, private access, Cognito, or another documented guardrail.
   Owner: PR-010 for real API protection; PR-010A for rendered app/browser access.
   Requirement: real product API data must not be exposed anonymously.

7. Whether runtime cost is initially omitted, estimated, or reconciled.
   Owner: PR-013 for the initial V1 basis; PR-016 for final labeling and hardening.
   Requirement: label the basis honestly and do not claim AWS bill reconciliation unless implemented.

8. Exact dev placeholder PriceBook values.
   Owner: PR-010.
   Requirement: store as records/configuration, not hard-coded pricing logic.

9. Whether AgentCore Policy is implemented before or after first end-to-end V1.
   Owner: PR-012 if policy is required for Runtime/Gateway infrastructure; otherwise explicitly defer until after V1.
   Requirement: do not let Policy work block V1 unless it is required for a working AgentCore deployment.
```
