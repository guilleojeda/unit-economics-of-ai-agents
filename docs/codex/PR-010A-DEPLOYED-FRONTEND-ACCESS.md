# PR-010A - Deployed Frontend And Dev Access

PR-010A starts only after PR-010 is deployed and directly verified. It makes the rendered web app a deployed product surface before later workflow-execution stories depend on app-level verification.

## Objective

Deploy the static web app to the dev environment through CI using S3 + CloudFront, wire it to the deployed Persistent Control API, and protect dev browser/API access so future slices can be verified through normal product navigation instead of API-only calls.

## Scope

In scope:

- Use S3 + CloudFront for dev frontend hosting. Do not use Amplify for this MVP dev deployment path.
- Use a dedicated private frontend static asset bucket. Do not host frontend assets from the PR-010 product artifact bucket or mix product artifacts with deploy assets.
- Document why S3 + CloudFront fits the current app shape: a static/client-rendered Next.js app deployed as immutable assets behind CloudFront. If a later story requires SSR, server actions, image optimization that cannot be statically exported, or framework-managed hosting, that story must explicitly revisit hosting.
- Add the frontend deployment to the normal post-merge CI/CD path using infrastructure as code.
- Include frontend outputs in the deploy artifact, including app URL, hosting stack/resource identifiers, configured API base URL, and access-protection mode.
- Update CI workflow, deploy artifact creation, workflow validation, data-protection validation, smoke labels, and stack-output checks so PR-010A explicitly includes the frontend stack and classifies the frontend bucket separately from product data resources.
- Prove the CI deploy artifact bucket is separate from the product workflow artifact bucket. CI deployment evidence must not be stored with workflow PDFs or generated product artifacts.
- Configure the deployed app to call the deployed Control API, not local fixtures or localhost endpoints.
- Configure the deployed app through same-origin relative `/api/*` and non-secret build/runtime metadata. Production bundles and generated config must not contain localhost, wrong-stage endpoints, direct unprotected API Gateway product routes, stale deploy artifact values, browser credentials, direct API tokens, or origin-proof values.
- Bind the deployed app/API configuration to the current deploy artifact's stage, region, AWS account, `FrontendUrl`, and `ControlApiUrl`; wrong-environment endpoints must not satisfy deployed verification.
- Keep deployed browser verification evidence sanitized: do not commit or persist session cookies, auth headers, full artifact-access URLs, signed query strings, raw PDF bytes, or full document text in screenshots, browser logs, CI artifacts, or `PLAN.md`.
- Extend the PR-010 dev API protection model to browser users and the deployed app surface:
  - CloudFront is the normal browser entrypoint for the dev app.
  - CloudFront serves static app assets from private S3.
  - CloudFront routes `/api/*` to the deployed Control API origin so browser traffic uses the deployed API through the same dev app surface.
  - CloudFront enforces dev browser access, for example with CloudFront Function or Lambda@Edge Basic Auth, signed cookies, or an equivalent edge-enforced dev access gate.
  - CloudFront `/api/*` is protected for unauthenticated viewers as well as origin-proofed to Control API. It must not become a public API just because CloudFront injects an origin proof.
  - CloudFront injects a private origin verification header, or an equivalent origin proof, when forwarding `/api/*` to Control API.
  - Control API rejects direct API Gateway requests that lack either the PR-010 dev API token for direct API verification or the CloudFront origin proof for browser app traffic.
  - Browser JavaScript must not contain the PR-010 dev API token or any other reusable API secret.
- Configure `/api/*` cache and origin request policies so product API responses, auth failures, artifact URLs, and stale responses are not cached or leaked across sessions. Do not forward viewer browser-gate credentials, cookies, `Authorization`, or unnecessary headers to Control API unless explicitly required and proven safe.
- Access enforcement must be cache-safe for every protected CloudFront behavior. The gate must run before cache lookup, or use an equivalently proven mechanism, so authenticated app/API responses cannot be served to unauthenticated viewers and unauthenticated denials cannot poison later authenticated access.
- Add bounded-abuse controls for the public CloudFront app and `/api/*` surface, such as AWS WAF rate-based rules or an equivalent low-cost edge throttle. Repeated unauthenticated attempts must be denied cheaply and must not reach product behavior.
- The deployed app must use same-origin CloudFront `/api/*` by default. Direct browser calls to API Gateway require an explicitly documented equally protected exception; otherwise they do not satisfy PR-010A.
- Edge access checks must strip or avoid forwarding browser-gate credentials, cookies, `Authorization`, and unnecessary viewer headers to Control API after validation.
- Browser storage, referrers, diagnostics, and visible DOM must not persist or expose browser-gate credentials, direct API tokens, origin-proof values, cookies, auth headers, presigned URLs, signed query strings, raw PDF text, or full document content.
- CloudFront, S3, API Gateway, Lambda, browser, and CI telemetry/logging must be configured or constrained so they do not record cookies, auth headers, signed query strings, request bodies, full presigned URLs, raw PDF text, or full document content. Unsafe telemetry sources must stay disabled or be recorded as unavailable.
- Do not introduce a service worker, offline cache, PWA cache, or Cache Storage behavior unless it is explicitly proven not to cache protected API responses, artifact-access responses, signed URLs, credentials, product records, raw PDF text, full document content, or freshness-critical build/runtime metadata.
- Add and test a minimal response-header policy for the deployed app/config responses, including referrer policy, frame denial, content type nosniff, and cache behavior for HTML/config. CSP may be added only if tested against the actual static app and artifact-open flow.
- Configure static app delivery so the rendered app exposes a non-secret build identity matching the deploy artifact, and so stale CloudFront/S3 assets cannot satisfy deployed verification.
- Define the frontend asset publication path explicitly. CI must either build before synth and deploy static assets as CDK assets, or build/upload after stack outputs are available. In both cases, CI must validate the asset manifest, cache headers, CloudFront invalidation/readiness, and rendered build identity before writing a success deploy artifact.
- Frontend asset publication must not delete still-referenced hashed assets. Keep previous-build or recently referenced hashed assets for a documented short retention window so cached clients, validation retries, and CI-only fix-forward are not broken by destructive sync.
- Disable public production source maps and build-debug artifacts by default. If any `.map` files, debug manifests, route metadata, framework traces, or generated debug assets are intentionally deployed, they must be scanned and proven free of fixture histories, model IDs, fake comparison IDs, raw PDFs, full controlled document text, browser credentials, direct API tokens, origin-proof values, localhost/wrong-stage endpoints, and stale deploy artifact values.
- Prove dynamic product routes or their static client-side fallback work after direct navigation and browser refresh. A home page that renders while document/job/run deep links fail is not sufficient. Static fallback must not mask `/api/*` responses, auth failures, missing `/_next/*` assets, or missing built files as a successful app shell.
- Inventory production web routes and remove or block unsupported server-only Next.js behavior for the static deployment, including `redirect`, `headers`, `cookies`, server actions, route handlers, dynamic runtime config, ungenerated dynamic segments, and framework image optimization that cannot work from S3 + CloudFront static hosting.
- Configure browser upload support for the repository-controlled PDF fixture through a narrowly scoped S3 CORS rule or another proven non-API raw-byte path such as same-origin CloudFront-to-S3 upload. CORS must not be treated as authorization.
- Resolve artifact-bucket CORS without circular stack dependencies or broad wildcard origins. If narrow CORS cannot be safely represented for the existing storage bucket and new CloudFront URL, use another proven non-API raw-byte upload path or record a blocker. Do not proxy raw PDF bytes through Control API, API Gateway, Lambda, route handlers, or server actions.
- Any non-API raw-byte upload path must preserve PR-010 source-object constraints: allowed method, key prefix, object identity, content type, size/checksum metadata where supported, bucket separation, and overwrite protection. It must not write to the frontend hosting bucket or allow arbitrary S3 writes.
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
- Production static assets must not include product-facing fixture histories, fixture model IDs, hard-coded fake comparison IDs, raw PDFs, full controlled document text, dev access credentials, or origin proof values.
- The frontend hosting bucket must contain only frontend deploy assets. It must not contain product artifacts, raw PDFs, generated artifacts, ledger/economic evidence, or controlled-document content.
- Render incomplete or failed multi-record API states honestly. The app must not show normal completed timelines, accepted economics, artifact links, or comparison rows when the API indicates an incomplete document/job/run/stage/review/economics record group.
- Economics/settings surfaces must label persisted economics honestly. Do not claim fixture-derived rates, telemetry-derived estimates, or editable persisted settings unless those behaviors are actually implemented.
- Use the same repository-controlled MVP PDF fixture established for PR-010 deployed verification; do not rely on an ad hoc browser-local test file.
- Provide honest empty, loading, and not-yet-implemented states for workflow behavior deferred to later stories.
- Deployed incomplete/failed-state evidence must come from API-supported states such as nonexistent IDs, pre-run jobs, empty ledgers, invalid review attempts, or artifact-access errors. Do not use manual DynamoDB edits, hidden seed paths, or product fixtures to manufacture deployed evidence.
- Document non-secret secret locators or retrieval commands for the browser gate and direct API verification token so Codex can perform protected deployed verification without storing secret values in durable evidence.
- Maintain `docs/codex/DEPLOYED-VERIFICATION-HANDOFF.md` as the non-secret locator and redaction guide for future slices.
- The rendered app must be usable as the future verification surface. PR-010A must include desktop and mobile direct-use review of the impacted routes and states, including navigation, layout, loading, empty, error, disabled, blocked, and not-yet-implemented states.
- Leave a non-secret handoff for future slices: how to locate the latest deploy artifact, current `FrontendUrl`, rendered build identity, credential locators, direct-use verification steps, and evidence-redaction rules. Do not update repository instructions to claim PR-011 is next until PR-010A has actually merged, deployed, and been verified.
- Make the regional/global boundary explicit. Regional origins, buckets, secrets, logs, and API resources must stay in `us-east-1`; CloudFront distribution and any required edge resources must be identified as global/edge resources in infrastructure outputs, deploy artifacts, and rollback notes.

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
- CDK assertions or equivalent checks proving the frontend static bucket is a dedicated private deploy-asset bucket, separate from the PR-010 product artifact bucket.
- Path-routing checks or assertions proving CloudFront forwards `/api/price-books/current` and other `/api/*` routes to the intended Control API path without stripping or duplicating `/api` or applying the static fallback.
- CDK assertions or equivalent checks proving static assets use private S3 access through CloudFront OAC, `/api/*` disables product-response caching, viewer browser-gate credentials/cookies/`Authorization` are not forwarded unnecessarily to Control API, and unauthenticated CloudFront `/api/*` requests are denied before product behavior.
- Static export and routing checks proving document, job, and run deep links can be directly loaded/refreshed in the deployed static strategy.
- Static-export readiness checks scanning the production web route inventory for unsupported server-only APIs and features, including `redirect`, `headers`, `cookies`, server actions, route handlers, dynamic runtime config, ungenerated dynamic segments, and framework image optimization that cannot work from S3 + CloudFront static hosting.
- Routing fallback checks proving static fallback is scoped to product routes and does not mask `/api/*`, auth, or missing static asset failures.
- Browser upload/CORS checks proving the controlled fixture can be uploaded from the deployed CloudFront origin without broadening S3 CORS beyond the PR-010A flow.
- Configuration tests proving the dev app uses the deployed API base URL by environment/config, not hard-coded localhost.
- Environment-scoping tests proving the deployed app uses same-origin CloudFront `/api/*` by default and cannot satisfy validation with localhost, fixture files, wrong-stage, wrong-account, stale, or direct unprotected API Gateway endpoints.
- Static config tests proving production bundles and generated runtime/build metadata use same-origin relative API paths, contain the current build identity, and exclude localhost, wrong-stage endpoints, direct unprotected API Gateway product routes, stale deploy artifact values, browser credentials, direct API tokens, and origin-proof values.
- Access-protection tests proving browser app access is protected at CloudFront, direct API Gateway access without the PR-010 dev API token is rejected for product routes, `/api/*` requests through CloudFront reach Control API only with origin verification, and browser JavaScript does not expose the dev API token.
- Cache-safety access tests proving an authenticated request cannot prime CloudFront cache for an unauthenticated static or `/api/*` request, unauthenticated denial responses do not poison later authenticated access, and every CloudFront behavior runs the access gate or an equivalently proven cache-safe mechanism.
- Abuse-boundary checks proving repeated unauthenticated CloudFront app and `/api/*` attempts are denied through a bounded low-cost path, do not reach product behavior, and do not produce sensitive logs.
- Edge/origin-request tests or assertions proving browser-gate credentials, cookies, `Authorization`, and unnecessary viewer headers are stripped or not forwarded to Control API after edge validation.
- Deploy-artifact checks proving PR-010A frontend outputs, build identity, CloudFront distribution ID, and schema version are present and match the rendered app.
- CI/deploy contract checks proving `.github/workflows/ci.yml`, `scripts/ci/validate-workflow.mjs`, `scripts/ci/validate-data-protection.mjs`, `scripts/ci/create-deploy-artifact.mjs`, and smoke checks are PR-010A-aware, require the frontend stack, distinguish the frontend hosting bucket from product data resources, and reject stale PR-009/PR-010 deploy schemas or smoke labels.
- Asset-publication checks proving CI builds the frontend at the correct point in the workflow, publishes the expected manifest to the frontend bucket, sets correct cache headers, and fails if required HTML/JS/CSS assets are missing or stale.
- Asset-retention checks proving CI does not delete still-referenced hashed assets, keeps enough previous-build assets for validation retries or CI-only fix-forward, and treats HTML/runtime config as short-cache.
- CORS/dependency checks proving controlled-PDF upload uses narrowly scoped artifact-bucket CORS without circular stack dependencies, or another proven non-API raw-byte path such as same-origin CloudFront-to-S3 upload; broad wildcard CORS and raw-PDF API proxying fail validation.
- Upload-boundary checks proving any non-API raw-byte upload path preserves method, key prefix, object identity, content type, size/checksum metadata where supported, bucket separation, and overwrite protection from PR-010.
- Deploy-artifact validation proving the CI deploy artifact bucket is distinct from the product workflow artifact bucket.
- Secret-retrieval checks or documented preflight evidence proving Codex can retrieve the browser-gate credential and direct API verification token through approved secret locators after deployment; secret values must not appear in test output.
- Configuration checks proving `allowUnauthenticatedPlaceholderApi`, `CDK_ALLOW_UNAUTHENTICATED_PLACEHOLDER_API`, `DEV_UNAUTHENTICATED_PLACEHOLDER`, or equivalent stale placeholder paths cannot enable deployed unauthenticated product API access.
- Browser-storage and referrer-policy checks proving the app does not write protected credentials, presigned URLs, raw document text, or full document content to browser persistence APIs, URL query strings, visible copy, referrer headers, or saved traces.
- Logging/telemetry configuration checks proving CloudFront/S3/API Gateway/Lambda/CI evidence does not record cookies, auth headers, signed query strings, request bodies, full presigned URLs, or unnecessary document content. Unsafe telemetry sources must remain disabled or be recorded as unavailable.
- Response-header checks proving the deployed app returns tested security headers for static app/config responses without breaking app load, API calls, or artifact opens.
- Service-worker/offline-cache checks proving the production app registers no service worker/offline cache, or that any intentionally registered cache excludes `/api/*`, artifact-access responses, signed URLs, credentials, product records, raw PDF text, full document content, and freshness-critical build/runtime metadata.
- Production asset scans proving browser bundles/static output do not contain fixture histories, fixture model IDs, hard-coded fake comparison IDs, raw PDFs, full controlled document text, dev access credentials, or origin proof values.
- Source-map and build-debug asset scans proving public `.map` files, debug manifests, route metadata, framework traces, and other generated debug assets are absent by default or contain no fixture histories, model IDs, fake comparison IDs, raw PDFs, full controlled document text, browser credentials, direct API tokens, origin-proof values, localhost/wrong-stage endpoints, or stale deploy artifact values.
- Browser evidence-redaction tests or review checks proving screenshots, console/network logs, saved traces, and `PLAN.md` evidence do not expose session cookies, auth headers, full presigned URLs, signed query strings, raw artifact bytes, or unnecessary full document text.
- UI/component tests proving incomplete or failed multi-record API states render blocked/incomplete/error states rather than normal completed timelines, artifact links, accepted economics, or comparison rows.
- UI/component tests proving economics/settings surfaces do not claim fixture-derived or telemetry-derived economics and do not offer fake editable persisted settings.
- UI or browser checks proving critical controls have usable labels, disabled states are visible and enforced, loading/error/empty states render without layout overlap, and the PR-010A routes are usable at representative desktop and mobile viewport sizes.
- Handoff-documentation checks proving future slices can find the latest deploy artifact, current `FrontendUrl`, rendered build identity, credential locators, verification procedure, and evidence-redaction rules without storing secret values.
- Region-boundary checks proving regional origins, buckets, secrets, logs, and API resources remain in `us-east-1`, while CloudFront distribution and any required edge resources are explicitly identified as global/edge resources in deploy artifacts.
- `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm cdk synth`.

## Deployed Verification

After merge, CI must deploy the merged SHA and produce the deploy artifact.

Codex must use the rendered deployed app directly and record:

1. Deploy artifact location, merged SHA, `FrontendUrl`, `ControlApiUrl`, hosting resource outputs, and access-protection mode.
2. Deploy artifact AWS account ID, region, stage, `FrontendUrl`, and `ControlApiUrl` match the browser URL and API endpoint used for validation.
3. Unauthorized or unauthenticated access to the CloudFront app surface is denied, challenged, or otherwise blocked according to the documented dev access mechanism, and direct API Gateway access without the PR-010 dev API token is rejected for product routes.
4. Unauthorized or unauthenticated CloudFront `/api/*` access is denied and cannot read or mutate product records through CloudFront-origin proof alone.
5. Repeated unauthenticated app and `/api/*` attempts are blocked through the documented bounded-abuse mechanism and do not reach product behavior.
6. Authorized dev access opens the deployed app with a stable `validationRunId` or equivalent selector where the app/API supports it.
7. The rendered app build identity matches the deploy artifact and merged SHA.
8. Re-check unauthenticated app and CloudFront `/api/*` access after authorized app/API use to prove authorized responses were not cached for anonymous viewers.
9. Re-check authorized app/API access after unauthenticated denials to prove denial responses did not poison authenticated access.
10. Browser network traffic targets same-origin deployed CloudFront `/api/*` unless a documented equally protected exception is intentionally chosen. It must not target localhost, fixture files, wrong-stage, wrong-account, stale, or direct unprotected API Gateway endpoints. The app must not expose a reusable API secret in browser JavaScript or network-visible configuration.
11. Production bundle/runtime metadata uses same-origin `/api/*`, not localhost, wrong-stage endpoints, stale direct API Gateway endpoints, stale deploy artifact values, or browser-visible secrets.
12. Browser storage APIs, referrer behavior, console output, and saved evidence do not expose browser credentials, direct API tokens, origin proofs, presigned URLs, signed query strings, raw document text, or full document content.
13. Static app/config responses include the expected minimal security headers.
14. No service worker/offline cache is registered, or any intentional registration is verified not to cache `/api/*`, artifact-access responses, signed URLs, credentials, product records, raw document text, full document content, or freshness-critical build/runtime metadata.
15. Public source maps and build-debug artifacts are absent by default, or are inspected and proven sanitized.
16. Perform a manual product/visual audit on desktop and mobile for the exercised PR-010A routes. Navigation, layout, copy, controls, loading, empty, error, disabled, blocked, and not-yet-implemented states must be usable and must not imply completed workflow behavior.
17. Document library loads from persisted API data and does not show seeded product-facing histories.
18. The repository-controlled MVP Spanish PDF fixture can be uploaded or registered through the app using the PR-010 presign/document flow, including browser preflight/upload behavior where S3 CORS is used. If another non-API raw-byte upload path is chosen, verify raw PDF bytes do not traverse Control API, API Gateway, Lambda, route handlers, or server actions; also verify arbitrary-key, wrong-content-type, oversize, missing-required-metadata, and overwrite attempts fail without creating registered product artifacts.
19. Attempting to create a job before inspection is blocked by the app or rejected by the API without creating a `TranslationJob`.
20. The document inspection action moves the controlled document to `READY` and labels the placeholder inspection basis honestly.
21. Refreshing the browser shows the persisted `READY` document from the deployed API.
22. Direct navigation/refresh for document, job, and run deep links serves the deployed app and reloads persisted API-backed state.
23. Opening or previewing the source PDF uses the deployed Control API artifact-access route and a short-lived private artifact URL, not a public bucket/object URL, fixture file, localhost URL, or raw PDF JSON payload.
24. Browser console/network evidence and `PLAN.md` record sanitized artifact-access proof without storing full presigned URLs, signed query strings, cookies, auth headers, raw PDF bytes, or full document text.
25. A `TranslationJob` can be created through the app for the persisted `READY` document.
26. A run placeholder can be created through the app without invoking AgentCore.
27. Timeline, ledger, price book, artifact, and economics surfaces render persisted API responses and honest empty/not-yet-implemented states.
28. Attempting to review a non-`AWAITING_REVIEW` run through the app shows the `409` contract without creating a `ReviewDecision` or `HUMAN_REVIEW` ledger row.
29. A representative incomplete/failed API-supported state renders an explicit blocked/incomplete/error state and does not show accepted economics, verified outcome, or artifact/comparison success.
30. Economics/settings surfaces use honest persisted-data copy and do not show fixture-derived rates, fake editable persisted settings, or telemetry-derived basis without actual telemetry support.
31. The non-secret future-slice handoff in `docs/codex/DEPLOYED-VERIFICATION-HANDOFF.md` identifies deploy artifact retrieval, current `FrontendUrl`, rendered build identity, credential locators, direct-use verification steps, and evidence-redaction rules.

API calls may support evidence collection, but the acceptance path must include direct rendered-app use.

## Telemetry Verification

Use merged SHA, deploy run ID, `validationRunId`, browser session identifier when available, `documentId`, `jobId`, and `runId` as selectors.

Required when telemetry is queryable:

- Frontend delivery request for the validation session.
- Blocked unauthenticated CloudFront `/api/*` request for the validation session.
- Environment/workspace evidence showing the rendered app is served from the deploy artifact's CloudFront distribution, API requests route through the protected CloudFront `/api/*` path or documented protected API path, and both resolve to the deploy artifact's stage, region, AWS account, and workspace.
- Control API route signals for document, job, run placeholder, price book, economics, and invalid review requests.
- Control API artifact-access route signal for the source artifact preview/open action.
- Sanitized browser/network evidence without session cookies, auth headers, full presigned URLs, signed query strings, raw PDF bytes, or unnecessary full document text.
- No enabled CloudFront, S3, API Gateway, Lambda, browser, or CI telemetry source records cookies, auth headers, signed query strings, request bodies, full presigned URLs, raw PDF text, or full document content.
- No 5xx Control API response for successful routes.
- No `TranslationJob` write for the pre-inspection job creation attempt.
- No `ReviewDecision` write for the invalid review attempt.
- No app request to localhost, fixture JSON, direct unprotected API Gateway product routes, or a non-dev API endpoint during deployed verification.
- No frontend display that treats an incomplete document/job/run/stage/review/economics record group as a successful product outcome.
- No frontend display claiming fixture-derived rates, fake editable persisted settings, or telemetry-derived economics without actual telemetry-backed basis.
- No service worker, browser cache, or Cache Storage entry contains protected API responses, artifact URLs, signed URLs, credentials, raw PDF text, full document content, product records, or stale build/runtime metadata.
- No public source map or build-debug asset contains fixture histories, model IDs, fake comparison IDs, raw PDFs, full controlled document text, browser credentials, direct API tokens, origin-proof values, localhost/wrong-stage endpoints, or stale deploy artifact values.

If telemetry cannot be queried yet, record the blocker in `PLAN.md`; do not claim telemetry verification passed.

## Acceptance Criteria

- PR is merged to `main`.
- Post-merge CI deployment succeeds and produces a deploy artifact.
- Deployed frontend URL is present in the deploy artifact.
- Deploy artifact schema/version reflects PR-010A and includes frontend stack/resource outputs, CloudFront distribution ID, access-protection mode, configured API path, and non-secret rendered build identity.
- CI/deploy validators are updated for PR-010A and require the frontend stack, frontend outputs, separate frontend hosting bucket classification, and no stale PR-009/PR-010 deploy artifact schema or smoke labels.
- CI deploy artifact bucket is distinct from the product workflow artifact bucket.
- CI validates frontend asset publication, manifest coherence, cache headers, and CloudFront invalidation/readiness before producing a success deploy artifact.
- The frontend is hosted through S3 + CloudFront, and the hosting decision is documented.
- The frontend static asset bucket is separate from the PR-010 product artifact bucket and contains no product artifacts or raw PDFs.
- Dev app/API access is protected before real product data is exposed.
- Unauthenticated CloudFront `/api/*` access is denied and cannot use origin proof alone to access product data.
- Repeated unauthenticated CloudFront app and `/api/*` attempts are denied by a bounded low-cost path and do not reach product behavior.
- Access enforcement is cache-safe: authenticated responses cannot be replayed to unauthenticated viewers, and unauthenticated denials cannot poison authenticated access.
- `/api/*` caching/header forwarding cannot leak product responses or viewer credentials.
- Browser-gate credentials, cookies, `Authorization`, and unnecessary viewer headers are not forwarded to Control API after edge validation.
- The rendered deployed app reads and writes through the deployed Control API.
- The rendered deployed app reaches Control API through same-origin protected CloudFront `/api/*` unless an explicitly documented equally protected exception is intentionally chosen, without exposing the PR-010 dev API token in browser JavaScript.
- The rendered deployed app is validated against the current deploy artifact's environment, not localhost, fixture files, wrong-stage endpoints, or wrong-account resources.
- The rendered deployed app opens reviewer-visible artifacts only through protected Control API artifact access.
- Browser verification artifacts, screenshots, console/network logs, and `PLAN.md` evidence are sanitized and exclude credentials, cookies, auth headers, full presigned URLs, signed query strings, raw artifact bytes, and unnecessary full document text.
- Product-facing fixture histories are absent from the deployed app.
- Production browser bundles/static output exclude fixture histories, fixture model IDs, hard-coded fake comparison IDs, raw PDFs, full controlled document text, dev access credentials, and origin proof values.
- PR-010 persisted API behavior is usable from normal app navigation.
- Incomplete or failed multi-record API states are not masked as successful timelines, artifacts, accepted economics, verified outcomes, or comparisons.
- Economics/settings surfaces do not show fixture-derived rates, fake editable persisted settings, or telemetry-derived basis without actual telemetry-backed behavior.
- Job creation is unavailable or rejected until the document is `READY`.
- Browser upload works from the deployed app through direct S3 presigned upload with narrowly scoped CORS or another proven non-API raw-byte path, and does not rely on broad wildcard S3 CORS, a circular stack-dependency workaround, raw-PDF API proxying, arbitrary S3 writes, or source-object overwrites.
- Frontend asset publication retains still-referenced hashed assets long enough for cached clients, validation retries, and CI-only fix-forward; HTML/runtime config remains short-cache.
- Direct navigation and refresh for document, job, and run deep links work in the static deployment.
- The production web route inventory contains no unsupported server-only behavior required by the deployed static app.
- Browser-gate and direct API verification credential retrieval paths are documented through non-secret locators, and secret values are excluded from durable evidence.
- Browser storage, referrers, diagnostics, platform logs, and CI logs do not persist or expose credentials, signed artifact URLs, request bodies, raw PDF text, or full document content.
- Service workers, offline caches, browser caches, and Cache Storage do not persist or serve protected API responses, artifact URLs, signed URLs, credentials, raw PDF text, full document content, product records, or stale build/runtime metadata.
- Public source maps and build-debug artifacts are absent by default, or scanned and proven free of fixture histories, secrets, internal endpoints, raw PDFs, full document text, and origin-proof values.
- Static app/config responses include tested security headers appropriate for the protected dev app.
- The rendered deployed app passes desktop and mobile direct-use review for route usability, layout, copy, controls, loading, empty, error, disabled, blocked, and not-yet-implemented states.
- Future slices can discover the deployed verification workflow from non-secret repository docs or story-contract text without relying on local memory, screenshots, raw secrets, or stale PR-010A planning notes.
- Deploy artifacts and infrastructure tests distinguish global CloudFront/edge resources from `us-east-1` regional origins, buckets, secrets, logs, and API resources.
- `PLAN.md` records deterministic, deployed, and telemetry evidence.

## Review Traps

Reject or revise if the change:

- Leaves real product records anonymously readable through the API or rendered app.
- Uses Amplify instead of the selected S3 + CloudFront dev hosting path.
- Reuses the PR-010 product artifact bucket for frontend static assets.
- Treats a static screenshot, fixture page, or local app as deployed verification.
- Keeps product-facing fixture histories in the deployed app.
- Lets users create jobs for documents that have not reached `READY`.
- Presents placeholder inspection as real PDF extraction, OCR, or translation readiness evidence.
- Hard-codes the API URL instead of using environment/config.
- Leaves PR-009/PR-010 deploy artifact schema, expected stack allowlists, data-protection validation, workflow validation, or smoke labels in a state where the frontend stack can be omitted from deploy evidence.
- Stores CI deploy artifacts in the product workflow artifact bucket.
- Deploys a frontend bucket with missing, partial, stale, or wrong-build static assets while stack deployment succeeds.
- Leaves `allowUnauthenticatedPlaceholderApi`, `CDK_ALLOW_UNAUTHENTICATED_PLACEHOLDER_API`, `DEV_UNAUTHENTICATED_PLACEHOLDER`, or equivalent stale placeholder access paths reachable for deployed product API behavior.
- Embeds the PR-010 dev API token or another reusable API secret in static app assets or browser-visible configuration.
- Protects only the static app shell while leaving CloudFront `/api/*` callable by unauthenticated viewers.
- Leaves the public CloudFront app or `/api/*` surface without bounded-abuse controls for repeated unauthenticated attempts.
- Runs the access gate after cache lookup or otherwise allows authorized app/API responses, unauthenticated denials, or static HTML to be served to the wrong viewer.
- Lets CloudFront cache product API responses, auth failures, artifact URLs, or stale API data across sessions.
- Forwards viewer browser-gate credentials, cookies, `Authorization`, or unnecessary headers to Control API without explicit proof that doing so is safe.
- Uses direct browser API Gateway calls as the default deployed app API path.
- Uses stale, wrong-stage, wrong-account, localhost, or fixture endpoints to satisfy deployed browser verification.
- Bakes localhost, wrong-stage, direct unprotected API Gateway endpoints, stale deploy artifact values, browser credentials, direct API tokens, or origin-proof values into the production bundle or generated runtime config.
- Serves stale frontend assets while the deploy artifact claims the merged SHA.
- Leaves document/job/run deep links broken in the static deployment, or uses a static fallback that hides API/auth/static-asset failures.
- Leaves server-only Next.js behavior in production routes that are supposed to run as static/client-rendered assets from S3 + CloudFront.
- Misroutes CloudFront `/api/*` by stripping or duplicating `/api`, targeting the wrong API Gateway stage/path, or allowing static fallback to handle API errors.
- Uses broad S3 CORS to make browser upload work.
- Uses Control API, API Gateway, Lambda, route handlers, or server actions to proxy raw PDF bytes as a browser-upload workaround.
- Lets a non-API raw-byte upload path write arbitrary S3 keys, overwrite source evidence, write to the frontend hosting bucket, or bypass content type, size, metadata, or object-identity constraints.
- Deletes still-referenced hashed frontend assets during deployment or requires manual S3/CloudFront edits for validation retries, rollback, or fix-forward.
- Uses manual DynamoDB edits, hidden seed paths, or product fixtures to manufacture deployed incomplete-state evidence.
- Ships production static assets containing fixture histories, fixture model IDs, hard-coded fake comparison IDs, raw PDFs, full controlled document text, dev access credentials, or origin proof values.
- Leaves fixture-derived rates, fake editable settings, or false telemetry-derived labels on economics/settings surfaces.
- Uses public S3 URLs, bundled fixture files, localhost files, or raw PDF API responses for deployed artifact viewing.
- Leaks session cookies, auth headers, full presigned URLs, signed query strings, raw artifact bytes, or unnecessary full document text through screenshots, browser logs, CI artifacts, or `PLAN.md`.
- Stores credentials, presigned URLs, signed query strings, raw PDF text, or full document content in browser persistence APIs, referrers, visible DOM, diagnostics, platform logs, or CI logs.
- Registers a service worker/offline cache or writes Cache Storage entries that cache protected API responses, artifact-access responses, signed URLs, credentials, product records, raw PDF text, full document content, or freshness-critical build/runtime metadata.
- Ships source maps, debug manifests, route metadata, framework traces, or build-debug assets that expose fixture histories, model IDs, fake comparison IDs, raw PDFs, full controlled document text, browser credentials, direct API tokens, origin-proof values, localhost/wrong-stage endpoints, or stale deploy artifact values.
- Omits the tested minimal security response headers from static app/config responses.
- Ships a technically deployed app that is not usable for future direct verification because navigation, layout, copy, controls, mobile rendering, loading, empty, error, disabled, blocked, or not-yet-implemented states are broken or misleading.
- Leaves future agents without a non-secret way to find the current deploy artifact, `FrontendUrl`, rendered build identity, credential locators, verification steps, and evidence-redaction rules.
- Masks incomplete API record groups as normal completed timelines, artifact links, accepted economics, verified outcomes, or comparison rows.
- Implements workflow execution, AgentCore, Bedrock, or PDF processing in this story.
- Adds replay, synthetic-run, live-capture, recording, or presentation behavior.
- Treats logs as the source of truth for economics.
- Uses ad hoc local browser data instead of the repository-controlled MVP PDF fixture for deployed verification.
