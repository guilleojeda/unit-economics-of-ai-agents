# PLAN

## Objective

Complete `PR-010A - Deployed frontend and dev access`: deploy the existing product UI to the AWS dev environment through post-merge CI using S3 and CloudFront, wire it to the persistent Control API, protect dev browser and API access, and prove the rendered deployed app works through direct Codex use.

## Scope And Non-Goals

In scope:

- Update the active work state so `PR-010A` is the next slice after the completed `PR-010`.
- Add S3 plus CloudFront frontend hosting infrastructure with a private static asset bucket.
- Use a dedicated non-product frontend static asset bucket. Do not host frontend assets from the PR-010 artifact bucket or mix product artifacts with deploy assets.
- Serve the static Next.js app through CloudFront.
- Route browser API traffic through CloudFront `/api/*` to the deployed Control API.
- Add dev browser access protection for the CloudFront app.
- Add an origin-proof mechanism so browser API traffic through CloudFront can call the Control API without exposing the PR-010 dev API token in browser JavaScript.
- Keep direct Control API calls protected by the PR-010 dev API token.
- Define a non-secret static-app configuration and asset-publishing path that cannot deploy stale localhost, wrong-stage, or pre-PR-010A values.
- Replace product-facing fixture histories with API-backed state for the flows already supported by PR-010.
- Keep test and local-only fixtures available for deterministic tests and scaffolding.
- Bind deployed frontend/API behavior to the current deploy artifact's stage, region, AWS account, `FrontendUrl`, and `ControlApiUrl`; wrong-environment endpoints cannot satisfy verification.
- Keep deployed browser verification evidence sanitized. Do not persist session cookies, auth headers, full presigned URLs, signed query strings, raw PDF bytes, or full document text in screenshots, browser logs, CI artifacts, or this plan.
- Do not introduce a service worker, offline cache, or client-side Cache Storage behavior unless it is explicitly proven not to cache protected API responses, artifact URLs, credentials, product records, raw PDF text, or document content.
- Disable production source maps and build-debug artifacts by default, or prove they are intentionally deployed, scanned, sanitized, and free of fixture histories, secrets, internal endpoints, raw PDFs, full document text, and origin-proof values.
- Update post-merge CI deployment and deploy artifacts to include frontend URL, hosting resources, configured API base URL, and access-protection mode.
- Add non-secret handoff documentation or contract text that tells future slices how to locate the latest deploy artifact, deployed app URL, credential locators, verification procedure, and evidence-redaction rules.
- Directly exercise the rendered deployed app after the merged SHA deploys.

Non-goals:

- No AgentCore Runtime integration.
- No AgentCore Gateway integration.
- No Bedrock calls.
- No real PDF extraction or recomposition.
- No V2 or V3 workflow implementation.
- No Amplify.
- No per-PR preview environments.
- No Cognito, enterprise auth, or production auth model.
- No replay, synthetic-run, live-capture, recording, or presentation modes.
- No fake product-facing run histories.
- No AWS billing reconciliation.

## Assumptions And Open Questions

The plan depends on these assumptions. Each assumption must be challenged during implementation and converted into evidence or a recorded blocker.

1. `PR-010` is complete and stable enough to build on.
   Evidence: main SHA `43dc954063345bcc434f1c7453d27bfda6e74f9d`, main CI run `26204080013`, protected live API verification passed, and the user waived the remaining PR-010 CloudWatch telemetry constraint.
   Could be false if the deployed PR-010 API regressed, if stack outputs changed, if the dev token changed, or if existing dev data now conflicts with PR-010A validation.
   Breakage if false: PR-010A frontend work would mask backend defects as UI bugs, or deployed verification would fail late.
   Plan change: first implementation step must re-read the latest deploy artifact and smoke the existing protected price-book route before editing product code; if it fails, fix PR-010 deployment health first.

2. The next branch can safely be `codex/pr-010a-deployed-frontend-access`.
   Evidence: repository build order and local instructions identify PR-010A as next.
   Could be false if uncommitted planning edits are lost, if `main` advances, or if the existing working tree is not reconciled before branching.
   Breakage if false: implementation starts from stale or inconsistent instructions.
   Plan change: before implementation, reconcile the current planning/documentation changes, update from `origin/main`, and ensure the branch includes the accepted PR-010A plan and instruction updates.

3. S3 plus CloudFront is still the right hosting shape for this app.
   Evidence: the PR-010A story contract selects S3 plus CloudFront, and current app behavior can be made client-rendered.
   Could be false if the app requires SSR, server actions, framework image optimization, route handlers, cookies/headers at render time, or dynamic routes that cannot be statically exported.
   Breakage if false: CI deploys static assets that do not render real routes or fail on refresh/deep links.
   Plan change: prove static export before infrastructure finalization. If static export fails, convert the PR-010A UI to a static client-side shell or stop and revise the story; do not silently add SSR, Lambda hosting, or Amplify.

4. Current Next.js dynamic routes can work in a static deployment.
   Evidence: Next.js supports static export, but dynamic route segments require explicit handling such as generated static params or a client-side routing strategy.
   Could be false if routes like `/documents/[documentId]`, `/jobs/[jobId]`, and `/compare/[comparisonGroupId]` cannot be exported for arbitrary persisted IDs.
   Breakage if false: direct navigation and refresh for product records fail even though client-side navigation looked fine.
   Plan change: PR-010A must choose and test a static route strategy: either exported static shells for dynamic routes or a client-side app route/fallback served by CloudFront. Deployed verification must include refresh/deep-link checks for at least one document, job, and run URL.

5. CloudFront can safely route `/api/*` to the Control API.
   Evidence: CloudFront supports custom origins and custom origin headers, and AWS docs confirm custom headers can identify CloudFront-origin requests and overwrite viewer-supplied values before forwarding.
   Could be false if header names are disallowed, if origin path/path rewriting is wrong, if API Gateway host/origin configuration is wrong, or if the origin-proof value leaks.
   Breakage if false: browser API calls fail, direct clients can spoof CloudFront, or API Gateway accepts unprotected traffic.
   Plan change: use only allowed custom header names, assert path behavior in infrastructure tests, prove spoofed viewer headers fail, and fail the design gate if the origin proof cannot be kept out of browser-visible and routine artifact surfaces.

6. CloudFront `/api/*` is protected for browser users, not only origin-proofed.
   Evidence: the story says dev app/API access must be protected, but the current plan previously emphasized only static app access and API Gateway origin proof.
   Could be false if `/api/*` behavior always injects the origin proof and does not enforce browser access.
   Breakage if false: anyone with the CloudFront URL can call `/api/*` and read/write dev product data even though the static app page itself is gated.
   Plan change: the selected edge gate must protect both static routes and `/api/*`, or the `/api/*` behavior must have an equivalent viewer-access check before origin proof is added. Deployed verification must prove unauthenticated CloudFront `/api/*` calls are denied.

7. Browser-gate credentials and origin-proof credentials can be represented without unacceptable leakage.
   Evidence: no final mechanism is selected yet.
   Could be false because CloudFront Functions cannot read Secrets Manager at request time, Basic Auth implementations often embed credentials or hashes in function code, and CloudFront distribution custom headers are visible to principals who can read distribution configuration.
   Breakage if false: the dev gate becomes security theater or secrets leak through templates, artifacts, logs, or screenshots.
   Plan change: Step 2 must document the threat model, storage location, template representation, rotation path, and evidence that reusable secrets are not in browser bundles, checked-in files, deploy artifacts, or routine logs. If only a hash can be used, it must be high-entropy, non-reusable, and documented as a dev gate rather than production auth.

8. API cache and header policies will not leak protected product responses.
   Evidence: CloudFront can disable caching for API behavior; AWS docs warn that forwarding `Authorization` without correct cache-key behavior can serve cached content to unauthorized viewers.
   Could be false if `/api/*` uses a default cache policy, forwards browser credentials to origin, or caches auth failures/artifact URLs.
   Breakage if false: one validation session can see another session's product data or stale presigned URLs.
   Plan change: `/api/*` must use a no-store/CachingDisabled policy or equivalent, must not forward viewer browser-gate credentials/cookies unless explicitly required and safe, and must have infrastructure assertions for cache and origin request policies.

9. Browser upload through PR-010 presigned S3 URLs will work from the CloudFront app.
   Evidence: PR-010 verified upload by script, not by browser. AWS S3 CORS docs confirm browser preflight must match allowed origins, methods, and headers.
   Could be false if the artifact bucket lacks CORS for the CloudFront origin or if presigned POST/PUT required headers are not allowed.
   Breakage if false: the deployed app can load but cannot upload/register the controlled PDF.
   Plan change: add narrow S3 CORS for the deployed CloudFront origin and required upload/read headers, or choose another non-API raw-byte path such as a proven same-origin CloudFront-to-S3 upload route. If neither can be made safe, record a blocker. Do not proxy raw PDF bytes through the Control API, API Gateway, or Lambda.

10. The frontend can remove product-facing fixture histories without losing necessary UX.
    Evidence: fixtures are currently concentrated in `apps/web/src/components/fixture-context.tsx`, `apps/web/src/lib/fixtures.ts`, fixture-backed tests, and hard-coded navigation such as `/compare/cmp_refunds`.
    Could be false if too many components assume fixture-only data shapes, accepted V2/V3 histories, or local mutation helpers.
    Breakage if false: developers leave fixture fallbacks in place and the app appears complete without persisted API records.
    Plan change: create an API-backed app state boundary first, keep fixtures only in test-only modules, and add forbidden runtime import/navigation checks for product code.

11. PR-010 APIs are sufficient for PR-010A user flows.
    Evidence: PR-010 direct verification covered price book, document upload/register/inspect, V1 job, run placeholder, ledger/economics, and artifact URL.
    Could be false if list endpoints are eventually consistent, if UI needs missing detail endpoints, if artifact URLs are not browser-usable, or if invalid review responses differ from the UI contract.
    Breakage if false: the UI adds client-side fake state or hidden fallbacks to look usable.
    Plan change: API client tests must pin every PR-010 route used by the app, and missing API behavior must be fixed in Control API rather than faked in the frontend.

12. The deploy artifact can prove the exact deployed frontend build.
    Evidence: current deploy artifact records backend stack outputs and commit SHA, but PR-010A must add frontend outputs and schema.
    Could be false if CloudFront serves stale cached assets, if the artifact omits the distribution/build identity, or if S3 sync leaves old assets referenced by new HTML.
    Breakage if false: Codex verifies an old frontend while believing it is the merged SHA.
    Plan change: deploy immutable asset paths or a build manifest, set safe cache headers for HTML versus hashed assets, invalidate/wait as needed, expose a non-secret build SHA/build ID in the rendered app, and verify it matches the deploy artifact.

13. CI can create and update CloudFront, S3 hosting, edge code, bucket CORS, and any required IAM policies.
    Evidence: CI already deploys CDK stacks, but it has not yet deployed CloudFront/frontend resources.
    Could be false if the pipeline or CloudFormation execution role lacks CloudFront, S3 bucket policy/CORS, Lambda@Edge/CloudFront Function, IAM, or invalidation permissions.
    Breakage if false: implementation passes local checks but post-merge deployment fails.
    Plan change: add CI/IaC permission prerequisites and failure modes before merge. If account-level permissions are missing, record the exact blocker and use the approved CI/IaC path or ask for human action; do not manually mutate AWS resources.

14. CloudFront deployment, propagation, and invalidation fit the post-merge workflow.
    Evidence: CloudFormation/CDK can deploy distributions, but CloudFront propagation can be slower than API-only stacks.
    Could be false if distribution deployment exceeds expected CI time, invalidation fails, or DNS/edge propagation serves stale assets.
    Breakage if false: deployment appears green but direct use sees old or broken UI.
    Plan change: CI must wait for stack completion and invalidation where used; deployed verification must compare rendered build identity against the deploy artifact and retry only as an external wait, not by manual redeploy.

15. Verification evidence can be sanitized without becoming too weak.
    Evidence: the story requires sanitized proof and forbids persisting sensitive browser/API artifacts.
    Could be false if the only convenient proof contains full presigned URLs, cookies, raw PDF content, or signed query strings.
    Breakage if false: either evidence leaks credentials/data or completion is claimed without proof.
    Plan change: define sanitized evidence shapes before deployed verification, such as status codes, hostnames, path names, redacted query strings, resource IDs, request IDs, hashes, and screenshots cropped/redacted to omit sensitive details.

16. Telemetry can be queried or honestly blocked.
    Evidence: current repository has limited queryable telemetry, and prior PR-010 telemetry was waived.
    Could be false if future reviewers treat telemetry absence as success, or if logs contain insufficient selectors.
    Breakage if false: the app is accepted without operational evidence, or telemetry queries cannot isolate validation.
    Plan change: add validation selectors to frontend/API requests where feasible, record exact telemetry gaps, and do not claim telemetry verification if selectors/log access are missing.

17. Existing dev data will not contaminate validation.
    Evidence: PR-010 direct verification created real dev records, and future runs may add more.
    Could be false if the document library includes prior records, if titles collide, or if comparison/job lists include old data.
    Breakage if false: Codex verifies the wrong document/job/run or mistakes stale records for new PR-010A behavior.
    Plan change: deployed verification must create a unique validation run selector/title/metadata where supported and record exact document/job/run IDs produced in the current session.

18. Fix-forward through CI is an acceptable rollback model for this slice.
    Evidence: repository instructions forbid manual `cdk deploy` and manual AWS mutations.
    Could be false if a bad CloudFront/app deploy blocks all dev access and no rollback/fix-forward path is documented.
    Breakage if false: the dev app remains inaccessible while agents are barred from manual repair.
    Plan change: document a rollback/fix-forward path in the plan: revert or fix via a new PR, deploy through CI, and record failed deployment artifacts/status without manual AWS edits.

19. Same-origin `/api/*` is the right browser API path.
    Evidence: the story contract says CloudFront routes `/api/*` to the deployed Control API so browser traffic uses the deployed API through the dev app surface.
    Could be false if implementation uses the direct API Gateway `ControlApiUrl` from browser JavaScript, requiring API Gateway CORS and either exposing secrets or weakening protection.
    Breakage if false: PR-010A quietly reintroduces cross-origin browser API access, broad CORS, or direct API Gateway product routes as the app path.
    Plan change: make same-origin CloudFront `/api/*` the deployed app default. A direct browser `ControlApiUrl` path requires explicit documented proof that it is equally protected without browser-exposed secrets; otherwise it fails PR-010A.

20. Static routing fallback can be configured without hiding real errors.
    Evidence: static S3 plus CloudFront commonly needs either pre-exported routes or a client-side route fallback for deep links.
    Could be false if CloudFront custom error responses serve `index.html` for missing assets, unauthorized requests, or `/api/*` errors.
    Breakage if false: broken JavaScript/CSS, unauthorized requests, and API 404/500 errors look like a successful app shell, causing false deployed verification.
    Plan change: fallback behavior must be scoped only to product app routes. It must not apply to `/api/*`, static asset paths such as `/_next/*`, missing built assets, or unauthorized responses.

21. Static app assets will not accidentally contain product-forbidden or sensitive data.
    Evidence: current web code imports fixture histories with fixture model IDs, accepted/rejected runs, translated artifacts, and comparison data.
    Could be false if fixture modules remain imported by production bundles, if `demo-data` PDFs are copied into the static output, or if full controlled-document text appears in assets.
    Breakage if false: deployed app leaks fake histories or document content, and future agents may accept fixture behavior as product behavior.
    Plan change: add a production asset scan for fixture histories, fixture model IDs, hard-coded comparison IDs, raw PDFs, full controlled document text, PR-010 dev token, browser credential, and origin proof. Test-only fixture files may remain outside production bundles.

22. Cost and economics labels can stay honest after removing fixtures.
    Evidence: repository rules require cost displays to label their basis, and current web copy includes fixture-derived wording.
    Could be false if UI keeps labels like fixture rates or telemetry-derived estimates without actual telemetry, or if settings inputs imply price changes that are not persisted.
    Breakage if false: the app misrepresents economics, which is the core product purpose.
    Plan change: UI cost-basis labels must be sourced from persisted ledger/price-book state and honestly say price-book-estimated or no ledger data as appropriate. Settings/economics controls must be read-only or disabled unless backed by implemented API mutations.

23. Edge access checks can strip or avoid forwarding viewer credentials.
    Evidence: Basic Auth and signed-cookie style gates can cause browsers to send `Authorization` headers or cookies on same-origin `/api/*` fetches.
    Could be false if the edge gate validates credentials but forwards them to API Gateway/Control API anyway.
    Breakage if false: browser-gate credentials appear in origin logs, Lambda events, API Gateway logs, or downstream error evidence.
    Plan change: the edge gate and origin request policy must strip or avoid forwarding browser-gate credentials/cookies/`Authorization` before the Control API origin. Tests must inspect the forwarded request shape where feasible.

24. Origin proof is acceptable for a dev gate even if AWS distribution-read privileges can see it.
    Evidence: CloudFront custom origin header values are part of distribution configuration, so principals with sufficient CloudFront read permissions may be able to inspect them.
    Could be false if the proof is treated like a production-grade secret, or if broad IAM permissions make the proof widely readable.
    Breakage if false: someone with CloudFront read access can call API Gateway directly with the origin proof.
    Plan change: separate browser access credential, origin proof, and direct PR-010 API token; least-privilege IAM must limit who can read distribution configuration and secrets; deploy artifacts must not include proof values; rotation must be documented. The origin proof is a dev origin control, not production auth.

25. Existing CI/deploy validation can be extended for a frontend stack without weakening product-data protection.
    Evidence: `scripts/ci/validate-data-protection.mjs`, `scripts/ci/validate-workflow.mjs`, `scripts/ci/create-deploy-artifact.mjs`, and `.github/workflows/ci.yml` currently hard-code the PR-009/PR-010 stack set and artifact expectations.
    Could be false if adding a frontend stack causes validation to fail, or if someone works around that by placing static assets in the retained product artifact bucket.
    Breakage if false: PR-010A either cannot deploy through CI, or the deployment mixes immutable frontend assets with product artifacts and corrupts the data-protection model.
    Plan change: PR-010A must update the CI stack allowlist, deploy artifact schema, workflow validator, data-protection validator, smoke labels, and stack-output checks. The validator must classify the frontend bucket as a private non-product deploy-asset bucket and continue enforcing retain/versioning/no-auto-delete on the PR-010 artifact bucket.

26. The CloudFront `/api/*` origin can derive and forward the exact Control API route shape.
    Evidence: PR-010 exposes `ControlApiUrl`; CloudFront custom origins need correct domain, stage/path, and behavior path handling.
    Could be false if trailing slash handling, API Gateway stage paths, CloudFront origin path, or behavior path patterns strip or duplicate `/api`.
    Breakage if false: the deployed UI renders but all browser API calls 404, bypass auth unexpectedly, or hit the wrong route.
    Plan change: add infrastructure/unit assertions and deployed verification for at least `GET /api/price-books/current` through CloudFront, including proof that the origin receives the intended path and that `/api/*` errors are not rewritten to the static app shell.

27. PR-010A can remove or fully guard stale unauthenticated placeholder API configuration.
    Evidence: the repo still has configuration names and CI validation related to the earlier placeholder access mode.
    Could be false if `allowUnauthenticatedPlaceholderApi`, `CDK_ALLOW_UNAUTHENTICATED_PLACEHOLDER_API`, `DEV_UNAUTHENTICATED_PLACEHOLDER`, or old artifact access-mode strings remain reachable.
    Breakage if false: a future CI run or local context setting can silently re-enable unauthenticated product API access.
    Plan change: update config, workflow validation, deploy artifact validation, and tests so placeholder unauthenticated API mode is either removed or rejected for PR-010A and later deployed slices.

28. Static app configuration can be bound to the deployed environment without rebuilding or serving stale values.
    Evidence: the current web app has no deployed runtime configuration boundary, and static Next.js builds bake many `NEXT_PUBLIC_*` values at build time.
    Could be false if CI builds before stack outputs exist, if static assets include localhost or direct API Gateway URLs, if the rendered build identity differs from the artifact, or if a later sync leaves old config next to new JavaScript.
    Breakage if false: Codex verifies an app shell that points at the wrong API, wrong stage, stale build, or local fixture state.
    Plan change: PR-010A must choose an explicit configuration strategy, such as same-origin relative `/api/*` plus a non-secret generated runtime/build metadata file. Deterministic checks must scan bundles and config for localhost, wrong-stage endpoints, secrets, and stale schema values.

29. Frontend asset publication can be made atomic enough for deployment acceptance.
    Evidence: the current CI deploys CDK stacks and writes deploy artifacts, but it does not build, upload, validate, or invalidate frontend static assets.
    Could be false if CDK deploy succeeds while the frontend bucket is empty, partially uploaded, contains old `index.html`, or references missing hashed assets.
    Breakage if false: post-merge deployment is green but CloudFront serves 403s, stale HTML, or broken JavaScript.
    Plan change: choose one asset publication path and make it explicit: either include the static export as a CDK asset built before synth/deploy, or upload exactly the current build after stack outputs are available. In both cases CI must validate the asset manifest, cache headers, invalidation/readiness, and rendered build identity before the deploy artifact can claim success.

30. Controlled-PDF browser upload can be enabled without circular stack dependencies, broad CORS, or raw PDF bytes through APIs.
    Evidence: the PR-010 artifact bucket is owned by the storage stack, while the CloudFront frontend URL is produced by the new frontend stack. Repository rules also forbid raw PDFs through APIs.
    Could be false if adding artifact-bucket CORS from the frontend URL creates a CloudFormation dependency cycle, if the shortcut is to allow `*` or broad CloudFront origins, or if the shortcut is to upload the PDF through Control API/API Gateway/Lambda.
    Breakage if false: browser upload fails after deployment, CORS is widened into a cross-origin data exposure risk, or PR-010A violates the product architecture by passing raw PDF bytes through APIs.
    Plan change: PR-010A must resolve this sequencing explicitly. If narrow artifact-bucket CORS cannot be expressed safely without circular dependencies, use another proven non-API raw-byte upload path, such as a same-origin CloudFront-to-S3 upload route, or record a blocker. Do not use Control API as a raw PDF upload proxy.

31. Codex can retrieve the non-public values required for deployed verification without embedding them in artifacts.
    Evidence: PR-010 direct verification already depended on secret access, and PR-010A adds at least a browser access credential plus the existing direct API token path.
    Could be false if the credential is generated only inside edge code, stored only in CloudFormation configuration, omitted from documented secret outputs, or inaccessible to the verification role.
    Breakage if false: the deployment succeeds but Codex cannot directly use the protected app/API, so the slice cannot be accepted.
    Plan change: the access design must document secret names/ARNs or retrieval commands for the browser gate and direct API verification, prove required IAM read permissions before merge where possible, and keep secret values out of deploy artifacts, logs, screenshots, and `PLAN.md`.

32. CI deploy artifacts are stored separately from product workflow artifacts.
    Evidence: the workflow currently uses an `ARTIFACTS_BUCKET_NAME` secret for deploy artifacts, while the product storage stack outputs `ArtifactBucketName` for workflow PDFs and generated artifacts.
    Could be false if both names resolve to the same bucket or if the ambiguity causes future frontend assets, deploy artifacts, and workflow artifacts to share a namespace.
    Breakage if false: release evidence and product/economic evidence are co-mingled, retention rules become ambiguous, and asset scans can miss product data in CI evidence locations.
    Plan change: PR-010A validation must compare the deploy-artifact bucket with the product artifact bucket and fail if they are the same. Frontend assets, deploy artifacts, and product workflow artifacts must have separate buckets or explicitly separate, validated purposes.

33. Incomplete or failed UI states can be verified without manual database mutation.
    Evidence: the plan requires representative incomplete/failed API record-group verification, but PR-010 may not expose product APIs that intentionally create every broken state.
    Could be false if the only way to create such a state is a manual DynamoDB write, a hidden seed path, or a fake frontend fixture.
    Breakage if false: verification either violates the no-manual-AWS rule or reintroduces synthetic product behavior.
    Plan change: deployed verification should use naturally available API-supported incomplete states, such as nonexistent IDs, pre-run jobs, empty ledgers, invalid review attempts, or artifact-access errors. Deeper malformed record-group cases belong in component/API tests unless a real API path can produce them.

34. Dev access enforcement happens before CloudFront cache lookup for every protected behavior.
    Evidence: the plan requires CloudFront app/API access protection, but it has not yet selected the edge event phase or cache key behavior.
    Could be false if the access gate is implemented at origin-request time, if only the default behavior is gated, if 401/403 responses are cached incorrectly, or if authorized HTML/API responses can be reused for unauthenticated viewers.
    Breakage if false: unauthenticated users can receive cached app HTML or API responses even though direct origin access is protected.
    Plan change: the selected gate must run before cache lookup for static and `/api/*` behaviors, or use an equivalently proven cache-safe mechanism. Tests must prove an authenticated request cannot prime cache for an unauthenticated request, an unauthenticated denial cannot poison later authenticated access, and every behavior has the expected gate.

35. Browser storage, referrers, and client-side diagnostics will not leak credentials, presigned URLs, or document content.
    Evidence: the current app is fixture-backed and does not yet handle real browser credentials or presigned artifact URLs.
    Could be false if the implementation stores browser-gate credentials, direct API tokens, origin proofs, presigned URLs, raw PDF text, or full document content in `localStorage`, `sessionStorage`, IndexedDB, Cache Storage, query strings, visible DOM, error messages, crash payloads, or referrer headers.
    Breakage if false: a dev-only verification credential or short-lived artifact URL leaks through the browser even when CI/deploy artifacts are sanitized.
    Plan change: PR-010A must forbid client persistence of these values, set a conservative referrer policy, use `noreferrer`/equivalent behavior for artifact opens where applicable, and add tests/scans for storage API usage and sensitive URL/content exposure.

36. Telemetry and platform logs can be useful without capturing sensitive request details.
    Evidence: the Control API Lambda currently logs a sanitized route/status/request ID record, but PR-010A may add CloudFront, S3, API Gateway, or browser-network evidence.
    Could be false if CloudFront logging records cookies/query strings, API Gateway access logs include headers or full paths with signed query strings, browser traces save full presigned URLs, or CI smoke output prints protected targets with credentials.
    Breakage if false: the verification system itself becomes the place where credentials, signed artifact URLs, or document details are leaked.
    Plan change: logging/telemetry configuration must explicitly avoid cookies, auth headers, signed query strings, request bodies, and full presigned URLs. If a useful telemetry source cannot be configured safely, record it as unavailable rather than enabling unsafe logging.

37. Browser security headers can be added without breaking the static app or API flow.
    Evidence: PR-010A introduces a real browser surface for protected product data, but the current plan does not require security response headers.
    Could be false if CloudFront/S3/API responses omit basic headers or if an overly strict policy breaks static assets, icons, or artifact access.
    Breakage if false: protected dev pages are easier to embed, sniff, or leak referrers from, or the app breaks after deployment because headers were added without testing.
    Plan change: PR-010A must add and test a small, appropriate response-header policy for the deployed app, including at least referrer policy, frame denial, content type nosniff, and cache behavior for HTML/config. CSP may be added only if tested against the actual static app and artifact-open flow.

38. The deployed app will be usable as the future verification surface, not merely reachable.
    Evidence: future stories require Codex to verify behavior through the deployed app after merge, and PR-010A is the slice that turns the frontend into that surface.
    Could be false if the app technically loads but has broken navigation, inaccessible controls, clipped text, unusable mobile layout, missing loading/error/empty/disabled states, or console/network noise that makes direct product verification unreliable.
    Breakage if false: PR-011 and later slices may fall back to API-only verification or local assumptions even though the repo says deployed app use is required.
    Plan change: PR-010A must include a true manual product/visual audit of the deployed app on desktop and mobile for the impacted routes and states. Deterministic UI checks should cover accessible names, disabled states, loading/error/empty states, and critical navigation where practical, but they do not replace direct rendered-app inspection.

39. Future agents can discover and repeat the deployed verification workflow without secret leakage or stale instructions.
    Evidence: PR-010A creates the long-lived deployed frontend path that all later slices depend on.
    Could be false if the deploy artifact has the right data but no documented retrieval flow, if secret values rather than locators get copied into durable docs, if the story leaves instructions pointing at the wrong next task, or if future slices cannot tell which app URL/build is current.
    Breakage if false: later slices use localhost, direct API Gateway, API-only calls, stale CloudFront URLs, or unsafe evidence capture even though PR-010A technically deployed.
    Plan change: PR-010A must leave a non-secret handoff: where to find the latest deploy artifact, how to identify the current `FrontendUrl` and build identity, where to retrieve required verification credentials by locator only, how to redact evidence, and when to update next-task instructions. Do not mark PR-011 as next until PR-010A has actually merged, deployed, and been verified.

40. Any browser-upload fallback will preserve the no-raw-PDF-through-API rule.
    Evidence: earlier plan text allowed "API-mediated upload" as a CORS fallback, but repository architecture explicitly forbids raw PDF bytes through APIs.
    Could be false if implementation routes browser file bytes through Control API, API Gateway, Lambda, route handlers, or server actions to avoid S3 CORS or CloudFront/S3 upload complexity.
    Breakage if false: the product violates a non-negotiable architecture rule, increases API payload/logging/security risk, and teaches later slices to move artifact bytes through APIs.
    Plan change: remove API-mediated raw upload as an acceptable option. Valid PR-010A upload paths are direct S3 presigned browser upload with narrowly scoped CORS, a proven same-origin CloudFront-to-S3 raw-byte path that does not traverse Control API, or a recorded blocker.

41. CloudFront global resources can be added without violating the repository's `us-east-1` deployment rule.
    Evidence: the repo requires AWS deployment in `us-east-1`, while CloudFront is global and Lambda@Edge, if chosen, has region/versioning constraints.
    Could be false if edge code, secrets, logs, or supporting resources are created outside the intended region, if Lambda@Edge versioning/deletion blocks CI rollback, or if deploy artifacts fail to distinguish global CloudFront resources from regional origins and secrets.
    Breakage if false: CI deployment or rollback fails, compliance with repo-local region rules becomes ambiguous, or future agents cannot tell which regional resources back the global distribution.
    Plan change: PR-010A must document and test the regional/global boundary. Regional origins, buckets, secrets, logs, and API resources stay in `us-east-1`; CloudFront distribution and any required edge resources are explicitly identified as global/edge resources with deploy artifact fields and rollback constraints.

42. Static export and route-refresh tests will catch all server-only frontend behavior.
    Evidence: the app is currently a Next.js app, and PR-010A intends to serve it as static/client-rendered assets from S3 plus CloudFront.
    Could be false if production routes still use server-only APIs such as `redirect`, `headers`, `cookies`, server actions, route handlers, dynamic runtime config, framework image optimization, or ungenerated dynamic segments that static export or unit tests do not exercise.
    Breakage if false: the deployed app serves some routes but direct refresh, deep links, asset optimization, or runtime navigation fails after merge, pushing later slices back to local/API-only verification.
    Plan change: PR-010A must include a production route inventory and server-only feature scan for the web app. Unsupported server-only features must be removed, converted to client-side/static behavior, or treated as blockers; they must not be silently replaced with SSR hosting, Amplify, or Lambda hosting in this story.

43. Dev browser access protection will not create an unbounded public abuse or cost surface.
    Evidence: PR-010A exposes a public CloudFront distribution with a dev access gate, and earlier API throttling does not automatically protect static requests, edge auth attempts, or unauthenticated CloudFront `/api/*` attempts.
    Could be false if the browser gate has no rate limit, WAF/rate-based rule, cheap fail-closed path, or equivalent control, allowing repeated credential guessing, cache-busting, expensive origin attempts, or noisy logs.
    Breakage if false: a bad client or external actor can create avoidable CloudFront/Lambda@Edge/API origin cost, degrade dev verification, or make telemetry noisy enough that validation cannot be isolated.
    Plan change: PR-010A must add a bounded-abuse control for the CloudFront app and `/api/*` surface, such as WAF/rate-based rules or an equivalent low-cost edge throttle, plus deterministic and deployed checks proving unauthenticated bursts are denied cheaply and do not reach product behavior.

44. Any non-API raw-byte upload path will preserve PR-010 source-object constraints.
    Evidence: PR-010 controls upload keys, content type, size, metadata/checksum where available, and registration checks; a CloudFront-to-S3 fallback could bypass some of those constraints if it is treated as a generic S3 write proxy.
    Could be false if CloudFront or S3 behavior allows arbitrary keys, methods, content types, object overwrites, missing metadata, oversized objects, writes to the frontend bucket, or writes outside the PR-010 staging/source prefix.
    Breakage if false: the app can upload bytes but source-object integrity, artifact isolation, and later economics evidence are weakened.
    Plan change: direct S3 presigned upload remains preferred. If a CloudFront-to-S3 raw-byte path is used, it must preserve presigned constraints for method, key prefix, object identity, content type, size/checksum metadata where supported, and bucket separation. Tests must prove arbitrary writes and overwrites fail.

45. Frontend asset cleanup will not break cached clients, validation, or CI-only rollback/fix-forward.
    Evidence: PR-010A requires immutable/static frontend assets, cache headers, invalidation, and build identity checks, but deleting old hashed assets during sync can break clients still holding old HTML or make rollback harder.
    Could be false if CI uses destructive `sync --delete`, overwrites unversioned assets in place, removes prior hashed chunks immediately, or cannot serve a previous known-good build during a fix-forward.
    Breakage if false: deployed verification passes for a fresh browser but existing sessions or retry verification fail with missing chunks, and recovery requires manual S3/CloudFront edits that are forbidden.
    Plan change: publish assets under build-scoped or content-hashed paths, keep old hashed assets for at least a documented short retention window or previous successful build, treat HTML/runtime config as short-cache, and perform any cleanup only through CI after successful validation.

46. No service worker, offline cache, or browser Cache Storage layer will hide deployed state or retain protected data.
    Evidence: PR-010A turns the app into the direct verification surface, and future slices must trust browser-observed behavior after deployment.
    Could be false if a service worker, PWA plugin, Cache API helper, or custom fetch layer caches app shells, `/api/*` responses, artifact-access URLs, presigned URLs, product records, credentials, or stale build metadata.
    Breakage if false: Codex may verify stale data while believing it is using the merged deploy, protected artifact URLs or document content may persist in the browser, and later slices may debug false app/API behavior.
    Plan change: PR-010A must either prove no service worker/offline cache is registered in production or explicitly test that it excludes `/api/*`, artifact-access responses, signed URLs, credentials, raw PDF text, full document content, and build/runtime metadata that must stay fresh. Deployed verification must inspect service worker registration and Cache Storage where available.

47. Production source maps and build-debug artifacts will not expose secrets, fixture data, internal endpoints, or controlled document content.
    Evidence: static hosting can accidentally publish `.map` files, debug manifests, route metadata, or framework traces alongside production assets.
    Could be false if build configuration enables browser source maps, if static asset scans skip `.map` or debug files, or if bundled source contains fixture histories, dev token names, origin-proof values, full controlled-document text, raw PDFs, or direct API endpoints even when minified JavaScript looks clean.
    Breakage if false: CloudFront can expose source and embedded constants that were excluded from visible UI and minified bundle checks, undermining secret hygiene and fixture-removal evidence.
    Plan change: disable public production source maps/build-debug assets unless there is a documented need. If any are deployed, asset scans and deployed checks must include them and prove they contain no protected values, fixture histories, raw PDFs, full controlled document text, browser credentials, direct API tokens, origin-proof values, localhost/wrong-stage endpoints, or stale deploy artifact values.

## Expected Outcomes

- After merge to the target branch, normal CI deploys the frontend hosting stack and Control API changes without manual `cdk deploy`.
- The deploy artifact for the merged SHA includes the CloudFront app URL, relevant stack/resource identifiers, API routing/base URL details, and access-protection mode.
- The app URL, API URL, AWS account, region, stage, and workspace used during verification match the current deploy artifact; localhost, fixture JSON, wrong-stage, wrong-account, and stale endpoints do not satisfy verification.
- Unauthenticated browser requests to the CloudFront app are blocked by the dev access gate.
- Authenticated browser requests load the rendered app from CloudFront.
- Unauthenticated CloudFront `/api/*` requests are blocked before the origin proof is accepted by the Control API.
- Browser JavaScript does not contain the PR-010 dev API token or reusable origin proof.
- `/api/*` calls from the deployed app reach the persistent Control API through CloudFront.
- Direct Control API requests without the PR-010 dev token or CloudFront origin proof still fail.
- The static app uses same-origin relative API calls and a non-secret build/runtime metadata strategy. It does not bake localhost, wrong-stage, direct unprotected API Gateway endpoints, secrets, or stale artifact values into production bundles.
- CI publishes exactly the current frontend build, validates the expected asset manifest and cache headers, invalidates/waits when needed, and refuses to create a success deploy artifact if CloudFront would serve missing, partial, or stale assets.
- The app uses persisted PR-010 API behavior for document registration, inspection placeholder, price book read, V1 job creation, run placeholder creation, timeline, ledger, economics, artifact download URL issuance, and invalid review handling.
- V2 and V3 actions remain unavailable or honestly labeled as not implemented.
- Job creation is unavailable or rejected until a document is `READY`.
- Incomplete or failed API record groups render blocked, incomplete, empty, or error states. They must not appear as completed timelines, accepted economics, verified outcomes, artifact success, or comparison success.
- Reviewer-visible artifact access goes through the protected Control API artifact route and short-lived private artifact URLs, never public S3, bundled fixtures, localhost files, or raw PDF JSON payloads.
- Browser evidence, CI artifacts, and this plan contain sanitized proof only, not cookies, auth headers, full presigned URLs, signed query strings, raw artifact bytes, or full document text.
- Browser upload of the controlled PDF works from the deployed app through direct S3 presigned upload with narrowly scoped CORS or another proven non-API raw-byte path, such as same-origin CloudFront-to-S3 upload. Raw PDF bytes never pass through Control API, API Gateway, Lambda, route handlers, or server actions.
- If narrow artifact-bucket CORS cannot be safely represented because of stack dependency order, PR-010A uses another proven non-API raw-byte upload path or records a blocker. It must not proxy raw PDF bytes through APIs.
- Frontend static assets are stored in a dedicated private hosting bucket, not the product artifact bucket. Data-protection validation distinguishes product data resources from frontend deploy assets without weakening retention/versioning protection for product artifacts.
- CI deploy artifacts are not written into the product workflow artifact bucket.
- The rendered app exposes a non-secret build identity that matches the deploy artifact and merged SHA, so stale CloudFront/S3 assets cannot satisfy verification.
- Refreshing deep links for product records works in the static deployment strategy.
- The deployed app calls the Control API through same-origin CloudFront `/api/*` unless an explicitly documented equally protected alternative is chosen.
- Static route fallback does not mask `/api/*` failures, unauthorized requests, missing `/_next/*` assets, or missing built files as a successful app shell.
- Production static assets do not contain fixture histories, fixture model IDs, hard-coded comparison IDs, raw PDFs, full controlled document text, dev access credentials, or origin proof values.
- Cost and settings surfaces use honest persisted-data labels. They do not claim fixture rates, telemetry-derived estimates, or editable persisted settings unless those behaviors exist.
- Economics displays are based on `LedgerItem` records, not logs.
- No product-facing fake histories remain.
- CI scripts and artifacts are PR-010A-aware: expected stacks include the frontend stack, artifact schema identifies PR-010A, frontend outputs are required, stale PR-009/PR-010 smoke labels are updated, and placeholder unauthenticated API modes are rejected.
- Browser-gate and direct API verification credential retrieval paths are documented by secret name/ARN or equivalent non-secret locator, and Codex can use those paths after deployment without storing secret values in durable evidence.
- Incomplete-state deployed verification uses real API-supported states, not manual DynamoDB edits, hidden seed endpoints, or fixture-only product behavior.
- CloudFront access enforcement is cache-safe: protected static routes and `/api/*` are gated before cache lookup or by an equivalently proven mechanism, and auth denials/successes cannot be replayed to the wrong viewer.
- Browser storage, referrers, diagnostics, and DOM output do not persist or expose browser-gate credentials, direct API tokens, origin proofs, presigned URLs, signed query strings, raw PDF text, or full document content.
- Telemetry/logging sources used for PR-010A are explicitly configured or constrained so they do not capture cookies, auth headers, signed query strings, request bodies, full presigned URLs, or unnecessary document content.
- The deployed app includes a tested minimal security response-header policy appropriate for a protected static app.
- The deployed app passes a direct desktop and mobile product/visual audit for the PR-010A routes and states, including navigation, layout, loading, empty, error, disabled, blocked, and not-yet-implemented states.
- Future slices have a non-secret deployed-verification handoff that points to deploy artifact retrieval, current app URL/build identity, credential locators, direct-use procedure, and redaction rules without claiming PR-010A is complete before post-merge verification.
- Deploy artifacts and infrastructure tests distinguish global CloudFront/edge resources from `us-east-1` regional origins, buckets, secrets, logs, and API resources.
- Static export readiness is proven by a route inventory and server-only feature scan, not just by the home page rendering.
- Public CloudFront access has bounded-abuse controls for unauthenticated static and `/api/*` requests; denial paths are cheap and do not reach product behavior.
- Any non-API raw-byte upload path preserves PR-010 source-object constraints and cannot write arbitrary keys, overwrite source evidence, write to the frontend bucket, or bypass content/size/metadata constraints.
- Frontend asset publication keeps current and recently referenced hashed assets coherent so cached HTML, deployed verification retries, and CI-only fix-forward are not broken by premature cleanup.
- No service worker, offline cache, or browser Cache Storage layer serves stale deployed state or retains protected API responses, artifact URLs, credentials, product records, raw PDF text, or document content.
- Production source maps and build-debug artifacts are absent by default, or are scanned and proven free of secrets, fixture histories, internal endpoints, raw PDFs, full document text, and origin-proof values.

Forbidden outcomes:

- No replay, synthetic-run, live-capture, recording, or presentation mode appears in code, UI, config, or tests except as forbidden-term assertions.
- No hard-coded model IDs or prices.
- No raw PDF bytes passed through APIs.
- No product behavior implemented by local fixture histories.
- No localhost, fixture file, wrong-stage, wrong-account, or stale endpoint can be used as deployed verification.
- No full presigned URLs, signed query strings, session cookies, auth headers, raw PDF bytes, or full document text are stored in evidence.
- No production static asset may include fixture histories, fixture model IDs, raw PDFs, full controlled document text, or hard-coded fake comparison IDs.
- No frontend deploy asset may be stored in the product artifact bucket or use product artifact retention semantics as a workaround for missing hosting validation.
- No CI deploy artifact bucket may be the same bucket as the product workflow artifact bucket.
- No SPA/static route fallback may hide API errors, auth failures, or missing static assets.
- No cost display may claim telemetry-derived or fixture-derived economics unless that basis is actually implemented and sourced from persisted records.
- No manual AWS resource mutation.
- No stale PR-009/PR-010 deploy artifact schema, stack allowlist, CI validator, or smoke label can omit the PR-010A frontend stack.
- No unauthenticated placeholder API mode, CDK context, workflow env, deploy artifact value, or stale `allowUnauthenticatedPlaceholderApi` path can be used for PR-010A.
- No production bundle or runtime config may include localhost, wrong-stage endpoints, direct unprotected API Gateway product routes, browser credentials, direct API tokens, origin-proof values, or stale deploy artifact values.
- No broad `*` S3 CORS, broad CloudFront wildcard CORS, or circular-dependency workaround is acceptable for browser upload.
- No Control API, API Gateway, Lambda, route handler, or server action may proxy raw PDF bytes as a browser-upload workaround.
- No Next.js server-only runtime behavior may be required by the deployed static app routes.
- No unbounded public CloudFront abuse surface is acceptable for the dev browser gate or unauthenticated `/api/*` attempts.
- No non-API upload fallback may allow arbitrary S3 writes, product artifact overwrites, writes to the frontend hosting bucket, or bypass PR-010 source-object constraints.
- No frontend asset publication step may delete still-referenced hashed assets or require manual S3/CloudFront edits for rollback/fix-forward.
- No service worker, offline cache, or browser Cache Storage behavior may cache `/api/*` responses, artifact-access responses, signed URLs, credentials, raw PDF text, full document content, or stale build/runtime metadata.
- No production source map, debug manifest, route metadata, framework trace, or build-debug asset may expose fixture histories, model IDs, fake comparison IDs, raw PDFs, full controlled document text, browser credentials, direct API tokens, origin-proof values, localhost/wrong-stage endpoints, or stale deploy artifact values.
- No manual database mutation, hidden seed endpoint, or product fixture may be used to create deployed incomplete-state evidence.
- No access-control design may rely on origin-request-only checks or cache behavior that allows authenticated responses, unauthenticated denials, app HTML, or API responses to be served to the wrong viewer.
- No browser storage, query string, referrer, visible DOM, error message, crash payload, browser trace, CloudFront log, S3 log, API Gateway log, Lambda log, CI log, or deploy artifact may contain browser-gate credentials, direct API tokens, origin-proof values, cookies, auth headers, full presigned URLs, signed query strings, raw PDF text, or full document content.
- No later slice may have to infer deployed-verification mechanics from secrets, screenshots, local memory, or stale PR-010A planning notes.

## Product Design

The deployed app should be an operational product surface, not a landing page. The first screen should put the document/job workflow in front of the user.

Expected user flow:

- A dev user opens the CloudFront app URL and passes the dev browser access gate.
- The document library shows real persisted documents from the Control API, or an honest empty state if none exist.
- Upload/register lets the user add the controlled Spanish PDF fixture through the deployed API and S3 presign path.
- The document detail view shows document status and controlled metadata from the API.
- Creating a job before inspection is blocked in the UI or rejected by the API without creating a `TranslationJob`.
- Inspection is an explicit PR-010 placeholder that transitions the controlled fixture to `READY`; unsupported files remain honestly unsupported.
- V1 job creation is available only for `READY` documents.
- V2 and V3 creation are blocked as not implemented.
- Starting a run creates the PR-010 placeholder `CREATED` run and shows persisted timeline/economics state.
- Timeline, ledger, and economics render persisted API data. Empty ledger means zero consumed cost and no verified outcome, not fake success.
- Artifact viewing uses the API download URL route for source artifacts.
- Review actions on non-reviewable runs show the API validation failure instead of pretending review succeeded.
- Incomplete multi-record states, such as a job without runs, a run without evaluation, an empty ledger, or an artifact access error, are explicit states and do not look like successful translated-output evidence.
- Direct navigation and browser refresh for document, job, and run routes preserve the same API-backed state rather than falling back to a fixture or static error page.
- Settings/economics screens show the active persisted price book and honest read-only/not-implemented states for mutations not backed by PR-010 APIs.
- The UI remains usable on desktop and mobile for the routes exercised by PR-010A. Text must not overlap, controls must remain discoverable and operable, and loading, empty, error, disabled, blocked, and not-yet-implemented states must look like product states rather than test scaffolding.

The UI must preserve the product model:

- `TranslationJob` is the business unit.
- `Run` is a technical attempt.
- `LedgerItem` rows are the economics source of truth.
- Human review remains a costed event when review behavior is later implemented.
- Automated evaluation is not acceptance.

## Deterministic Checks

Required checks before PR creation:

- `pnpm install`
- `pnpm typecheck`
- `pnpm test`
- `pnpm lint`
- `pnpm cdk synth`
- frontend production build/static export command used by CI

Required test coverage:

- Frontend API client validates response shapes and handles API errors.
- UI tests prove empty, loading, success, and error states for the supported PR-010A flows.
- UI tests prove pre-inspection job creation is blocked or surfaces the API rejection without creating a job.
- UI tests prove V2/V3 are not implemented and do not create fake histories.
- Tests prove no product-facing fixture histories are rendered as accepted/rejected runs.
- Browser-level, route-level, or component tests prove deployed-product screens do not depend on fixture histories, bundled fixture JSON, localhost files, or hard-coded comparison IDs.
- Browser/upload tests use the repository-controlled MVP PDF fixture, not ad hoc local files.
- S3 CORS tests or browser-level upload checks prove the controlled fixture upload works from the deployed CloudFront origin and that allowed origins, methods, and headers are scoped to the PR-010A flow.
- Artifact-view tests prove source artifacts open through the PR-010 private artifact-access route, not public S3 URLs, fixture files, localhost files, or raw PDF JSON payloads.
- Static export/deep-link tests prove document, job, and run routes either export valid static shells or are served by a CloudFront fallback that preserves client-side routing without masking missing assets, missing `/_next/*` files, `/api/*` responses, or unauthorized responses.
- Static-export readiness checks scan the production web app route inventory for unsupported server-only APIs and features, including `redirect`, `headers`, `cookies`, server actions, route handlers, dynamic runtime config, ungenerated dynamic segments, and framework image optimization that cannot work from S3 plus CloudFront static hosting.
- Environment-scoping tests prove the deployed app uses same-origin deployed `/api/*` by default and cannot satisfy validation with localhost, fixture files, wrong-stage, wrong-account, stale API endpoints, or direct browser API Gateway calls unless a documented equally protected exception is intentionally chosen.
- Static config tests prove production bundles and generated runtime/build metadata use same-origin relative API paths, contain the current build identity, and exclude localhost, wrong-stage endpoints, direct unprotected API Gateway product routes, browser credentials, direct API tokens, origin-proof values, and stale deploy artifact values.
- Evidence-redaction checks or review checks prove screenshots, console/network logs, saved traces, deploy artifacts, and `PLAN.md` evidence do not expose session cookies, auth headers, full presigned URLs, signed query strings, raw artifact bytes, or unnecessary full document text.
- UI tests prove incomplete or failed multi-record API states render blocked/incomplete/error states rather than normal completed timelines, artifact links, accepted economics, verified outcomes, or comparison rows.
- UI tests prove settings/economics surfaces do not claim fixture-derived or telemetry-derived economics and do not offer fake editable persisted settings.
- UI or browser checks prove critical controls have usable labels, disabled states are visible and enforced, loading/error/empty states render without layout overlap, and the PR-010A routes are usable at representative desktop and mobile viewport sizes.
- Control API auth tests prove direct token access still works, direct unauthenticated access fails, CloudFront origin-proof access works, and spoofed/duplicate/empty proof headers fail according to the chosen contract.
- Access tests prove unauthenticated CloudFront `/api/*` requests are denied and cannot reach accepted Control API product behavior just because CloudFront would inject an origin proof.
- Cache-safety access tests prove an authenticated request cannot prime CloudFront cache for an unauthenticated static or `/api/*` request, unauthenticated denial responses do not poison later authenticated access, and every CloudFront behavior runs the access gate or an equivalently proven cache-safe mechanism.
- Abuse-boundary checks prove unauthenticated CloudFront app and `/api/*` bursts are denied through a bounded low-cost path, do not reach product behavior, and do not produce sensitive logs.
- Infrastructure tests or synth assertions prove the static bucket is private, CloudFront uses OAC with signed requests for static assets, `/api/*` routes to the API origin, default behavior routes to static assets, static route fallback/deep-link behavior is intentional, and deploy outputs/artifacts include required frontend fields.
- Infrastructure tests prove the frontend static bucket is a dedicated private deploy-asset bucket and that frontend assets are not written to the PR-010 product artifact bucket.
- Path-routing tests or assertions prove CloudFront forwards `/api/price-books/current` and other `/api/*` routes to the intended Control API path without stripping or duplicating `/api` or applying the static fallback.
- Infrastructure tests prove `/api/*` uses no broad caching of product API responses and does not forward viewer browser-gate credentials, cookies, `Authorization`, or unnecessary headers to the Control API.
- Edge/origin-request tests or assertions prove browser-gate credentials/cookies/`Authorization` are stripped or not forwarded to the API origin after edge validation.
- Asset-publication checks prove CI builds the frontend at the right point in the workflow, publishes the expected manifest to the frontend bucket, sets correct cache headers, and fails if required HTML/JS/CSS assets are missing or stale.
- CORS/dependency checks prove controlled-PDF upload uses narrowly scoped artifact-bucket CORS without circular stack dependencies, or another proven non-API raw-byte path such as same-origin CloudFront-to-S3 upload; broad wildcard CORS and raw-PDF API proxying fail validation.
- Upload-boundary checks prove any non-API raw-byte upload path preserves method, key prefix, object identity, content type, size/checksum metadata where supported, bucket separation, and overwrite protection from PR-010.
- CI/deploy-artifact validation proves `.github/workflows/ci.yml`, `scripts/ci/validate-workflow.mjs`, `scripts/ci/validate-data-protection.mjs`, `scripts/ci/create-deploy-artifact.mjs`, and smoke checks are PR-010A-aware: expected stacks include the frontend stack, the deploy artifact schema/version reflects PR-010A, frontend outputs are required before artifact upload, the frontend bucket is classified separately from product data, and stale PR-009/PR-010 labels cannot pass.
- Deploy-artifact validation proves the CI deploy artifact bucket is distinct from the product workflow artifact bucket.
- Secret-retrieval checks or documented preflight evidence prove Codex can retrieve the browser-gate credential and direct API verification token through approved secret locators after deployment; secret values must not appear in test output.
- Configuration tests prove `allowUnauthenticatedPlaceholderApi`, `CDK_ALLOW_UNAUTHENTICATED_PLACEHOLDER_API`, `DEV_UNAUTHENTICATED_PLACEHOLDER`, or equivalent stale placeholder paths cannot enable deployed unauthenticated product API access.
- Browser-storage and referrer-policy checks prove the app does not write protected credentials, presigned URLs, raw document text, or full document content to browser persistence APIs, URL query strings, visible copy, referrer headers, or saved traces.
- Logging/telemetry configuration checks prove CloudFront/S3/API Gateway/Lambda/CI evidence does not record cookies, auth headers, signed query strings, request bodies, full presigned URLs, or unnecessary document content. Unsafe telemetry sources must remain disabled or be recorded as unavailable.
- Response-header checks prove the deployed app returns tested security headers for static app/config responses without breaking app load, API calls, or artifact opens.
- Service-worker/offline-cache checks prove the production app registers no service worker/offline cache, or that any intentionally registered cache excludes `/api/*`, artifact-access responses, signed URLs, credentials, product records, raw PDF text, full document content, and freshness-critical build/runtime metadata.
- CI/deploy validation proves the rendered frontend build identity, deploy artifact commit SHA, CloudFront distribution, and uploaded asset manifest agree.
- Asset-retention checks prove CI does not delete still-referenced hashed assets, keeps enough previous-build assets for validation retries or CI-only fix-forward, and treats HTML/runtime config as short-cache.
- CI/IaC checks or documented prerequisites prove the deployment role can manage the required CloudFront, S3 hosting/CORS/bucket-policy, edge-code, invalidation, and IAM resources; missing permissions are a blocker, not an invitation for manual AWS changes.
- Region-boundary checks prove regional origins, buckets, secrets, logs, and API resources remain in `us-east-1`, while CloudFront distribution and any required edge resources are explicitly identified as global/edge resources in deploy artifacts.
- A static artifact scan proves production browser bundles/static output do not include fixture histories, fixture model IDs, hard-coded comparison IDs, raw PDFs, full controlled document text, the PR-010 dev API token, browser access credential, or origin proof.
- Source-map and build-debug asset scans prove public `.map` files, debug manifests, route metadata, framework traces, and other generated debug assets are absent by default or contain no fixture histories, model IDs, fake comparison IDs, raw PDFs, full controlled document text, browser credentials, direct API tokens, origin-proof values, localhost/wrong-stage endpoints, or stale deploy artifact values.
- Forbidden-term checks continue to fail on replay/synthetic/live-capture/recording/presentation product modes.
- Handoff documentation or story-contract checks prove future slices can find the latest deploy artifact, current `FrontendUrl`, build identity, credential locators, verification procedure, and evidence-redaction rules without storing secret values.

## Deployed Verification

Deployed verification is mandatory for PR-010A because the slice creates the user-facing deployed app path.

Verification environment:

- AWS dev environment in `us-east-1`.
- Post-merge CI deployment of the merged SHA only.
- S3 plus CloudFront frontend hosting.
- Persistent Control API from PR-010.

Required direct-use evidence after merge and CI deploy:

- Capture the merged SHA and CI deployment run ID.
- Retrieve the deploy artifact and record the CloudFront app URL, hosting stack/resource identifiers, configured API routing, and access-protection mode.
- Verify the deploy artifact AWS account ID, region, stage, `FrontendUrl`, and `ControlApiUrl` match the browser URL and API endpoint used for validation.
- Open the CloudFront app URL without credentials and verify access is blocked.
- Call CloudFront `/api/price-books/current` without browser credentials and verify it is blocked before it can use CloudFront origin proof to access product data.
- Verify repeated unauthenticated app and `/api/*` attempts are blocked through the documented bounded-abuse mechanism and do not reach product behavior.
- Open the CloudFront app URL with the dev browser credential and verify the app renders.
- Re-check the unauthenticated app URL and unauthenticated CloudFront `/api/price-books/current` after authorized app/API use to prove authorized responses were not cached for anonymous viewers.
- Re-check authorized app/API access after unauthenticated denials to prove denial responses did not poison authenticated access.
- Verify the rendered app build identity matches the deploy artifact merged SHA/build ID.
- Verify production bundle/runtime metadata uses same-origin `/api/*`, not localhost, wrong-stage endpoints, stale direct API Gateway endpoints, or browser-visible secrets.
- Verify the deployed app's storage APIs, referrer behavior, console output, and saved evidence do not expose browser credentials, direct API tokens, origin proofs, presigned URLs, signed query strings, raw document text, or full document content.
- Verify no service worker/offline cache is registered, or any intentional registration excludes `/api/*`, artifact-access responses, signed URLs, credentials, product records, raw document text, full document content, and freshness-critical build/runtime metadata.
- Verify public source maps and build-debug artifacts are absent by default, or inspect them and prove they are sanitized.
- Verify the deployed app returns the expected minimal security response headers on app/config responses.
- Check browser console and network failures for the exercised flow.
- Perform a manual product/visual audit of the deployed app on desktop and mobile for the exercised PR-010A routes. Verify navigation, layout, copy, controls, loading, empty, error, disabled, blocked, and not-yet-implemented states are usable and do not overlap or imply completed workflow behavior.
- Verify browser network traffic targets same-origin deployed CloudFront `/api/*`, unless a documented equally protected alternative was intentionally chosen; it must not target localhost, fixture files, wrong-stage, wrong-account, stale endpoints, or direct unprotected API Gateway product routes.
- Register/upload the controlled Spanish PDF fixture through the rendered app.
- If direct S3 browser upload is used, verify the CORS preflight is scoped to the deployed CloudFront origin and required headers only. If another non-API raw-byte upload path is used, verify raw PDF bytes do not traverse Control API, API Gateway, Lambda, route handlers, or server actions.
- For the selected upload path, verify arbitrary-key, wrong-content-type, oversize, missing-required-metadata, and overwrite attempts fail without creating registered product artifacts.
- Attempt to create a job before inspection and verify it is blocked or rejected without creating a `TranslationJob`.
- Inspect the document through the rendered app and verify it reaches `READY`.
- Verify the document library/detail views reflect persisted API state after refresh.
- Open or refresh a document detail deep link and verify the static deployment serves the app and reloads API-backed state.
- Read the active price book through the rendered app.
- Create a V1 job through the rendered app.
- Open or refresh the created job deep link and verify the static deployment serves the app and reloads API-backed state.
- Attempt V2 or V3 and verify the app/API honestly report not implemented.
- Create the PR-010 placeholder run through the rendered app.
- Open or refresh the created run deep link and verify the static deployment serves the app and reloads API-backed state.
- Open timeline, ledger, and economics sections and verify they reflect persisted API data with zero ledger cost and no verified outcome for the placeholder run.
- Open settings/economics surfaces and verify cost-basis copy is honest, persisted-data-based, and not fixture-derived or falsely telemetry-derived.
- Open or request the source artifact through the app and verify the API issues a short-lived private artifact URL through the artifact-access route. Record only sanitized proof, not the full URL or signed query string.
- Attempt an invalid review action and verify the app surfaces the API validation failure.
- Verify the invalid review attempt creates no `ReviewDecision` and no `HUMAN_REVIEW` ledger row.
- Verify at least one representative incomplete/failed API record-group state renders an explicit blocked/incomplete/error state and does not show accepted economics, verified outcome, artifact success, or comparison success.
- Use only API-supported deployed states for incomplete/failed-state verification, such as nonexistent IDs, pre-run jobs, empty ledgers, invalid review attempts, or artifact-access errors. Do not manually edit DynamoDB or use hidden seed paths.
- Refresh the browser and verify state persists through the API rather than fixtures.
- Directly call the Control API without dev token and without CloudFront origin proof and verify it is rejected.
- Directly call the Control API with the PR-010 dev token and verify it still works for operator/API verification.
- Confirm the non-secret handoff for future slices identifies deploy artifact retrieval, current `FrontendUrl`, rendered build identity, credential locators, direct-use verification steps, and evidence-redaction rules. If next-task instructions are updated, do so only after PR-010A has merged, deployed, and been verified.

## Telemetry Verification

Selectors:

- merged commit SHA
- CI deploy run ID
- CloudFront distribution ID
- Control API request IDs
- validation document ID
- validation job ID
- validation run ID

Required signals when queryable:

- CloudFront requests for app assets and `/api/*` during the validation run.
- blocked unauthenticated CloudFront `/api/*` request during access verification.
- rendered build identity request or app-displayed build identity matching the deploy artifact.
- Control API requests for price book, document registration, inspection, job creation, run creation, artifact download URL, and invalid review attempt.
- Lambda logs or metrics for the same validation request path.
- API Gateway access logs or execution metrics when available.
- Environment/workspace evidence showing the rendered app and API requests resolve to the deploy artifact's stage, region, AWS account, and workspace.

Forbidden signals:

- 5xx responses during the happy path.
- successful unauthenticated direct Control API calls.
- a `TranslationJob` write for the pre-inspection job creation attempt.
- a `ReviewDecision` or `HUMAN_REVIEW` ledger write for the invalid review attempt.
- a successful unauthenticated CloudFront `/api/*` product response.
- repeated unauthenticated CloudFront app or `/api/*` attempts reaching product behavior, expensive origin paths, or sensitive logs instead of the bounded-abuse control.
- app requests to localhost, fixture JSON, direct unprotected API Gateway product routes, wrong-stage endpoints, wrong-account endpoints, or stale endpoints during deployed verification.
- frontend display that treats an incomplete document/job/run/stage/review/economics record group as a successful product outcome.
- frontend display claiming fixture-derived rates, fake editable settings, or telemetry-derived economics without actual telemetry-backed basis.
- browser bundle or logs containing the PR-010 dev API token, browser credential, or origin proof.
- browser evidence containing session cookies, auth headers, full presigned URLs, signed query strings, raw PDF bytes, or unnecessary full document text.
- CloudFront, S3, API Gateway, Lambda, browser, or CI logs containing cookies, auth headers, signed query strings, full presigned URLs, request bodies, raw PDF text, or full document content.
- service workers, browser caches, or Cache Storage entries containing protected API responses, artifact URLs, signed URLs, credentials, raw PDF text, full document content, product records, or stale build/runtime metadata.
- public source maps or build-debug assets containing fixture histories, model IDs, fake comparison IDs, raw PDFs, full controlled document text, browser credentials, direct API tokens, origin-proof values, localhost/wrong-stage endpoints, or stale deploy artifact values.
- authenticated CloudFront app or `/api/*` responses served to an unauthenticated viewer after cache priming.
- unauthenticated denial responses served to an authenticated viewer after denial cache priming.
- product-facing replay/synthetic/live-capture/recording/presentation mode paths.

Budgets:

- App shell loads successfully through CloudFront without asset failures.
- API happy-path calls return non-5xx responses.
- Validation run has no unhandled browser console errors attributable to this slice.

If telemetry cannot be isolated or queried, record the exact blocker in this file and report it. Do not claim telemetry verification succeeded.

## Implementation Steps

1. Open branch `codex/pr-010a-deployed-frontend-access`.
   Done when the branch is created from current `main`, PR-010A is the active plan, and no application implementation has started before plan review.

2. Resolve the PR-010A design gates.
   Done when the chosen CloudFront browser gate, same-origin `/api/*` routing, API cache/header policy, origin-proof mechanism, credential lifecycle, rotation path, IAM visibility constraints, verification credential retrieval path, bounded-abuse control, static route/export strategy, upload path, asset publication/retention strategy, service-worker/offline-cache policy, source-map/build-debug artifact policy, global-versus-`us-east-1` resource boundary, and threat model are documented, synthable, and proven not to leak reusable secrets into browser bundles, checked-in files, synthesized templates/CDK assemblies where avoidable, deploy artifacts, stack outputs, routine logs, browser storage, referrers, browser caches, source maps, debug assets, or saved traces. The design must protect unauthenticated CloudFront `/api/*` calls, avoid broad CORS, run before cache lookup or be equivalently cache-safe for every protected behavior, and must strip or avoid forwarding viewer browser-gate credentials, cookies, `Authorization`, or unnecessary headers to the Control API. If any design gate cannot be proven, stop and revise the story before implementation.

3. Add frontend hosting infrastructure.
   Done when CDK defines a dedicated private S3 static hosting bucket with OAC that is separate from the PR-010 artifact bucket, CloudFront distribution, tested response-header policy, bounded-abuse controls for unauthenticated app/API attempts, intentional static route/deep-link behavior whose fallback does not mask API/auth/static-asset errors, narrow S3 CORS derived from the deployed `FrontendUrl` or another proven non-API raw-byte upload path without circular stack dependencies, exact `/api/*` API origin behavior with API caching disabled and no path stripping/duplication, explicit global-versus-`us-east-1` resource outputs, and least-privilege deploy permissions.

4. Add frontend build and deployment wiring.
   Done when CI builds the static app at the correct point relative to synth/deploy, deploys it only after merge, publishes exactly that build through the chosen CDK asset or S3 upload path, validates the asset manifest, uploads static assets with cache headers that avoid stale HTML/build identity, keeps still-referenced hashed assets long enough for validation retries and CI-only fix-forward, excludes or sanitizes source maps/build-debug artifacts, prevents service-worker/offline-cache drift from hiding deployed freshness, invalidates CloudFront when needed, waits for distribution/invalidation readiness where required, updates `EXPECTED_STACKS`, updates workflow/data-protection/deploy-artifact/smoke validators for the frontend stack and separate frontend bucket, proves the deploy artifact bucket is separate from the product artifact bucket, and writes a PR-010A deploy artifact that requires frontend outputs and build identity.

5. Extend Control API dev authorization for CloudFront-origin browser traffic.
   Done when the API accepts the selected origin proof for CloudFront `/api/*` traffic, keeps PR-010 token auth for direct operator/API calls, rejects missing, malformed, duplicate, or spoofed credentials according to tests, and removes or hard-fails stale unauthenticated placeholder API configuration for deployed PR-010A behavior.

6. Create the frontend API client and runtime configuration.
   Done when the app uses same-origin relative `/api/*` calls in deployed mode, has a non-secret build/runtime metadata strategy, has schema-aware error handling, does not expose tokens in browser code or generated config, and still supports local development with an explicit local API configuration that cannot satisfy deployed verification.

7. Replace product-facing fixture state with API-backed UI flows.
   Done when document library/detail, upload/register, inspection placeholder, price book read, V1 job creation, run placeholder creation, timeline, ledger, economics, artifact URL, and invalid review handling use the persistent API, and product-facing hard-coded fixture navigation such as `/compare/cmp_refunds` is removed or replaced with API-backed state.

8. Preserve honest non-implemented states.
   Done when V2/V3 and later workflow actions remain blocked or clearly not implemented, incomplete record groups render as incomplete/error states, settings/economics surfaces do not fake persisted mutations or cost bases, and no fake histories or seeded product-facing successes remain.

9. Add and run deterministic checks.
   Done when tests, typecheck, lint, synth, frontend build/export, auth/cache-safety checks, infrastructure assertions, S3 CORS/deep-link checks, route fallback checks, deploy artifact checks, logging/redaction checks, browser-storage/referrer/cache checks, service-worker/offline-cache checks, response-header checks, cost-label checks, UI state/responsive/accessibility checks, handoff-documentation checks, source-map/build-debug scans, and production asset/bundle scans pass locally and in CI.

10. Open the PR and complete code review.
    Done when review findings are addressed or explicitly documented as blockers.

11. Merge and verify post-merge deployment.
    Done when the merged SHA deploys through normal CI, the deploy artifact is captured, rendered build identity matches the artifact, Codex directly uses the deployed rendered app for the required flow, performs the required desktop/mobile product and visual audit, verifies the future-slice handoff, and records evidence here.

12. Complete final review.
    Done when `PLAN.md` contains final evidence, deterministic checks are green, deployed verification is complete, telemetry verification is complete or precisely blocked, future-slice deployed-verification handoff is present without secrets, and the work is merged.

13. Fix forward or roll back only through CI if deployment breaks dev access.
    Done when any failed deployment has a recorded failure mode and recovery PR, or when no rollback is needed. Do not manually mutate AWS resources or run local deploys to recover.

## Risks And Constraints

- Secret leakage risk is the highest risk. Browser credentials, PR-010 dev API token, and origin proof must not appear in browser bundles, checked-in files, deploy artifacts, routine logs, or screenshots.
- Static-app config drift is a high risk because static builds can bake environment values. PR-010A must avoid stale localhost, wrong-stage, direct API Gateway, and secret-bearing config in production bundles.
- CloudFront origin custom header behavior must be handled carefully. CloudFront can add custom headers to origin requests, but header choice, forwarding, caching, and template representation must be verified before implementation.
- Basic Auth and API routing can conflict if the viewer `Authorization` header is forwarded to the API. Prefer a design that keeps browser gate credentials at the edge, strips or avoids forwarding those credentials to the Control API, and does not require forwarding viewer authorization to the origin.
- Origin proof visible to principals with CloudFront distribution read access is not equivalent to production authentication. Limit that IAM visibility, keep origin proof separate from direct API token and browser credential, and document rotation.
- CloudFront can cache API responses if behavior policies are wrong. `/api/*` must disable caching or use a policy that cannot leak product data, auth failures, artifact URLs, or stale responses across sessions.
- CloudFront can also cache static app responses across authorization states if the gate runs too late or cache keys are wrong. The access gate must be cache-safe for every behavior, and tests must include authenticated and unauthenticated request ordering.
- CloudFront `/api/*` can accidentally become a public API if the behavior injects origin proof but does not also enforce viewer access. The plan now requires unauthenticated CloudFront `/api/*` denial.
- A public CloudFront distribution can become an abuse/cost surface even when product data is protected. PR-010A must include bounded-abuse controls for repeated unauthenticated static and `/api/*` attempts.
- Platform logs can leak what application evidence redaction omits. PR-010A must not enable CloudFront/S3/API Gateway/browser logging that captures cookies, auth headers, signed query strings, request bodies, full presigned URLs, or document content.
- Browser storage, referrer headers, and diagnostics can leak protected values even when bundles and deploy artifacts are clean. The app must avoid client persistence of protected values and use conservative referrer/security headers.
- Service workers, offline caches, and Cache Storage can make direct deployed verification lie by serving stale app/API responses or persisting protected data. Do not add them unless they are explicitly bounded, inspected, and tested against `/api/*`, artifact access, credentials, signed URLs, and build metadata.
- Source maps and build-debug artifacts can expose unminified source, fixture histories, internal endpoints, controlled document text, and secret-bearing constants even when runtime bundles look clean. Disable public source maps by default or include them in every asset scan and deployed exposure check.
- CORS is not a substitute for authorization. The deployed app should prefer same-origin `/api/*`; any direct API path used for verification must stay protected and must not broaden browser access.
- Static export can break if current Next.js components depend on server-only or dynamic runtime features.
- Static export checks can give false confidence if they only prove the home page. PR-010A must inventory every production route and scan for server-only Next.js features before frontend hosting can be accepted.
- Server-side redirects such as the current home-page redirect may not be the right behavior for static hosting. Static export must prove the root route and product routes load without server-only runtime assumptions.
- Static export can also pass for the home page while dynamic product deep links fail. PR-010A must prove refresh/deep links for document, job, and run routes.
- Existing fixture context may be entangled with UI state. Removing product-facing fake histories must not break local tests or test-only fixtures.
- Presigned upload/download flows can fail through the browser because of CORS or mixed-origin assumptions.
- Artifact-bucket CORS can create hidden cross-stack coupling because the storage bucket already exists and the CloudFront URL is produced by a new stack. Broad CORS is not an acceptable workaround.
- Proxying the PDF through Control API to avoid CORS would violate the no-raw-PDF-through-API rule. If direct S3 presigned upload and a CloudFront-to-S3 raw-byte path are both unsafe or infeasible, PR-010A must stop with a blocker rather than adding an API upload proxy.
- A CloudFront-to-S3 raw-byte upload path can accidentally become a broad S3 write proxy. If used, it must preserve PR-010 upload constraints and reject arbitrary keys, overwrites, wrong content types, oversized files, missing metadata, and writes to frontend/deploy buckets.
- Presigned artifact URLs are sensitive because signed query strings can grant temporary access. Verification must record sanitized proof only.
- CloudFront deployment and invalidation can make post-merge verification slower than API-only deployments.
- CloudFront or S3 can serve stale HTML/assets after a successful deploy. Build identity, safe cache headers, invalidation, and rendered-SHA verification are required.
- Destructive asset sync can break clients with cached HTML and undermine CI-only rollback. Retain still-referenced hashed assets for a short documented window or previous successful build; cleanup must be a CI-controlled maintenance action, not an implementation shortcut.
- The current CI deploy role may lack CloudFront/S3 CORS/edge-code/invalidation permissions. Missing permissions must be surfaced as a prerequisite or fixed through the allowed CI/IaC path.
- Current CI scripts hard-code the pre-frontend stack set and deploy artifact schema. PR-010A must update them deliberately rather than weakening validation or hiding the frontend stack from deploy evidence.
- The frontend hosting bucket must not reuse the product artifact bucket. Product artifacts are economic/workflow evidence; static deploy assets are release artifacts with different lifecycle and validation requirements.
- The CI deploy artifact bucket must also remain separate from the product artifact bucket. CI evidence is not workflow artifact evidence.
- Frontend asset publishing can fail independently of stack deployment. A green CloudFormation deploy is insufficient unless CI proves current assets are present, coherent, and served.
- API path rewriting must preserve existing Control API routes and error contracts.
- API Gateway origin path derivation can be subtly wrong with trailing slashes, default stages, or CloudFront behavior paths. PR-010A must prove exact `/api/*` routing through CloudFront before deployed verification can count.
- Stale `allowUnauthenticatedPlaceholderApi` configuration is a latent footgun. PR-010A must remove or reject that path so future context or workflow changes cannot re-open unauthenticated product API access.
- The app must not imply that the PR-010 placeholder run is a translated output or accepted business outcome.
- Comparison UI is currently built around V1/V2/V3 fixture histories. PR-010A must either remove/hide comparison navigation until real persisted comparison data exists or render comparison only from API-backed records without fake success states.
- Current settings/economics UI contains fixture-oriented copy and editable-looking controls. PR-010A must not leave fake settings mutations or fixture/telemetry-derived cost-basis labels in the deployed product surface.
- Telemetry may be insufficient until observability hardening. Missing telemetry is a blocker to claim telemetry verification, not a blocker to honestly completing the implementation if the repository still lacks queryable telemetry.
- Deployed incomplete-state verification can tempt manual DynamoDB edits. Use API-supported states for deployed proof and reserve malformed-record cases for deterministic tests unless a real API path produces them.
- A technically deployed app can still be a poor verification surface if the UI is broken, inaccessible, clipped, or unusable on mobile. PR-010A must include direct desktop/mobile product and visual audit, not just API/network proof.
- Future slices depend on repeatable deployed verification. PR-010A must leave non-secret handoff material for locating the current deploy artifact/app URL/build identity and credential locators; otherwise later work may drift back to localhost, direct API Gateway, or unsafe evidence practices.
- CloudFront is global while the rest of the repo is anchored in `us-east-1`. PR-010A must make that boundary explicit in infrastructure, deploy artifacts, and rollback notes, especially if Lambda@Edge is selected.

## Progress, Blockers, And Evidence

- Used `plan-next-phase` to move from completed PR-010 to the next uncompleted build slice.
- Read and applied the relevant planning, specification, testing, frontend, frontend-testing, and security guidance for this plan.
- Recorded PR-010 completion evidence: main SHA `43dc954063345bcc434f1c7453d27bfda6e74f9d`, main CI run `26204080013`, protected live API verification passed, and the user waived remaining PR-010 CloudWatch telemetry evidence.
- Updated repository instructions so `AGENTS.md` identifies `PR-010A - Deployed frontend and dev access` as the next task.
- Updated `docs/codex/BUILD_ORDER.md` so immediate next-task guidance and acceptance language point to PR-010A.
- Began implementation using the `implement-plan` skill on branch `codex/pr-010a-deployed-frontend-access`.
- Confirmed local `HEAD` and `origin/main` both point at `43dc954`; no upstream divergence before implementation.
- Loaded the required implementation guidance for planning, testing, frontend patterns, frontend testing, backend patterns, TypeScript, security, and refactoring.

Plan review pass 1:

- The initial PR-010A plan was not sufficient until it made origin-proof secret handling an explicit design gate. That is now Step 2 and must be resolved before implementation.
- The initial plan also needed explicit static export proof, bundle secret scanning, and direct browser refresh verification to catch fixture fallback. Those checks are now included.
- The scope is intentionally limited to deployed frontend access and API-backed PR-010 behavior. AgentCore, Bedrock, PDF processing, V2/V3, and production auth remain deferred.

Review-plan pass 2:

- Not 100% satisfied at the start of this pass. The plan was weaker than the PR-010A story contract on environment binding, evidence redaction, pre-inspection job blocking, artifact-access proof, incomplete record groups, deploy artifact schema evolution, and the current fixture-backed web surface.
- Fixed by adding explicit wrong-environment rejection, sanitized browser/deploy evidence requirements, pre-inspection job checks, private artifact-access verification, incomplete-record UI checks, PR-010A deploy artifact requirements, and concrete fixture-removal targets in `apps/web`.
- Also fixed second-order CloudFront risks: `/api/*` must not broadly cache product API responses, CORS must not become a security boundary, and browser-gate credentials/cookies must not be forwarded unnecessarily to the Control API.

Adversarial review pass 3:

- Not 100% satisfied at the start of this pass. The plan still had hidden assumptions around CloudFront `/api/*` being protected for unauthenticated viewers, static-export dynamic routes, S3 browser-upload CORS, stale CloudFront/S3 assets, CI permissions for CloudFront/frontend resources, build identity, and rollback/fix-forward.
- Verified current AWS CloudFront documentation for custom origin headers, header restrictions, and `Authorization` forwarding/caching risk. Verified current AWS CloudFront OAC guidance for private S3 origins and S3 CORS preflight requirements for browser upload paths.
- Fixed by adding an explicit adversarial assumption register, unauthenticated CloudFront `/api/*` denial, API cache/header policy assertions, OAC requirement, static deep-link proof, narrow S3 CORS or non-API raw-byte upload proof, rendered build identity matching the deploy artifact, CI permissions prerequisites, CloudFront propagation/invalidation readiness, and CI-only fix-forward/rollback.
- Updated `docs/codex/PR-010A-DEPLOYED-FRONTEND-ACCESS.md` as well because repository-local instructions make story contracts the acceptance source, and the critical review findings should not live only in temporary `PLAN.md`.

Adversarial review pass 4:

- Not 100% satisfied at the start of this pass. The plan still allowed direct browser API Gateway calls as an alternate path, did not explicitly require edge stripping of browser-gate credentials, did not guard against static fallback hiding API/auth/static-asset failures, did not scan production assets for fixture histories/raw PDFs/full document text, and did not call out fixture-derived/false telemetry-derived economics labels.
- Fixed by making same-origin CloudFront `/api/*` the deployed app default, adding explicit credential stripping/no-forwarding requirements, scoping static fallback so it cannot mask `/api/*`, auth, or missing asset failures, adding production asset scans, adding settings/economics honesty requirements, and aligning the PR-010A story contract with those constraints.

Final plan review:

- Do I agree with the plan? Yes. It implements only the PR-010A slice and now names the assumptions that could make it fail.
- Does it contain everything needed? Yes. It defines scope, product behavior, adversarial assumptions, deterministic checks, deployed verification, telemetry evidence, rollback/fix-forward, static asset hygiene, route fallback boundaries, cost-label honesty, risks, and done conditions.
- Is this the best solution? Yes for the stated repository direction. It uses S3 plus CloudFront, preserves CI-only deployment, keeps API secrets out of the browser, protects both static and `/api/*` CloudFront surfaces, avoids fixture-backed acceptance, prevents stale assets from satisfying verification, and keeps economics presentation honest.
- Am I confident that implementing it as written leads to the wanted outcome? HECK YES, with the explicit caveat that Step 2 must stop implementation if the chosen origin-proof/access design cannot meet the no-secret-leak, unauthenticated-CloudFront-API-denial, credential-stripping, no-broad-cache, no-wrong-environment, narrow-CORS, safe-static-fallback, and no-manual-AWS-mutation requirements.

Adversarial review pass 5:

- Not 100% satisfied at the start of this pass. The plan still did not account for current CI scripts that hard-code the pre-frontend stack set, current data-protection validation that expects only the product artifact bucket, possible accidental reuse of the artifact bucket for frontend assets, exact API origin path derivation, and stale unauthenticated placeholder access configuration.
- Fixed by adding assumptions 25 through 27, requiring a dedicated frontend hosting bucket separate from product artifacts, requiring PR-010A-aware updates to workflow/deploy-artifact/data-protection/smoke validators, adding exact CloudFront `/api/*` path-routing proof, and requiring stale placeholder unauthenticated API modes to be removed or rejected.

Final plan review after pass 5:

- Do I agree with the plan? Yes.
- Does it contain everything needed? Yes. It now covers the current CI script constraints, separate frontend deploy assets, exact `/api/*` routing, stale placeholder-auth removal, deterministic proof, post-merge deployed use, and telemetry honesty.
- Is this the best solution? Yes for this repository's direction: S3 plus CloudFront, CI-only deploy, protected same-origin API access, no manual AWS mutation, and no product-data/deploy-asset mixing.
- Am I confident that implementing it as written leads to the wanted outcome? HECK YES, as long as Step 2 remains a hard stop if the selected dev-access/origin-proof design cannot meet the stated constraints.

Adversarial review pass 6:

- Not 100% satisfied at the start of this pass. The plan still assumed static bundle configuration could be bound safely, asset publishing would be coherent with stack deployment, artifact-bucket CORS could be scoped without cross-stack circular dependencies, Codex would have a documented credential retrieval path for protected deployed verification, CI deploy artifacts would be separate from product workflow artifacts, and incomplete-state deployed verification could be produced without manual database mutation.
- Fixed by adding assumptions 28 through 33, requiring a non-secret same-origin runtime/build metadata strategy, requiring explicit asset publication ordering and manifest/cache/invalidation validation, requiring narrow CORS or non-API raw-byte upload without broad wildcard fallbacks, requiring documented secret locators and read paths for Codex verification, requiring deploy-artifact bucket separation from the product artifact bucket, and constraining incomplete-state deployed verification to API-supported states.

Final plan review after pass 6:

- Do I agree with the plan? Yes.
- Does it contain everything needed? Yes. The plan now covers CI deployment, static hosting, protected access, exact routing, secret retrieval, asset publication, CORS dependency risk, environment binding, fixture removal, deployed direct use, and telemetry honesty.
- Is this the best solution? Yes for the current product slice. It keeps the slice narrow while preventing the most likely false-success cases: stale static assets, wrong API config, broad CORS, mixed artifact buckets, inaccessible credentials, and fake incomplete-state evidence.
- Am I confident that implementing it as written leads to the wanted outcome? HECK YES, assuming the hard-stop design gates are respected and missing AWS/IAM/CORS capabilities are treated as blockers rather than worked around manually.

Adversarial review pass 7:

- Not 100% satisfied at the start of this pass. The plan still assumed the CloudFront access gate would be cache-safe, that logging/telemetry sources would not record sensitive request details, that browser storage/referrer behavior would not leak credentials or presigned URLs, and that security response headers could be omitted without materially weakening the protected dev app.
- Fixed by adding assumptions 34 through 37, requiring viewer-request or equivalently cache-safe access enforcement on every protected behavior, adding authenticated/unauthenticated cache-priming verification, forbidding protected values in browser storage/referrers/diagnostics/logs, constraining telemetry/logging configuration, and requiring a tested minimal response-header policy.

Final plan review after pass 7:

- Do I agree with the plan? Yes.
- Does it contain everything needed? Yes. It now covers the remaining cache-layer and browser-side leakage failure modes that could make a deployed app look protected while still exposing data or credentials.
- Is this the best solution? Yes for PR-010A. The added constraints are narrow and directly tied to deployed verification safety.
- Am I confident that implementing it as written leads to the wanted outcome? HECK YES, provided the access gate is proven cache-safe and unsafe telemetry/logging is treated as unavailable rather than enabled for convenience.

Review-plan pass 8:

- Not 100% satisfied at the start of this pass. The plan could still technically satisfy deployment/auth/API requirements while leaving the rendered app too fragile for future direct-use verification, and it did not explicitly require a reusable non-secret handoff for later slices.
- Fixed by adding assumptions 38 and 39, desktop/mobile product and visual audit requirements, UI state/accessibility/responsive checks, future-slice deploy-artifact/app/credential-locator handoff requirements, and an explicit rule that next-task instructions should not mark PR-011 next until PR-010A has actually merged, deployed, and been verified.

Final plan review after pass 8:

- Do I agree with the plan? Yes.
- Does it contain everything needed? Yes. It now covers implementation scope, CloudFront/S3 hosting, API protection, secret hygiene, cache safety, asset publication, fixture removal, product-state honesty, direct deployed use, telemetry honesty, UI usability, and future-slice handoff.
- Is this the best solution? Yes for the current repository direction. It keeps PR-010A focused on enabling deployed app verification while blocking the failure modes that would make later workflow slices unreliable.
- Am I confident that implementing it as written leads to the wanted outcome? HECK YES, with the same hard-stop caveat: if the access/origin-proof design, deployment role, static export strategy, upload path, or handoff cannot meet these requirements through CI and direct deployed use, implementation must stop and record the blocker rather than weakening the story.

Adversarial review pass 9:

- Not 100% satisfied at the start of this pass. The plan still contained a hidden contradiction: "API-mediated upload" was allowed as a CORS fallback even though repository architecture forbids raw PDF bytes through APIs. The plan also assumed CloudFront global/edge resources would not blur the `us-east-1` deployment rule, and it relied too much on static export/deep-link tests without requiring a production route inventory and server-only feature scan.
- Fixed by adding assumptions 40 through 42, removing API-mediated raw upload as an acceptable path, requiring direct S3 presigned upload or another proven non-API raw-byte path such as same-origin CloudFront-to-S3 upload, requiring a blocker instead of an API upload proxy when upload cannot be made safe, adding regional/global resource-boundary checks for CloudFront and edge resources, and adding static route inventory/server-only Next.js feature scans.

Final plan review after pass 9:

- Do I agree with the plan? Yes.
- Does it contain everything needed? Yes. It now closes the raw-PDF-through-API contradiction, region-boundary ambiguity, and server-only static deployment gap that could have produced a bad implementation despite earlier review passes.
- Is this the best solution? Yes. It keeps S3 plus CloudFront as the selected path, preserves the non-negotiable artifact/API boundary, and makes blockers explicit rather than allowing hidden fallback architectures.
- Am I confident that implementing it as written leads to the wanted outcome? HECK YES, provided implementation treats upload-path, edge-region, and static-route findings as hard blockers rather than reasons to weaken the architecture.

Adversarial review pass 10:

- Not 100% satisfied at the start of this pass. The plan still assumed the public CloudFront dev gate would not become an unbounded cost/abuse surface, that a non-API raw-byte upload path would automatically preserve PR-010 source-object constraints, and that frontend asset cleanup would not break cached clients or CI-only fix-forward.
- Verified current AWS WAF documentation for rate-based rule statements and CloudFront web ACL usage as a valid bounded-abuse option.
- Fixed by adding assumptions 43 through 45, requiring bounded-abuse controls for repeated unauthenticated CloudFront app and `/api/*` attempts, requiring upload-boundary checks for any non-API raw-byte path, and requiring asset-retention checks so still-referenced hashed assets are not deleted during deployment.

Final plan review after pass 10:

- Do I agree with the plan? Yes.
- Does it contain everything needed? Yes. It now covers public-edge abuse, upload integrity for non-API raw-byte paths, and frontend asset retention in addition to the earlier security, deployment, and verification constraints.
- Is this the best solution? Yes. It keeps the story within PR-010A while preventing operational shortcuts that would create future verification failures or architecture drift.
- Am I confident that implementing it as written leads to the wanted outcome? HECK YES, as long as these new edge-abuse, upload-boundary, and asset-retention gates are treated as required acceptance criteria rather than optional hardening.

Review-plan pass 11:

- Not 100% satisfied at the start of this pass. The plan had become strong on infrastructure and access control, but it still assumed client-side caching layers and build-debug outputs would not undermine deployed verification or leak protected data.
- Fixed by adding assumptions 46 and 47, making service-worker/offline-cache behavior and source-map/build-debug artifact handling explicit PR-010A design gates, and adding deterministic/deployed checks for Cache Storage, service worker registration, public source maps, debug manifests, route metadata, framework traces, and generated debug assets.

Final plan review after pass 11:

- Do I agree with the plan? Yes.
- Does it contain everything needed? Yes. It now covers the remaining browser/runtime and build-output paths that could invalidate direct deployed use or leak data while the main CloudFront/API design looks correct.
- Is this the best solution? Yes. It keeps the implementation focused on PR-010A but blocks two common static-app false-success modes: stale browser-cached behavior and public debug artifacts.
- Am I confident that implementing it as written leads to the wanted outcome? HECK YES, provided the implementation treats all Step 2 design gates as hard stops rather than details to resolve after code is written.

Implementation progress:

- Converted the frontend to a static-export client shell that uses same-origin `/api/*`, removed production fixture context/routes, and kept fixture behavior only in tests.
- Added focused web tests for API-backed document loading, no synthetic comparison rows, browser presigned upload without displaying signed URLs, and reviewability guard behavior.
- Verified focused web checks passed before infrastructure work: `pnpm --filter @agentcore-pdf-translator/web typecheck` and `pnpm --filter @agentcore-pdf-translator/web test`.
- Added the Control API CloudFront origin-proof auth path while preserving direct `x-dev-access-token` auth for operator/CI verification. Missing, duplicate, padded, mixed, or malformed credentials are rejected before runtime setup.
- Added the S3 plus CloudFront frontend stack design: dedicated private retained frontend bucket, CloudFront OAC, viewer-request Lambda@Edge Basic Auth gate, CloudFront `/api/*` origin proof injection, static deep-link rewrite, security response headers, WAF rate limiting, and narrow artifact-bucket browser upload CORS through IaC.
- Added CI support scripts for static frontend source/output validation, static asset publication with cache headers and CloudFront invalidation, and protected frontend smoke testing.
- Updated CI workflow contract toward PR-010A: expected stacks include the frontend stack, verify/deploy build the static frontend, deploy publishes assets after CDK deploy, frontend smoke is required before deploy artifact creation, and deploy artifact metadata uses `pr-010a-dev-deploy-v1`.
- Verified interim infrastructure typecheck passed: `pnpm --filter @agentcore-pdf-translator/infra typecheck`.
- Verified frontend static source validation passed locally: `node scripts/ci/validate-frontend-static.mjs`.
- Verified Control API auth tests passed: `pnpm --filter @agentcore-pdf-translator/control-api test`.
- Verified web component/API tests passed after removing production fixture routes: `pnpm --filter @agentcore-pdf-translator/web test`.
- Verified static frontend export passed with same-origin API build metadata: `NEXT_PUBLIC_BUILD_SHA=local-pr-010a NEXT_PUBLIC_BUILD_STAGE=dev NEXT_PUBLIC_BUILD_REGION=us-east-1 NEXT_PUBLIC_API_BASE_PATH=/api pnpm --filter @agentcore-pdf-translator/web build`.
- Verified built static output scan passed: `FRONTEND_BUILD_DIR=apps/web/out FRONTEND_STATIC_VALIDATION_PATH=.ci/local-frontend-static-validation.json node scripts/ci/validate-frontend-static.mjs`.
- Verified full dev CDK assembly synth passed for Storage, Database, ControlApi, and Frontend stacks.
- Verified synthesized data-resource protection scan passed with the frontend stack included: `CDK_ASSEMBLY_DIR=.ci/verify-all/cdk.out DATA_PROTECTION_SUMMARY_PATH=.ci/verify-all/data-protection-summary.json node scripts/ci/validate-data-protection.mjs`.
- Verified CI workflow contract passed: `pnpm ci:validate-workflow`.
- Verified CI helper syntax passed: `node --check` for frontend static validation, frontend publish, frontend smoke, deploy artifact creation, and data-protection validation scripts.
- Verified repository checks passed locally: `pnpm typecheck`, `pnpm test`, and `pnpm lint`.
- Refactoring assessment after green checks: no broad refactor is warranted. The remaining duplication in CI/frontend smoke helpers is operationally explicit rather than shared business logic; extracting it now would reduce review clarity. The only small cleanup applied was removing the hard-coded default business value from the job form so future economics values must be entered or configured intentionally.
- Merged PR #35 (`PR-010A: Deployed frontend and dev access`) into `main` at merged SHA `c93b958c9d48dbb436e42dab7b23939152b525db`.
- Post-merge main CI run `26208551886` deployed the dev stacks and published 37 frontend assets, but failed at `Smoke test deployed protected frontend`.
- Failure evidence: unauthenticated CloudFront root was denied, authenticated CloudFront `/api/price-books/current` returned `ACTIVE`, but authenticated `/` and `/documents` returned 404 immediately after asset publication. This points to CloudFront/S3 static-origin readiness or propagation, not an API-origin/auth failure.
- Fix-forward path: created branch `codex/pr-010a-frontend-smoke-retry` from merged `main` and scoped the recovery to the CI frontend smoke helper. The helper must keep the same pass/fail assertions, but retry readiness-sensitive app-shell and protected route checks before failing the post-merge deployment.
- Fix-forward plan review: HECK YES. The scope is correctly limited to deployment readiness evidence, preserves the same smoke assertions, does not weaken access control or product behavior, and keeps recovery on the CI/IaC path instead of manual AWS mutation.
- Fix-forward deterministic checks passed: `node --check scripts/ci/smoke-frontend.mjs`, `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm ci:validate-workflow`, and `git diff --check`.
- Merged PR #36 (`Fix PR-010A frontend smoke readiness`) into `main` at merged SHA `f8aad429894d5721d067272afa09e02eff1956ab`.
- Post-merge main CI run `26209102701` again failed at `Smoke test deployed protected frontend`. The retry evidence showed 59 attempts over ten minutes: unauthenticated `/` denied, CloudFront `/api/price-books/current` succeeded with `ACTIVE`, but authenticated `/` and `/documents` still returned 404.
- Second fix-forward path: created branch `codex/pr-010a-edge-root-rewrite` from merged `main`. This recovery must fix the static app-shell routing layer, not weaken verification. It explicitly rewrites root app requests to `/index.html`, keeps deep-link app-shell rewriting, and adds published `index.html` object evidence plus explicit `/index.html` CloudFront smoke evidence.
- Second fix-forward plan review: HECK YES. The change is still limited to frontend deployment/routing verification, preserves CI-only AWS mutation, does not weaken authentication or static-route assertions, and adds sharper diagnostic evidence for any remaining CloudFront/S3 failure.
- Second fix-forward deterministic checks passed: `node --check scripts/ci/smoke-frontend.mjs`, `pnpm --filter @agentcore-pdf-translator/infra test`, `pnpm --filter @agentcore-pdf-translator/infra typecheck`, `pnpm cdk synth ...FrontendStack`, `node scripts/ci/validate-data-protection.mjs` against the synthesized assembly, `pnpm ci:validate-workflow`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `git diff --check`.
