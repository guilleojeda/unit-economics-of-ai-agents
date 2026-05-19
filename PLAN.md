# PLAN

## Objective

Implement PR-006: a Control API skeleton that exposes the documented product workflow through typed TypeScript handlers backed by in-memory repositories, without adding AWS runtime integration or fake product modes.

## Scope and non-goals

In scope:

- Mark PR-005 complete and plan the next uncompleted build-order item.
- Add `/apps/control-api` as a TypeScript package in the existing monorepo.
- Define a small handler and route-dispatch layer that can be tested without API Gateway or Lambda runtime coupling.
- Reuse shared schemas, costing logic, repository interfaces, in-memory repositories, state transition guards, ID generation, and S3 key conventions from the first slice.
- Implement the Control API shape for local/in-memory behavior where the domain model already supports it:
  - document reads
  - document jobs reads
  - job creation for ready controlled documents
  - job list, job reads, job-level ledger, job economics, run reads, run timeline, artifacts, evaluation, run ledger, and economics reads
  - run creation as a technical attempt in `QUEUED`
  - review decision creation for `AWAITING_REVIEW` runs
  - comparison-group reads
  - current price-book reads and updates
- Add or refine shared API request/response schemas only for cross-boundary contracts that the Control API owns; do not duplicate domain schemas inside the app package.
- Define explicit request schemas for job creation, run start, review decision, route params/query, and current price-book updates.
- Add an AgentCore Runtime client port plus a recording/no-op implementation for tests. It may record `{ workspaceId, documentId, jobId, runId }` invocation requests, but it must not call AgentCore.
- Add structured API errors matching the documented error envelope.
- Add explicit HTTP status mapping for Control API errors.
- Add deterministic tests for handler behavior, invalid transitions, economics rollups, and error mapping.

Out of scope:

- AWS integration, Lambda deployment, API Gateway resources, DynamoDB repositories, S3 repositories, real presigned uploads, AgentCore Runtime, AgentCore Gateway, Bedrock calls, PDF extraction, PDF recomposition, frontend rewiring, deployed verification, telemetry verification, replay mode, synthetic-run mode, live-capture mode, recording mode, and presentation mode.
- Real upload or inspection behavior. Upload/presign/inspect routes, if represented in the skeleton, must return an explicit not-implemented API error rather than fake storage, fake inspection, or fake product-facing runs.
- Long-running workflow execution. The Control API creates runs and records the intended runtime invocation only.
- New product prices or hard-coded model IDs. Any test or fixture cost assumptions must come from `PriceBook` records.
- Product-facing seeded run history. Seed data may exist only in tests or explicitly local developer scaffolding.

## Assumptions and open questions

- PR-005 is complete because pull request #2 was merged into `main` and post-merge CI passed.
- The next uncompleted build-order item is PR-006, `Control API skeleton`, from `docs/codex/BUILD_ORDER.md`.
- The Control API skeleton should be a pure TypeScript package first. Lambda and API Gateway packaging belong to PR-007.
- API routes can be represented by a testable dispatcher and handler functions before a deployed HTTP surface exists.
- The existing in-memory repositories are sufficient for PR-006 if each test creates an isolated app context.
- Upload, presign, and inspection endpoints need careful treatment because fake storage or fake inspection would create misleading product behavior. Resolve this by either omitting them from the implemented dispatcher for PR-006 or returning a structured not-implemented response with no side effects.
- The first Control API package should use `workspaceId = ws_default` through explicit request/app context, not hidden globals, so later authentication can replace it without changing handler behavior.
- Current price-book resolution must use `AppSetting` (`ACTIVE_PRICE_BOOK_VERSION`) as the primary source. Existing jobs and ledger rows keep their own `priceBookVersion`; updating the current price book must not mutate historical economics.
- PR-006 should support a new attempt only for jobs that are not terminal and have no active or reviewable run. It must not add rejected/escalated remediation semantics.
- Review decisions should require the parent job to be `AWAITING_REVIEW` and `latestRunId` to match the reviewed run. Accepting a stale or orphaned `AWAITING_REVIEW` run would corrupt job-level economics.
- Review decisions should require a latest `EvaluationResult` for the reviewed run. Automated evaluation is not business acceptance, but review without evaluation evidence is not a valid workflow state.
- `GET /api/runs/{runId}/evaluation` should return a successful response with `evaluation: null` when the run exists but no evaluation has been produced yet. Missing run remains `RUN_NOT_FOUND`.
- `GET /api/runs/{runId}/artifacts` should return metadata for run artifacts and the source PDF artifact referenced by the run/document when present, but never fabricated presigned URLs.
- Runtime invocation can fail even in a port-based skeleton. PR-006 needs a deterministic failure path so a failed invocation does not leave a job permanently `RUNNING` with a queued run that will never execute.
- The worktree already has an unrelated local change in `apps/web/next-env.d.ts`. Implementation must avoid staging or committing it unless a later user request explicitly brings it into scope.
- Adding `/apps/control-api` as a workspace package may require a `pnpm-lock.yaml` importer update even if no new third-party dependency is added.
- The implementation touches backend request flow, TypeScript schemas, deterministic tests, and user input validation. Before code edits, explicitly load the `backend-patterns`, `typescript`, `testing`, and `security` skills, then use `refactoring` after checks are green.
- Job creation must not accept a raw `enableImageTranslation` option from callers. That flag is derived from `workflowVariant` so V1/V2/V3 cannot be internally contradictory.
- Comparison-group behavior must be explicit: either join a supplied group that belongs to the same workspace and document, create a new group when requested, or create an ungrouped job. Do not silently generate comparison groups for all jobs.

## Expected outcomes

- `TranslationJob` remains the business unit and `Run` remains a technical attempt.
- `POST /api/documents/{documentId}/jobs` creates a job only for ready controlled documents and rejects unsupported or failed-inspection documents.
- `POST /api/jobs/{jobId}/runs` creates a new `Run` in `QUEUED`, assigns the next attempt number, preserves job/run separation, and records a runtime invocation request through the no-op AgentCore client.
- `POST /api/runs/{runId}/review` only accepts `AWAITING_REVIEW` runs, creates a `ReviewDecision`, creates a `HUMAN_REVIEW` `LedgerItem`, applies the correct terminal run state, and recalculates economics from ledger rows.
- Accepted jobs show cost per verified outcome and unit margin. Rejected or escalated jobs show consumed cost without verified outcome or unit margin.
- LLM-only cost and full workflow cost remain separate in every economics response.
- Missing records, invalid input, invalid transitions, unsupported documents, and already-running jobs return the documented API error envelope.
- Workspace-scoped list and read handlers must not return records from another workspace, even though MVP uses only `ws_default`.
- Handler failures must not leave partially-created review decisions, ledger rows, or status changes when validation fails.
- Runtime invocation failure during run start must return HTTP `502` with `AGENT_INVOCATION_FAILED` and leave explicit failed state evidence, not a silently queued run. For PR-006, the expected behavior is to persist the run as `FAILED`, mark the job `FAILED` when there is no other open attempt, and include the failure reason.
- Review handlers must reject stale runs, parent job/run mismatches, duplicate review attempts, missing evaluation evidence, and parent jobs that are not `AWAITING_REVIEW`.
- Mutating handlers must reject malformed bodies before any write and must not silently default business values that should come from the request or active price book.
- Job creation must reject contradictory workflow options, such as V1 plus image translation, by deriving image-translation capability from `workflowVariant`.
- Review handling should create review timeline evidence consistently: either a `reviewer_decision` `StageEvent` plus `HUMAN_REVIEW` ledger row, or an explicitly documented reason for omitting the stage event. For PR-006, create the `reviewer_decision` stage event so run timelines and ledgers line up.
- No product behavior is added for replay, synthetic, live-capture, recording, or presentation modes.
- No economics response uses logs, traces, or runtime messages as the source of truth.

## Product design

The Control API is the application boundary for the operational workflow:

```text
Document -> TranslationJob -> Run -> StageEvents / Artifacts / LedgerItems -> EvaluationResult -> ReviewDecision -> Job economics
```

For PR-006, the API skeleton should prove the shape and invariants of that boundary without pretending that AWS execution exists. The API should stay responsive and deterministic. It should create durable domain records in repositories, calculate economics from `LedgerItem` records, and reject invalid business actions before any side effects are committed.

The ideal developer experience is a small, testable package where future Lambda/API Gateway code can wrap existing handlers. Route tests should read like contract examples for the frontend and future persistent API. Handler code should avoid framework-specific assumptions so PR-007 can add infrastructure without rewriting domain behavior.

PR-006 route coverage should be explicit:

Implemented with in-memory behavior:

- `GET /api/documents`
- `GET /api/documents/{documentId}`
- `GET /api/documents/{documentId}/jobs`
- `POST /api/documents/{documentId}/jobs`
- `GET /api/jobs`
- `GET /api/jobs/{jobId}`
- `GET /api/jobs/{jobId}/runs`
- `GET /api/jobs/{jobId}/ledger`
- `GET /api/jobs/{jobId}/economics`
- `POST /api/jobs/{jobId}/runs`
- `GET /api/runs/{runId}`
- `GET /api/runs/{runId}/timeline`
- `GET /api/runs/{runId}/artifacts`
- `GET /api/runs/{runId}/evaluation`
- `GET /api/runs/{runId}/ledger`
- `POST /api/runs/{runId}/review`
- `GET /api/compare?comparisonGroupId=...`
- `GET /api/price-books/current`
- `PUT /api/price-books/current`

Deferred with no side effects if represented in the dispatcher:

- `POST /api/documents/presign`
- `POST /api/documents`
- `POST /api/documents/{documentId}/inspect`

Deferred routes must return HTTP `501` with structured API error code `NOT_IMPLEMENTED` and a `details.deferredUntil` field. They must not fabricate S3 URLs, create fake document inspection results, or seed product-facing histories.

Boundary request contracts for PR-006 should be intentionally small:

- `POST /api/documents/{documentId}/jobs` accepts `workflowVariant`, `valueModel`, `options.enablePolicyChecks`, `options.enableMemory`, `options.preserveLayout`, optional `comparisonGroupId`, and optional `createComparisonGroup`. It derives document ID, workspace, source/target languages, price-book version, and `options.enableImageTranslation` from existing records/context and `workflowVariant`.
- Job creation rejects requests that provide both `comparisonGroupId` and `createComparisonGroup: true`. A supplied `comparisonGroupId` can be joined only if existing jobs in that group belong to the same workspace and document. `createComparisonGroup: true` generates a new `cmp_` ID. Omitting both creates an ungrouped job.
- `POST /api/jobs/{jobId}/runs` accepts an omitted body or an empty object only. It derives run IDs, attempt number, languages, source artifact ID, workflow variant, and runtime invocation IDs from existing records. Do not accept a `reason` until there is a durable schema field for it.
- `POST /api/runs/{runId}/review` accepts `decision`, `reviewerSeconds`, and optional `reason`. It derives job/document/workflow/price-book fields from existing records. Human-review cost uses `job.valueModel.humanReviewHourlyRateUsd`; do not accept a review-time hourly-rate override in PR-006.
- `PUT /api/price-books/current` accepts a full `PriceBook` payload or an explicit current-version selection. Either path must update `ACTIVE_PRICE_BOOK_VERSION`; neither path may rewrite historical jobs, runs, or ledger rows.
- Route params and query strings are validated through shared Zod schemas before handler logic runs.

Control API error statuses must be consistent:

| Code | HTTP status |
| --- | --- |
| `VALIDATION_ERROR` | `400` |
| `DOCUMENT_UNSUPPORTED` | `400` |
| `DOCUMENT_NOT_FOUND` | `404` |
| `JOB_NOT_FOUND` | `404` |
| `RUN_NOT_FOUND` | `404` |
| `ARTIFACT_NOT_FOUND` | `404` |
| `PRICE_BOOK_NOT_FOUND` | `404` |
| `RUN_NOT_REVIEWABLE` | `409` |
| `JOB_ALREADY_RUNNING` | `409` |
| invalid state transition errors | `409` |
| `NOT_IMPLEMENTED` | `501` |
| `AGENT_INVOCATION_FAILED` | `502` |
| `INTERNAL_ERROR` | `500` |

## Adversarial Assumption Review

The implementation plan depends on these assumptions. Each assumption has been challenged and converted into a plan constraint or verification item where failure would matter.

| Assumption | Supporting evidence | What could make it false | What breaks if false | Plan change |
| --- | --- | --- | --- | --- |
| PR-005 is complete and `main` is the right base. | PR #2 was merged and post-merge CI passed. | `main` has moved or local dirty files are accidentally included. | PR-006 starts from stale code or commits unrelated frontend state. | Fetch/rebase from current `main`; inspect `git status`; stage only PR-006 files and `PLAN.md`. |
| PR-006 is the next correct build-order item. | `AGENTS.md`, `BUILD_ORDER.md`, and implementation brief all list Control API skeleton after frontend fixtures. | A later planning doc supersedes the build order. | Work begins on infrastructure or persistence too early. | Keep AWS, DynamoDB, S3, and AgentCore out of scope unless repository-local instructions explicitly change. |
| A pure TypeScript package is enough before Lambda/API Gateway. | ADR-044 chooses TypeScript Lambda later; PR-007 owns infrastructure. | The future adapter needs handler shapes that were not modeled. | PR-007 rewrites the Control API instead of wrapping it. | Define framework-neutral request, response, status, headers, and error primitives now. |
| A route dispatcher can stand in for HTTP without hiding behavior. | Current work has no deployed API and tests can call handlers directly. | Dispatcher omits path, method, or query parsing details. | Future API Gateway integration exposes untested route behavior. | Add route-level tests for method, path params, query params, body validation, and status codes. |
| Existing domain schemas are sufficient. | `packages/schemas` has domain and API error schemas. | Request/response contracts are not represented by current schemas. | Handlers accept malformed bodies or invent ad hoc response shapes. | Add shared schemas only for Control API-owned boundary contracts and validate all mutating requests. |
| Existing repositories are sufficient for skeleton work. | In-memory repos cover put/get/list for core entities. | Missing update/conditional operations force unsafe read-modify-write patterns. | Persistent repos later cannot enforce concurrency or no-partial-write guarantees. | Keep handler write sets small, validate before writes, and document where PR-008/PR-009 need conditional writes. |
| No transaction support is acceptable in PR-006. | Only in-memory local behavior is in scope. | Handler writes multiple records and a later step fails. | Review or run-start leaves inconsistent data. | Test no partial writes for validation failures and explicit failure states for invocation failures. |
| `workspaceId = ws_default` is safe for MVP. | Frontend/API contract says no complex auth and uses `ws_default`. | Future auth or multiple workspaces arrive sooner than expected. | Cross-workspace data leaks become baked into route logic. | Carry workspace through explicit context and test cross-workspace isolation. |
| `AppSetting` should identify the active price book. | Entity model includes `ACTIVE_PRICE_BOOK_VERSION`; price-book records have versions. | Multiple price books are marked `ACTIVE` or setting points to a missing version. | Jobs use ambiguous prices or historical costs change. | `GET current` resolves through `AppSetting`; missing setting/version returns `PRICE_BOOK_NOT_FOUND`; `PUT current` updates setting for future jobs only. |
| `PUT /api/price-books/current` is safe in a skeleton. | API contract includes it. | The endpoint mutates historical jobs or silently changes ledger rows. | Economics become non-reproducible. | Validate and store a price book/version, update active setting, and never rewrite existing jobs or ledger rows. |
| Deferred upload/presign/inspection routes can return `501`. | PR-006 excludes AWS/S3/PDF inspection and fake behavior is forbidden. | Frontend or tests expect upload flow to work in PR-006. | The slice appears incomplete or someone fakes S3 behavior. | Keep route behavior explicit: `NOT_IMPLEMENTED`, no side effects, and `deferredUntil` pointing to the later storage/API/PDF slices. |
| Artifact metadata is enough before S3 repositories. | ADR-012 says presigned URLs are future Control API behavior, but PR-006 excludes S3. | Result view contract expects artifact links. | Implementer fabricates URLs or omits source artifact metadata. | Return artifact metadata only, including source PDF artifact when present; no download URLs until S3 repo exists. |
| Runtime invocation port can be no-op. | PR-006 excludes AgentCore Runtime but Control API must create runs. | Invocation failure path is ignored because the default no-op succeeds. | A future failing runtime client leaves jobs stuck as running. | Add a recording client plus a failure-client test; failed invocation marks failed state and returns `AGENT_INVOCATION_FAILED`. |
| Starting later attempts is safe for non-terminal jobs. | Data model says a failed/rejected run can exist under a job; build order has no remediation yet. | The job itself is terminal, or an old `AWAITING_REVIEW` run still exists. | Costs and accepted outcomes attach to the wrong attempt. | Reject terminal jobs, active runs, and reviewable runs; allow a later attempt only when prior runs are terminal and job remains non-terminal. |
| Reviewable run implies reviewable job. | Docs say reviewer decisions are product events and job/run states should align. | Fixture or future agent completion leaves run `AWAITING_REVIEW` while job is still `RUNNING`. | Job transition skips `AWAITING_REVIEW` or accepts a stale run. | Require parent job `AWAITING_REVIEW` and `latestRunId === runId`; reject inconsistent state with `409`. |
| Review can proceed without evaluation evidence. | The run state should normally reach `AWAITING_REVIEW` after evaluation. | Bad fixture data or future runtime bugs create an `AWAITING_REVIEW` run with no `EvaluationResult`. | A reviewer can accept an output without the product’s required evaluation evidence. | Require latest evaluation result before review; return `RUN_NOT_REVIEWABLE` when missing. |
| Review-time hourly-rate override is harmless. | Costing helper accepts an optional hourly rate. | API lets each review rewrite the economic assumption for that decision. | Human-review cost no longer reflects the job’s configured value model. | Do not accept hourly-rate override on review; use `job.valueModel.humanReviewHourlyRateUsd`. |
| Run-start reason is harmless. | Workflow spec pseudocode includes a `reason` parameter. | There is no durable `Run` field or audit table for the reason. | API accepts input that disappears, creating false audit expectations. | Run-start body is omitted or `{}` only until a durable schema field exists. |
| Duplicate review attempts are prevented by state transitions. | First review should terminalize the run. | Concurrent or repeated requests run before state is observed. | Duplicate `ReviewDecision` and `HUMAN_REVIEW` ledger rows overstate cost. | Validate existing decisions and terminal state before writing; add a duplicate-review test. |
| Ledger items are enough to recalculate economics. | Costing package has run/job rollups from ledger rows. | Handler updates statuses but forgets to persist rollups on job/run records. | API responses disagree depending on whether they read stored fields or roll up dynamically. | After review, update run and job stored rollup fields from ledger-derived rollups and test consistency. |
| `GET evaluation` can return no evaluation. | A queued or running run legitimately has none. | Handler treats missing evaluation as a missing run or internal error. | Polling clients cannot distinguish pending evaluation from missing resource. | Return `{ evaluation: null }` for existing runs with no evaluation. |
| Error codes can include `NOT_IMPLEMENTED`. | `ApiErrorSchema` allows non-empty strings; docs list common, not exhaustive, codes. | Consumers assume only documented common codes. | Deferred endpoints are hard to handle. | Add `NOT_IMPLEMENTED` as a shared Control API error code for skeleton-only deferred endpoints. |
| No frontend rewiring is needed. | PR-005 intentionally uses API-shaped fixtures; PR-006 is backend skeleton. | Frontend fixture shapes drift from new API responses. | PR-009 integration becomes expensive. | Add contract-style handler tests with response shapes matching documented frontend routes, but do not rewrite frontend. |
| Request body shape is obvious from docs. | The frontend/API contract lists form fields and endpoint purposes. | The implementation invents different names or defaults. | PR-009 frontend integration breaks or business values are silently wrong. | Define minimal Zod request schemas for every mutating endpoint and test validation failures. |
| Workflow options can be accepted as-is. | `WorkflowOptions` has an `enableImageTranslation` boolean. | A caller creates V1 with image translation enabled or V2/V3 with it disabled. | Workflow variants no longer mean what the product says they mean. | Control API request schema excludes `enableImageTranslation`; handler derives it from `workflowVariant`. |
| Comparison-group creation is obvious. | UI mentions a create comparison group checkbox. | Handler silently groups every job or allows cross-document grouping. | Comparison view mixes unrelated jobs or future frontend cannot create groups predictably. | Support explicit `comparisonGroupId` join or `createComparisonGroup`; validate same workspace/document; otherwise leave job ungrouped. |
| Review ledger rows do not need timeline rows. | API contract names `ReviewDecision` and `HUMAN_REVIEW` ledger creation, not a `StageEvent`. | Timeline and ledger disagree about when review happened. | Review appears in costs but not workflow history. | Create a `reviewer_decision` `StageEvent` with the review decision and ledger row. |
| A new workspace package will not affect install/CI. | Internal-only packages sometimes need no new external dependencies. | `pnpm-lock.yaml` lacks a new importer or package scripts do not participate in recursive checks. | CI fails on frozen install or misses Control API checks. | Run `pnpm install` if the workspace changes, verify `pnpm install --frozen-lockfile`, and add package scripts for recursive `typecheck`/`test`. |
| Implementation skills can be inferred later. | The task is clearly backend TypeScript with validation and tests. | Required skill workflows are skipped during implementation. | The implementation misses boundary, security, or testing concerns the global workflow requires. | Record required skills in the plan and load them before implementation edits. |
| Local deterministic checks are sufficient. | PR-006 has no deployed surface. | CI has package/build differences not exercised locally. | PR passes locally but fails in CI. | Run full root checks plus targeted Control API test/typecheck scripts; open PR and wait for CI before merge. |
| `PLAN.md` can be committed with implementation. | Global workflow requires plan/evidence tracking. | Plan is treated as temporary and omitted from PR. | Review loses rationale and evidence. | Keep `PLAN.md` updated through implementation and include final evidence before PR/merge. |

## Deterministic checks

Required checks:

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm test`
- `pnpm lint`
- `pnpm cdk synth`
- `pnpm --filter @agentcore-pdf-translator/control-api typecheck`
- `pnpm --filter @agentcore-pdf-translator/control-api test`

Targeted checks to add:

- Control API handler tests for job creation from ready versus unsupported documents.
- Control API handler tests proving job creation derives `enableImageTranslation` from `workflowVariant` and rejects caller-supplied `enableImageTranslation`.
- Control API handler tests proving comparison-group creation/join rules: generated group when requested, same-document join allowed, cross-document join rejected, and ungrouped job when omitted.
- Control API handler tests for run creation and no-op runtime invocation request shape.
- Control API handler tests for runtime invocation failure returning `AGENT_INVOCATION_FAILED` and persisting explicit failed state instead of a stuck queued run.
- Control API handler tests for second-attempt creation after a failed prior run while rejecting active, reviewable, accepted, rejected, escalated, and failed jobs.
- Control API handler tests for review accept/reject/escalate behavior and state guards.
- Control API handler tests rejecting stale-run review, parent job/run mismatch, duplicate review, missing evaluation evidence, and review when the parent job is not `AWAITING_REVIEW`.
- Control API handler tests proving human review creates a `HUMAN_REVIEW` ledger row.
- Control API handler tests proving human review creates a `reviewer_decision` stage event and that its stage sequence matches the ledger row.
- Control API handler tests proving human review cost uses `job.valueModel.humanReviewHourlyRateUsd` and rejects review-time hourly-rate override fields.
- Control API handler tests proving accepted, rejected, and multi-attempt job economics are calculated from `LedgerItem` records.
- Control API handler tests proving stored run/job rollup fields match ledger-derived rollups after review.
- Control API handler tests proving job-level ledger differs from run-level ledger.
- Control API handler tests proving active price-book resolution uses app settings and does not mutate historical job or ledger price-book versions.
- Control API handler tests proving workspace-scoped routes do not expose records from another workspace.
- Control API handler tests proving route dispatch handles method, path params, query params, validation errors, and unsupported methods.
- Control API handler tests proving existing runs with no evaluation return `evaluation: null`.
- Control API handler tests proving artifact responses include source/run artifact metadata without presigned URLs.
- Control API handler tests proving deferred upload/presign/inspect routes have no side effects if included.
- Request schema tests proving mutating endpoints reject missing, malformed, unknown, or out-of-range fields without writes, including non-empty run-start bodies.
- API error tests for missing document/job/run, invalid transition, unsupported document, validation error, and already-running job conflict.
- API error status tests for every Control API error code listed in this plan.
- Scope-control check before staging: `git status --short` and staged diff inspection must show no unrelated `apps/web/next-env.d.ts` changes in the PR.

## Deployed verification

Not applicable for PR-006. This slice explicitly excludes deployed AWS resources, Lambda, API Gateway, AgentCore Runtime, AgentCore Gateway, and persistent infrastructure.

If the implementation unexpectedly requires a deployed surface, stop and revise the plan because that work belongs to PR-007 or later.

## Telemetry verification

Not applicable for PR-006. No deployed runtime, AgentCore telemetry, CloudWatch telemetry, or queryable production signal is introduced.

Do not claim telemetry verification for this slice. Record it as not applicable in the final evidence.

## Implementation steps

1. Prepare implementation context.
   - Done when the `backend-patterns`, `typescript`, `testing`, and `security` skills have been loaded; `main` has been fetched/reconciled; and the existing unrelated `apps/web/next-env.d.ts` change is noted as out of scope.

2. Create branch `codex/control-api-skeleton`.
   - Done when the branch is based on current `main` and unrelated local changes are identified but not reverted.

3. Add the Control API package foundation.
   - Done when `/apps/control-api` has `package.json`, `tsconfig.json`, source/test directories, workspace scripts, lockfile/workspace metadata is consistent, and no AWS runtime dependency is introduced.

4. Define API handler primitives.
   - Done when request context, workspace context, route result, error code union, error envelope, status mapping, validation helpers, and route-dispatch types exist and compile.

5. Define boundary request/response schemas.
   - Done when route params, query strings, job creation, run start, review, and current price-book update inputs have shared Zod schemas and validation tests.

6. Compose an in-memory app context.
   - Done when handlers can receive isolated repositories, app settings, active price-book resolution, injected clock/ID generation, S3 key building, and the no-op runtime client without global mutable state.

7. Implement read handlers.
   - Done when tests can read documents, document jobs, jobs, job runs, job-level ledger, job economics, run details, timeline, artifact metadata, evaluation, run ledger, comparison groups, and current price book from in-memory repositories without presigned URL fabrication.

8. Implement job creation.
   - Done when ready documents can create `TranslationJob` records using the active price book and request value model, derive image-translation capability from workflow variant, apply explicit comparison-group rules, and reject unsupported or failed-inspection documents with structured API errors and no partial writes.

9. Implement run creation.
   - Done when the Control API creates `Run` records in `QUEUED`, assigns attempt numbers, prevents invalid concurrent starts, rejects terminal jobs, allows a later attempt only when prior attempts are terminal and the job remains non-terminal, preserves an already-`RUNNING` job status without inventing a new transition, records a no-op AgentCore invocation request containing only IDs, and handles invocation failure by marking explicit failed state.

10. Implement review decisions.
   - Done when only the latest run of an `AWAITING_REVIEW` job with a latest `EvaluationResult` can be accepted, rejected, or escalated; every valid decision creates `ReviewDecision`, `reviewer_decision` `StageEvent`, and `HUMAN_REVIEW` ledger records using the job value model review rate; run and job terminal states are applied; duplicate reviews are rejected; and economics are recalculated from ledger rows into stored run/job rollup fields.

11. Represent deferred endpoints safely.
   - Done when upload, presign, and inspection endpoints either remain outside the dispatcher or return explicit no-side-effect HTTP `501` not-implemented API errors.

12. Add targeted tests and run deterministic checks.
    - Done when the checks listed above pass locally and failures have been fixed at the root cause.

13. Assess refactoring.
    - Done when the `refactoring` skill has been loaded after green checks and any clarity/safety refactor is either applied or explicitly rejected as scope-widening.

14. Perform completion review and publish the PR.
    - Done when the implementation is reviewed against this plan, unrelated worktree changes are excluded, the commit contains only intended files, the branch is pushed, and a pull request is opened with validation evidence. The PR should not be merged until CI is green and the review confirms no forbidden modes, fake storage, fake inspection, hard-coded prices, hard-coded model IDs, or log-derived economics were introduced.

## Risks and constraints

- The skeleton could accidentally become fake product behavior. Upload, presign, inspection, AgentCore, and PDF operations must stay absent or explicitly not implemented with no side effects.
- Route code could duplicate schema and economics logic. Handlers should reuse shared packages instead of reimplementing domain rules.
- In-memory repositories could leak state between tests. Every test should construct a fresh app context.
- Run creation could blur business and technical boundaries. Job-level economics must remain separate from run attempts.
- Review handling could bypass state guards. Only `AWAITING_REVIEW` runs can receive review decisions.
- Human review cost could be treated as optional or free. Review decisions must create costed `HUMAN_REVIEW` ledger rows.
- Cost displays or responses could imply AWS bill reconciliation. PR-006 must label or structure economics as `PriceBook`-based estimates only.
- Adding model IDs in tests could hard-code product choices. Model references must come from configurable fixture data or `PriceBook`-related records.
- Returning logs or runtime invocation records as economics would violate the source-of-truth rule. Economics must come from `LedgerItem` rows.
- Frontend fixture state currently exists separately from the future API. Do not widen PR-006 into frontend integration unless a narrow contract test genuinely requires it.
- The existing state-transition references disagree about future remediation from rejected jobs. PR-006 should follow the repository-local `AGENTS.md` terminal-state rule and defer rejected/escalated remediation until the product explicitly defines it.
- Current repository interfaces are simple `put/get/list` ports, not transactional unit-of-work APIs. PR-006 handlers must validate before writing and keep write ordering small and test-covered so persistent repositories can later add conditional writes.
- Artifact access through presigned URLs is an accepted future ADR, but PR-006 has no S3 repository. Returning artifact metadata is acceptable; returning fabricated download URLs is not.
- `PUT /api/price-books/current` can accidentally rewrite cost assumptions for historical work. It must create or select the active price book for future jobs only.
- Start-run can fail after a run is created but before invocation succeeds. The implementation must avoid a stuck queued run by persisting failed state and returning `AGENT_INVOCATION_FAILED`.
- Review can accidentally accept an old run after a newer attempt exists. The implementation must require `job.latestRunId` to match the reviewed run.
- Missing evaluation is a normal pre-review state. Treating it as a hard error would make polling clients brittle.
- Staging can accidentally include the unrelated `apps/web/next-env.d.ts` modification currently in the worktree. Scope control before commit is mandatory.
- Adding a new workspace package without updating/validating the lockfile can break CI before tests run.
- Mutating endpoint bodies are a hidden API contract. If they are not schema-defined now, frontend integration will inherit accidental handler internals.
- Review-time hourly-rate overrides would let the review action change job economics outside the configured value model. PR-006 must reject that field.
- Accepting a run-start reason before there is a durable field would create false auditability. PR-006 must reject non-empty run-start bodies.
- Accepting caller-supplied `enableImageTranslation` would let API callers make workflow variants lie. PR-006 must derive this field from `workflowVariant`.
- Ambiguous comparison-group behavior can corrupt comparison economics. PR-006 must validate same-document grouping and avoid silent grouping.

## Rollback and Recovery Notes

- PR-006 introduces no deployed infrastructure, persistent data migration, or AWS resources. Rollback is a code revert of the Control API package, shared API schema additions, tests, lockfile/workspace metadata, and `PLAN.md` updates from the PR branch.
- If implementation discovers repository interfaces are too weak for correct behavior, stop and update this plan instead of adding ad hoc transactional abstractions inside handlers.
- If `pnpm install --frozen-lockfile` fails after adding `/apps/control-api`, update the lockfile through `pnpm install` and re-run the frozen install check. Do not bypass the frozen-lockfile check in CI.
- If the runtime-invocation failure behavior cannot be represented cleanly with current job/run states, narrow PR-006 to a recording no-op client only and document the invocation-failure behavior as a blocker for PR-009 instead of inventing a new state.

## Plan review gate

Initial review result: not HECK YES.

The first PR-006 plan had the right direction, but it was not specific enough to trust blindly. It did not name the full route coverage, left upload/presign/inspection deferral too ambiguous, under-specified workspace scoping, treated active price-book resolution too casually, did not pin down retry/remediation boundaries, and did not call out the partial-write risk created by simple in-memory repository interfaces.

Fixes applied:

- Added an explicit route coverage list and no-side-effect deferred-route behavior.
- Added workspace-scoped handler expectations.
- Added active price-book resolution through app settings and historical price-book immutability.
- Added retry/start-run boundaries for non-terminal jobs and explicitly deferred rejected/escalated remediation.
- Added no-partial-write expectations for validation failures.
- Added artifact metadata versus fabricated presigned URL guidance.
- Added targeted tests for route coverage, job-level ledger, active price book, workspace isolation, second attempts, and deferred endpoints.

Final review result: HECK YES.

- Scope challenged: the revised plan limits PR-006 to a local TypeScript Control API skeleton and explicitly excludes AWS infrastructure, persistent storage, real PDF behavior, frontend rewiring, fake storage, fake inspection, and all forbidden product modes.
- Implementation approach challenged: a pure handler package with injected repositories remains the smallest useful step because PR-007 can wrap it with Lambda/API Gateway and PR-008 can swap in DynamoDB/S3 repositories.
- Verification challenged: the revised required tests cover route errors, business state guards, run/job boundaries, review decisions, human review cost, ledger-derived economics, price-book behavior, workspace isolation, deferred endpoints, and second-attempt boundaries.
- Edge cases checked: unsupported documents, missing records, invalid transitions, already-running jobs, non-reviewable runs, accepted versus rejected economics, multi-attempt costs, cross-workspace reads, current price-book updates, no presigned URL fabrication, and deferred upload/inspection behavior are all explicit.
- Second-order consequences checked: the plan avoids adding API behavior that would later fight DynamoDB conditional writes, S3 artifact access, AgentCore invocation, or billing reconciliation.
- Simpler option considered: only adding route type definitions would be smaller, but it would not prove state transitions, review decisions, or economics behavior. The planned handler skeleton is still narrow and provides meaningful proof.
- Future compatibility checked: injecting repositories, app settings, workspace context, and a runtime client port keeps the design ready for DynamoDB/S3, Lambda/API Gateway, and AgentCore without coupling PR-006 to AWS runtime details.

## Adversarial final review

Review result before fixes: not HECK YES.

Failure imagined after implementing the prior plan:

- A runtime invocation throws after the API creates a queued run. The job remains `RUNNING`, the run remains `QUEUED`, and polling never resolves. The weakness was assuming the no-op client would always succeed. The plan now requires an invocation-failure path, failed-state persistence, and a test for `AGENT_INVOCATION_FAILED`.
- A stale `AWAITING_REVIEW` run is accepted after a newer attempt exists. The job economics attach the verified outcome to the wrong technical attempt. The weakness was only checking run status. The plan now requires parent job `AWAITING_REVIEW`, `latestRunId` matching the reviewed run, duplicate-review rejection, and tests for stale runs.
- A route returns a fabricated artifact download URL to satisfy the result-view contract before S3 exists. That would create fake product behavior and later conflict with the S3 repository. The plan now limits PR-006 artifact responses to metadata only and adds tests for no presigned URLs.
- `GET /api/runs/{runId}/evaluation` returns `404` or `500` for a queued run with no evaluation yet. Polling clients cannot distinguish pending work from missing data. The plan now requires `evaluation: null` for existing runs with no evaluation.
- `GET /api/price-books/current` chooses whichever price book has status `ACTIVE` when multiple records are active. Future jobs use ambiguous prices. The plan now makes `ACTIVE_PRICE_BOOK_VERSION` the primary source and requires `PRICE_BOOK_NOT_FOUND` for missing setting/version.
- The PR accidentally includes the existing `apps/web/next-env.d.ts` local change. Reviewers see unrelated churn and the branch may modify frontend metadata outside scope. The plan now requires staged-diff scope control before commit.
- Handler tests call functions directly but never exercise route parsing. API Gateway integration later discovers mismatched path/query/method behavior. The plan now requires route-dispatch tests for methods, params, query, validation, and unsupported methods.
- The new workspace package is added but `pnpm-lock.yaml` does not include it as an importer. CI fails on frozen install before any meaningful test runs. The plan now requires lockfile/workspace consistency and `pnpm install --frozen-lockfile`.
- Job creation accepts missing or misspelled value-model fields and silently uses defaults. Later economics look plausible but are based on the wrong business value. The plan now requires explicit request schemas and no silent business defaults.
- Implementation starts without loading the backend, TypeScript, testing, and security skills required by the global workflow for this kind of change. The plan now makes those skills an implementation prerequisite.
- Review accepts `humanReviewHourlyRateUsd` in the request and a reviewer unintentionally changes the cost basis for one decision. The plan now rejects review-time hourly-rate overrides and uses the job value model.
- Run start accepts a `reason` string, but no record stores it. An auditor later expects it and cannot find it. The plan now allows only omitted or empty run-start bodies.
- A run is `AWAITING_REVIEW` without an evaluation result and gets accepted. The plan now requires evaluation evidence before review.
- A caller creates a `V1_TEXT_ONLY` job with `enableImageTranslation: true`. Costs and behavior later look like V2 while labels say V1. The plan now derives image translation from workflow variant and rejects caller-supplied values.
- A comparison group accidentally includes jobs from two documents. The comparison view reports meaningless unit economics. The plan now requires same-document comparison-group validation.
- Review creates a ledger row but no timeline event. Ledger and timeline disagree. The plan now requires a `reviewer_decision` stage event tied to the review ledger.

After those fixes, the adversarial review result is HECK YES for planning readiness. Remaining uncertainty is implementation quality, not plan shape.

## Progress, blockers, and evidence

- PR-005 complete: pull request #2 was merged into `main`.
- Post-merge CI for PR-005 passed on `main`.
- Reconciled `main` after the AWS auth CI update and frontend fixture merge.
- Current next build-order item identified from `docs/codex/BUILD_ORDER.md`: PR-006, `Control API skeleton`.
- Read planning sources for PR-006:
  - `AGENTS.md`
  - `docs/codex/BUILD_ORDER.md`
  - `docs/08-implementation-backlog-v0.7.md`
  - `docs/06-frontend-api-contract-v0.5.md`
  - `docs/05-workflow-implementation-spec-v0.4.md`
  - `docs/11-codex-implementation-brief-v1.0.md`
  - `docs/10-adrs-v0.9.md`
- Loaded the requested `plan-next-phase` skill and applied it by replacing the stale PR-005 plan with this PR-006 plan.
- Loaded the requested `review-plan` skill and reviewed the PR-006 plan against repository instructions, API contracts, workflow specs, ADRs, reference docs, and the current package interfaces.
- Review found and fixed plan gaps around route coverage, deferred upload semantics, workspace scoping, active price-book resolution, retry/remediation boundaries, artifact URL fabrication, and partial-write risks.
- Loaded the requested `review-plan-adversarial` skill and performed a second adversarial review focused on assumptions, second-order consequences, hidden coupling, failure modes, and verification gaps.
- Adversarial review added explicit assumption challenges and fixed additional gaps around runtime invocation failure, stale-run review, duplicate review, missing evaluation responses, source artifact metadata, route-dispatch verification, active price-book ambiguity, and unrelated worktree staging risk.
- Re-ran the requested `review-plan-adversarial` skill as a third review. Added fixes for request-body contract ambiguity, workspace package/lockfile CI risk, required implementation skills, targeted Control API package checks, and no-silent-default validation for mutating endpoints.
- Re-ran the requested `review-plan-adversarial` skill as a fourth review. Added fixes for review evidence prerequisites, review-rate source of truth, run-start body semantics, explicit rollback/recovery notes, and HTTP `502` behavior for runtime invocation failure.
- Re-ran the requested `review-plan-adversarial` skill as a fifth review. Added fixes for workflow option derivation, comparison-group semantics, explicit API error status mapping, and reviewer-decision timeline evidence.
- Existing unrelated local modification observed before this plan update: `apps/web/next-env.d.ts`. Do not revert it unless explicitly requested.
- Loaded implementation skills for this backend TypeScript API change: `implement-plan`, `backend-patterns`, `typescript`, `testing`, `security`, and `refactoring`.
- Created branch `codex/control-api-skeleton` from current `main`; preserved the unrelated `apps/web/next-env.d.ts` worktree change out of scope.
- Added `/apps/control-api` as a framework-neutral TypeScript package with request/response primitives, injected workspace context, in-memory app context, route dispatcher, structured error mapping, and a recording AgentCore runtime client port.
- Added shared Control API boundary schemas in `packages/schemas/src/api.ts` for error codes, route params/query, job creation, run start, review decisions, and active price-book updates.
- Implemented in-memory Control API skeleton routes for documents, jobs, runs, timelines, artifact metadata, evaluations, ledgers, economics, comparison groups, and current price-book selection.
- Implemented safe deferred `501 NOT_IMPLEMENTED` responses for presign, document creation, and inspection routes with no fake storage or fake inspection behavior.
- Implemented job creation only for ready documents, using `ACTIVE_PRICE_BOOK_VERSION`, deriving image translation from `workflowVariant`, rejecting caller-supplied image-translation options, and enforcing explicit same-document comparison-group behavior.
- Implemented run creation as a technical attempt with active/reviewable/terminal job guards, ID-only runtime invocation requests, and explicit failed state plus `AGENT_INVOCATION_FAILED` when invocation fails.
- Implemented review decisions only for latest `AWAITING_REVIEW` runs with evaluation evidence, creating `ReviewDecision`, `reviewer_decision` `StageEvent`, and `HUMAN_REVIEW` ledger rows while calculating economics from ledger rows.
- Added targeted Control API tests covering job creation, workflow-option derivation, comparison groups, run start, runtime failure, review guards, human review economics, ledger scope, evaluation nullability, artifact metadata, workspace scoping, deferred routes, invalid dispatch inputs, active price-book immutability, and historical job price-book use for review ledger rows.
- Refactoring assessment after green checks: removed dead API helper scaffolding, tightened route param validation through shared schemas, typed comparison economics as `JobEconomicsRollup`, and avoided broader handler decomposition as unnecessary for this slice.
- Local deterministic evidence:
  - `pnpm install --frozen-lockfile` passed.
  - `pnpm --filter @agentcore-pdf-translator/control-api typecheck` passed.
  - `pnpm --filter @agentcore-pdf-translator/control-api test` passed: 11 tests passed.
  - `pnpm typecheck` passed.
  - `pnpm test` passed: schemas 3, data 10, costing 6, control-api 11, web 4 tests passed.
  - `pnpm lint` passed.
  - `pnpm cdk synth` passed.
- Deployed verification: not applicable for PR-006 because this slice introduces no deployed API, AWS resources, Lambda, AgentCore Runtime/Gateway, or telemetry surface.
- Telemetry verification: not applicable for PR-006 because no deployed runtime or queryable telemetry was introduced.
- Current blocker status: no implementation blocker; remaining work is scope-controlled staging, commit, push, PR creation, CI monitoring, and merge after green validation.
