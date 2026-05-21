# PR-010A - Deployed Frontend And Dev Access

PR-010A starts only after PR-010 is deployed and directly verified. It makes the rendered web app a deployed product surface before later workflow-execution stories depend on app-level verification.

## Objective

Deploy the static web app to the dev environment through CI using S3 + CloudFront, wire it to the deployed Persistent Control API, and protect dev browser/API access so future slices can be verified through normal product navigation instead of API-only calls.

## Scope

In scope:

- Use S3 + CloudFront for dev frontend hosting. Do not use Amplify for this MVP dev deployment path.
- Document why S3 + CloudFront fits the current app shape: a static/client-rendered Next.js app deployed as immutable assets behind CloudFront. If a later story requires SSR, server actions, image optimization that cannot be statically exported, or framework-managed hosting, that story must explicitly revisit hosting.
- Add the frontend deployment to the normal post-merge CI/CD path using infrastructure as code.
- Include frontend outputs in the deploy artifact, including app URL, hosting stack/resource identifiers, configured API base URL, and access-protection mode.
- Configure the deployed app to call the deployed Control API, not local fixtures or localhost endpoints.
- Bind the deployed app/API configuration to the current deploy artifact's stage, region, AWS account, `FrontendUrl`, and `ControlApiUrl`; wrong-environment endpoints must not satisfy deployed verification.
- Keep deployed browser verification evidence sanitized: do not commit or persist session cookies, auth headers, full artifact-access URLs, signed query strings, raw PDF bytes, or full document text in screenshots, browser logs, CI artifacts, or `PLAN.md`.
- Extend the PR-010 dev API protection model to browser users and the deployed app surface:
  - CloudFront is the normal browser entrypoint for the dev app.
  - CloudFront serves static app assets from private S3.
  - CloudFront routes `/api/*` to the deployed Control API origin so browser traffic uses the deployed API through the same dev app surface.
  - CloudFront enforces dev browser access, for example with CloudFront Function or Lambda@Edge Basic Auth, signed cookies, or an equivalent edge-enforced dev access gate.
  - CloudFront injects a private origin verification header, or an equivalent origin proof, when forwarding `/api/*` to Control API.
  - Control API rejects direct API Gateway requests that lack either the PR-010 dev API token for direct API verification or the CloudFront origin proof for browser app traffic.
  - Browser JavaScript must not contain the PR-010 dev API token or any other reusable API secret.
- Wire existing product screens to PR-010 persisted API behavior:
  - document library
  - document detail
  - document upload/create flow
  - document inspection placeholder flow
  - source artifact viewing through PR-010 private artifact access
  - price book read
  - job creation
  - run placeholder creation
  - run timeline/ledger/economics reads
  - invalid review decision handling for non-`AWAITING_REVIEW` runs
- Replace product-facing fixture histories in the deployed app with persisted API reads.
- Render incomplete or failed multi-record API states honestly. The app must not show normal completed timelines, accepted economics, artifact links, or comparison rows when the API indicates an incomplete document/job/run/stage/review/economics record group.
- Use the same repository-controlled MVP PDF fixture established for PR-010 deployed verification; do not rely on an ad hoc browser-local test file.
- Provide honest empty, loading, and not-yet-implemented states for workflow behavior deferred to later stories.

## Non-Goals

- No AgentCore Runtime invocation.
- No AgentCore Gateway integration.
- No stage runner execution.
- No Bedrock calls.
- No PDF extraction, translation, evaluation, or recomposition.
- No V2 or V3 behavior.
- No Amplify deployment for the MVP dev frontend path.
- No enterprise auth, multi-tenant RBAC, or production auth hardening.
- No per-PR branch preview deployment.
- No replay mode, synthetic-run mode, live-capture mode, recording mode, or presentation mode.
- No product-facing fake histories to make the app look complete.

## Deterministic Checks

- Frontend API-client contract tests for each PR-010 route used by the app.
- UI/component tests for document library, document detail, inspection/readiness gating, job creation, placeholder run, economics, and invalid review states.
- Browser-level or route-level checks proving deployed-product screens do not depend on fixture histories.
- Browser/upload tests using the repository-controlled MVP PDF fixture rather than product-facing fixture histories or ad hoc files.
- Browser artifact-view tests proving the deployed app opens or previews source artifacts through the PR-010 private artifact-access route, not public S3 URLs, local files, fixture files, or raw PDF JSON payloads.
- CDK assertions or equivalent checks for S3 + CloudFront hosting resources, private S3 origin access, `/api/*` API origin routing, frontend stack outputs, and the CloudFront-to-Control-API origin verification configuration.
- Configuration tests proving the dev app uses the deployed API base URL by environment/config, not hard-coded localhost.
- Environment-scoping tests proving the deployed app uses the `ControlApiUrl` from the current deploy artifact and cannot satisfy validation with localhost, fixture files, wrong-stage, or wrong-account API endpoints.
- Access-protection tests proving browser app access is protected at CloudFront, direct API Gateway access without the PR-010 dev API token is rejected for product routes, `/api/*` requests through CloudFront reach Control API only with origin verification, and browser JavaScript does not expose the dev API token.
- Browser evidence-redaction tests or review checks proving screenshots, console/network logs, saved traces, and `PLAN.md` evidence do not expose session cookies, auth headers, full presigned URLs, signed query strings, raw artifact bytes, or unnecessary full document text.
- UI/component tests proving incomplete or failed multi-record API states render blocked/incomplete/error states rather than normal completed timelines, artifact links, accepted economics, or comparison rows.
- `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm cdk synth`.

## Deployed Verification

After merge, CI must deploy the merged SHA and produce the deploy artifact.

Codex must use the rendered deployed app directly and record:

1. Deploy artifact location, merged SHA, `FrontendUrl`, `ControlApiUrl`, hosting resource outputs, and access-protection mode.
2. Deploy artifact AWS account ID, region, stage, `FrontendUrl`, and `ControlApiUrl` match the browser URL and API endpoint used for validation.
3. Unauthorized or unauthenticated access to the CloudFront app surface is denied, challenged, or otherwise blocked according to the documented dev access mechanism, and direct API Gateway access without the PR-010 dev API token is rejected for product routes.
4. Authorized dev access opens the deployed app with a stable `validationRunId` or equivalent selector where the app/API supports it.
5. Browser network traffic targets the deployed CloudFront `/api/*` route or the deployed `ControlApiUrl` through the documented protected path, not localhost, fixture files, wrong-stage, or wrong-account endpoints. The app must not expose a reusable API secret in browser JavaScript or network-visible configuration.
6. Document library loads from persisted API data and does not show seeded product-facing histories.
7. The repository-controlled MVP Spanish PDF fixture can be uploaded or registered through the app using the PR-010 presign/document flow.
8. Attempting to create a job before inspection is blocked by the app or rejected by the API without creating a `TranslationJob`.
9. The document inspection action moves the controlled document to `READY` and labels the placeholder inspection basis honestly.
10. Refreshing the browser shows the persisted `READY` document from the deployed API.
11. Opening or previewing the source PDF uses the deployed Control API artifact-access route and a short-lived private artifact URL, not a public bucket/object URL, fixture file, localhost URL, or raw PDF JSON payload.
12. Browser console/network evidence and `PLAN.md` record sanitized artifact-access proof without storing full presigned URLs, signed query strings, cookies, auth headers, raw PDF bytes, or full document text.
13. A `TranslationJob` can be created through the app for the persisted `READY` document.
14. A run placeholder can be created through the app without invoking AgentCore.
15. Timeline, ledger, price book, artifact, and economics surfaces render persisted API responses and honest empty/not-yet-implemented states.
16. Attempting to review a non-`AWAITING_REVIEW` run through the app shows the `409` contract without creating a `ReviewDecision` or `HUMAN_REVIEW` ledger row.
17. A representative incomplete/failed API record-group response renders an explicit blocked/incomplete/error state and does not show accepted economics, verified outcome, or artifact/comparison success.

API calls may support evidence collection, but the acceptance path must include direct rendered-app use.

## Telemetry Verification

Use merged SHA, deploy run ID, `validationRunId`, browser session identifier when available, `documentId`, `jobId`, and `runId` as selectors.

Required when telemetry is queryable:

- Frontend delivery request for the validation session.
- Environment/workspace evidence showing the rendered app is served from the deploy artifact's CloudFront distribution, API requests route through the protected CloudFront `/api/*` path or documented protected API path, and both resolve to the deploy artifact's stage, region, AWS account, and workspace.
- Control API route signals for document, job, run placeholder, price book, economics, and invalid review requests.
- Control API artifact-access route signal for the source artifact preview/open action.
- Sanitized browser/network evidence without session cookies, auth headers, full presigned URLs, signed query strings, raw PDF bytes, or unnecessary full document text.
- No 5xx Control API response for successful routes.
- No `TranslationJob` write for the pre-inspection job creation attempt.
- No `ReviewDecision` write for the invalid review attempt.
- No app request to localhost, fixture JSON, direct unprotected API Gateway product routes, or a non-dev API endpoint during deployed verification.
- No frontend display that treats an incomplete document/job/run/stage/review/economics record group as a successful product outcome.

If telemetry cannot be queried yet, record the blocker in `PLAN.md`; do not claim telemetry verification passed.

## Acceptance Criteria

- PR is merged to `main`.
- Post-merge CI deployment succeeds and produces a deploy artifact.
- Deployed frontend URL is present in the deploy artifact.
- The frontend is hosted through S3 + CloudFront, and the hosting decision is documented.
- Dev app/API access is protected before real product data is exposed.
- The rendered deployed app reads and writes through the deployed Control API.
- The rendered deployed app reaches Control API through the protected CloudFront `/api/*` path or another explicitly documented protected path, without exposing the PR-010 dev API token in browser JavaScript.
- The rendered deployed app is validated against the current deploy artifact's environment, not localhost, fixture files, wrong-stage endpoints, or wrong-account resources.
- The rendered deployed app opens reviewer-visible artifacts only through protected Control API artifact access.
- Browser verification artifacts, screenshots, console/network logs, and `PLAN.md` evidence are sanitized and exclude credentials, cookies, auth headers, full presigned URLs, signed query strings, raw artifact bytes, and unnecessary full document text.
- Product-facing fixture histories are absent from the deployed app.
- PR-010 persisted API behavior is usable from normal app navigation.
- Incomplete or failed multi-record API states are not masked as successful timelines, artifacts, accepted economics, verified outcomes, or comparisons.
- Job creation is unavailable or rejected until the document is `READY`.
- `PLAN.md` records deterministic, deployed, and telemetry evidence.

## Review Traps

Reject or revise if the change:

- Leaves real product records anonymously readable through the API or rendered app.
- Uses Amplify instead of the selected S3 + CloudFront dev hosting path.
- Treats a static screenshot, fixture page, or local app as deployed verification.
- Keeps product-facing fixture histories in the deployed app.
- Lets users create jobs for documents that have not reached `READY`.
- Presents placeholder inspection as real PDF extraction, OCR, or translation readiness evidence.
- Hard-codes the API URL instead of using environment/config.
- Embeds the PR-010 dev API token or another reusable API secret in static app assets or browser-visible configuration.
- Uses stale, wrong-stage, wrong-account, localhost, or fixture endpoints to satisfy deployed browser verification.
- Uses public S3 URLs, bundled fixture files, localhost files, or raw PDF API responses for deployed artifact viewing.
- Leaks session cookies, auth headers, full presigned URLs, signed query strings, raw artifact bytes, or unnecessary full document text through screenshots, browser logs, CI artifacts, or `PLAN.md`.
- Masks incomplete API record groups as normal completed timelines, artifact links, accepted economics, verified outcomes, or comparison rows.
- Implements workflow execution, AgentCore, Bedrock, or PDF processing in this story.
- Adds replay, synthetic-run, live-capture, recording, or presentation behavior.
- Treats logs as the source of truth for economics.
- Uses ad hoc local browser data instead of the repository-controlled MVP PDF fixture for deployed verification.
