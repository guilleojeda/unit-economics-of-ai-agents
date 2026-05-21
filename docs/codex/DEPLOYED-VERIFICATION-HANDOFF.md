# Deployed Verification Handoff

Use this after `PR-010A` is merged and the normal post-merge dev deployment succeeds. This file contains locators only; never copy secret values into repository files, PR comments, screenshots, logs, CI artifacts, or `PLAN.md`.

## Latest Deploy Artifact

The post-merge `deploy-dev` workflow writes a sanitized deploy artifact to the repository-configured deploy artifact bucket at:

```text
deploy-artifacts/dev/<mergedCommitSha>/<githubRunId>-<githubRunAttempt>/deploy-artifact-dev.json
```

The artifact schema is:

```text
pr-010a-dev-deploy-v1
```

Use the artifact to confirm:

- merged commit SHA
- GitHub deploy run ID
- AWS account ID
- stage and region
- `FrontendUrl`
- `ControlApiUrl`
- CloudFront distribution ID
- frontend access mode
- frontend build/static publication evidence
- Control API and frontend smoke evidence

## Credential Locators

Retrieve credentials only at verification time with authorized AWS credentials. Do not store the returned values.

- Browser gate credential locator: `FrontendStack.FrontendBrowserAccessSecretArn`
- Direct Control API token locator: `ControlApiStack.ControlApiDevAccessTokenSecretArn`
- CloudFront origin-proof locator: `ControlApiStack.ControlApiOriginProofSecretArn`

Codex normally needs the browser gate credential to use the deployed app directly. Direct API token retrieval is only for operator/API verification. Browser JavaScript must never receive the direct API token or origin proof.

## Verification Surface

Use `FrontendUrl` from the deploy artifact as the product surface. The deployed app must call the API through same-origin `/api/*`.

Do not accept localhost, fixture JSON, direct unprotected API Gateway routes, wrong-stage endpoints, wrong-account resources, or stale CloudFront assets as verification.

## Evidence Redaction

Record only sanitized evidence:

- status codes
- hostnames
- route paths without signed query strings
- deploy artifact object key
- build SHA
- CloudFront distribution ID
- document/job/run IDs created during validation
- API request IDs when available

Do not record:

- browser Basic Auth credentials
- `x-dev-access-token`
- CloudFront origin proof
- cookies
- authorization headers
- full presigned URLs
- signed query strings
- raw PDF bytes
- full document text

## Completion Rule

For slices after `PR-010A`, completion requires the relevant PR to be merged, the normal post-merge dev deployment to succeed, and Codex to directly use the deployed app for the changed behavior when a rendered path exists.
