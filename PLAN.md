# PLAN

## Objective

Implement PR-008: DynamoDB-backed repository implementations and an S3 artifact object repository for the unit-economics app, without wiring persistent behavior into the Control API yet.

## Scope and non-goals

In scope:

- Mark PR-007 as complete and identify the next uncompleted build-order item.
- Keep implementation scoped to persistence code, package configuration, exports, and tests needed for PR-008.
- Add DynamoDB repository implementations behind the existing repository interfaces in `/packages/data`.
- Add persistence mappers that convert domain schemas to DynamoDB items and back.
- Add deterministic DynamoDB key builders for all composite table and GSI keys introduced by PR-007.
- Add an S3 artifact object repository for artifact bytes and JSON objects, using the existing S3 key conventions.
- Keep artifact metadata in DynamoDB and artifact bytes in S3.
- Add an explicit object-store interface or port for S3 artifact bytes. Do not overload the existing `ArtifactRepository`, which is metadata-only in current code.
- Add repository factory/config types so later Control API code can instantiate persistent repositories from table names and bucket names.
- Add tests that prove query shape, key generation, pagination, schema validation, S3 operation shape, and guardrails.
- Update `PLAN.md` during implementation with progress, blockers, and evidence.

Out of scope:

- Control API persistent handlers.
- Lambda environment wiring from the PR-007 placeholder into real repositories.
- CDK permission changes for Control API data-plane access.
- AgentCore Runtime, AgentCore Gateway, Gateway targets, AgentCore Policy, or AgentCore Memory.
- Bedrock model calls, model configuration, PDF extraction, PDF recomposition, or evaluation.
- Frontend integration with a live API.
- DynamoDB streams, TTL, migrations, seed product data, or billing reconciliation.
- Replay mode, synthetic-run mode, live-capture mode, recording mode, presentation mode, or any fake product-facing run history.
- Storing raw PDF bytes in DynamoDB or passing raw PDFs through API, AgentCore, or Gateway contracts.

## Assumptions and open questions

- PR-007 is complete: PR #6 was merged to `main`, post-merge CI passed, and the final `PLAN.md` evidence commit passed CI.
- The next uncompleted build-order item is PR-008, `DynamoDB and S3 repositories`, from `AGENTS.md`, `docs/codex/BUILD_ORDER.md`, `docs/08-implementation-backlog-v0.7.md`, and `docs/11-codex-implementation-brief-v1.0.md`.
- PR-007 created the physical table/index names that PR-008 must target. PR-008 should not redesign infrastructure unless implementation proves a blocking mismatch.
- Existing repository interfaces are intentionally small and return full arrays. DynamoDB implementations must page internally until all matching items are returned.
- Existing in-memory repository behavior is the compatibility baseline only where it matches the documented product contracts. PR-008 must make repository ordering/duplicate-write behavior explicit and update in-memory tests if the contract is tightened.
- `PriceBookRepository.getActive()` needs a deterministic rule. Proposed rule: return `undefined` when no active price book exists, return the one active price book when exactly one exists, and throw a repository invariant error when multiple active price books are present. This avoids hiding price-book configuration corruption.
- `PriceBookRepository.getActive()` must query enough active rows to detect duplicates. A `Limit: 1` query would hide multiple-active corruption and is not acceptable.
- The Control API currently resolves the active price book through `AppSettings.ACTIVE_PRICE_BOOK_VERSION`, not `PriceBookRepository.getActive()`. PR-008 should keep both paths coherent: `AppSettings` remains the authoritative selected-current pointer for Control API behavior, while `getActive()` is a repository convenience that must still surface multiple-active corruption instead of silently choosing one row.
- Repository interfaces are not yet expressive enough for multi-record transactional business changes such as reviewer acceptance. PR-008 may add narrow persistence-specific conflict errors and conditional-write helpers where needed, but must not wire multi-record state transitions yet. PR-009 must explicitly design transactional or compensating behavior before using persistent repositories for review decisions, ledger writes, run status changes, and job economics updates.
- PR-008 can add AWS SDK v3 dependencies to `/packages/data`, but implementation must verify current package APIs locally before coding.
- Unit tests should not require live AWS credentials, live DynamoDB, or live S3. Use injected clients, fake senders, or package-local test doubles to verify commands and responses.
- S3 repository methods may accept bytes/streams at the repository boundary because that is the storage boundary, but no API, AgentCore, Gateway, or DynamoDB record may contain raw PDF bytes.
- Composite key timestamps must sort chronologically in DynamoDB. If a domain timestamp contains a non-UTC offset, key builders must canonicalize the key component to UTC ISO format while preserving the original domain field, or reject it with a clear repository validation error. Do not rely on mixed-offset timestamp strings for lexicographic sort order.
- Current MVP behavior assumes `workspaceId = ws_default`. Existing list interfaces are not consistently workspace-scoped, so PR-008 must preserve the domain `workspaceId` field and avoid claiming multi-workspace authorization. PR-009 must continue filtering/validating workspace ownership at the API boundary until repository interfaces are explicitly workspace-scoped.
- GSI reads are eventually consistent. PR-008 can provide strongly consistent reads only for primary-key `GetItem` or base-table queries where DynamoDB supports it. PR-009 must not rely on immediate GSI read-after-write visibility for product flows such as create job then list jobs.
- DynamoDB has item-size limits and is not the place for large JSON artifacts. PR-008 must keep artifact bytes and potentially large artifact JSON bodies in S3, with DynamoDB storing metadata and references only.
- AWS SDK-backed implementations can create dependency and bundling blast radius if exported from the root data package. Prefer a dedicated subpath export for persistent AWS implementations so existing root imports for interfaces, in-memory repositories, state guards, IDs, and S3 key builders stay lightweight.
- PR-008 may need to add AWS SDK v3 packages and update `pnpm-lock.yaml`. Implementation should add dependencies intentionally, then verify with `pnpm install --frozen-lockfile` after the lockfile is updated.
- AWS SDK packages needed at runtime by persistent repositories must be regular package dependencies, not dev-only dependencies.
- S3 read responses in AWS SDK v3 are body streams in Node. The S3 repository must handle the supported body shapes deliberately instead of assuming the body is already a string or `Uint8Array`.
- `PutCommand` behavior depends on marshalling configuration. PR-008 must configure or otherwise guarantee removal of `undefined` values before writes; tests should fail if optional domain fields are marshalled as undefined values.
- Optional GSI participation must be explicit. Optional indexed attributes such as `comparisonGroupId`, artifact `jobId`, artifact `runId`, and artifact `stageEventId` must be omitted when absent, not replaced with empty strings, `"undefined"`, `"null"`, or placeholder values.
- Repository contract tests should exercise shared semantics against both in-memory repositories and DynamoDB-backed repositories where practical. Otherwise the two adapters can drift while each passes isolated tests.
- Persistent repository factories must not silently fall back to ambient/default AWS configuration in tests or application code. They should require explicit region, table names, bucket name, and injected clients or client config. The region must be `us-east-1` unless a later ADR changes the product deployment region.
- Presign tests must not trigger default credential-provider resolution. Use injected presigner behavior, static dummy credentials, or a deterministic signer boundary so tests remain offline and reproducible.
- S3 artifact key inputs must be validated before reads, writes, and presign generation. Reject empty keys, leading slashes, `s3://` URLs, keys outside the documented `workspaces/` prefix, and traversal-like segments even though S3 treats keys as opaque strings.
- When an S3 operation has artifact metadata or expected identifiers available, validate that the S3 key segments match the expected workspace/document/job/run identifiers. Do not rely only on a broad `workspaces/` prefix check where stricter context exists.
- If repository methods apply workspace filtering in memory because the existing interface is not workspace-scoped, they must exhaust all DynamoDB query pages before filtering. Stopping after the first filtered page can silently drop later in-workspace records.
- Deployed verification is not expected for PR-008 because the repositories will not be wired into a deployed runtime path until PR-009.

## Expected outcomes

- `/packages/data` provides DynamoDB repository classes or a persistent repository factory through the dedicated persistent/AWS export boundary for:
  - `DocumentRepository`
  - `TranslationJobRepository`
  - `RunRepository`
  - `StageEventRepository`
  - `ArtifactRepository`
  - `LedgerItemRepository`
  - `EvaluationResultRepository`
  - `ReviewDecisionRepository`
  - `PriceBookRepository`
  - `AppSettingRepository`
- AWS-backed implementations are exported through an explicit persistent/AWS subpath or otherwise isolated so root package imports do not accidentally become AWS SDK/browser-hostile imports.
- Persistent repository factories validate required config at construction time, including `us-east-1` region, non-empty table names for all ten tables, and a non-empty artifact bucket name.
- Repository reads validate DynamoDB items with the shared Zod domain schemas before returning domain objects.
- Repository writes store domain fields plus only the persistence composite fields required by table keys and GSIs.
- Repository reads strip persistence-only composite attributes before returning domain objects.
- Repository writes remove `undefined` values before marshalling to DynamoDB.
- Repository writes never synthesize placeholder values for absent optional secondary-index attributes.
- Repository contracts document which `put` operations are replacement/upsert operations and which are create-if-absent append-only operations. In-memory repositories should be adjusted or tests should explicitly document any intentional difference.
- Repository list methods use `Query`, not `Scan`.
- Repository list methods query the documented table or GSI and exhaust pagination.
- Repository implementations expose explicit repository/invariant errors for malformed persisted rows, duplicate active price books, conditional conflicts, and S3 object decoding failures.
- Mutable aggregate records can be upserted where the current interface requires replacement semantics, but economic/product-event records must not be accidentally mutable:
  - `LedgerItem` rows are append-only economics evidence and should use create-if-absent or equivalent conflict detection.
  - `ReviewDecision` rows are append-only product events and should use create-if-absent or equivalent conflict detection.
  - `EvaluationResult` rows are append-only evaluation outputs and should use create-if-absent or equivalent conflict detection.
  - `Artifact` metadata should use create-if-absent unless implementation documents a concrete idempotent overwrite case.
  - `StageEvent` rows may be updated for stage progress, but updates must keep the same primary key and pass schema validation.
- List ordering is deterministic and tested as repository contract, not an accidental side effect of either in-memory maps or DynamoDB indexes:
  - documents by workspace: created time ascending
  - jobs by document: created time ascending
  - jobs by comparison group: workflow variant order for comparison displays, then created time
  - jobs by status: updated time ascending
  - runs by job: attempt number ascending, then created time
  - runs by document/status: created or updated time ascending as keyed
  - stage events by run: sequence ascending
  - artifacts by run/document: created time ascending unless a later UI contract requires type grouping
  - artifacts by job: created time ascending
  - ledger items by run: stage sequence, then created time
  - ledger items by job/document/component type: created time ascending
  - evaluation results by run: created time ascending
  - review decisions by job: created time ascending
- `PriceBookRepository.getActive()` does not use a table scan and does not silently pick an arbitrary active row.
- The S3 artifact object repository writes and reads object bytes/JSON through S3 and can generate presigned GET/PUT URLs where needed by later API work.
- The S3 artifact object repository is a separate object-store port from DynamoDB `ArtifactRepository` metadata. Its API should make the byte-vs-metadata boundary obvious.
- S3 presign helpers require an explicit operation, key, content type for upload, and short expiration. They must not presign broad prefixes, public ACLs, or arbitrary `s3://...` URLs.
- S3 key validation rejects keys that are not generated by or compatible with the documented S3 key conventions.
- JSON artifact helpers validate parsed JSON with a caller-supplied schema or parser before returning structured data.
- S3 object operations use S3 keys and bucket names, not `s3://...` strings.
- S3 object read helpers correctly handle Node stream bodies and return deterministic repository errors for unsupported body types.
- DynamoDB items stay below the business-record boundary: no raw artifact bytes, no base64 PDF payloads, no full translated PDF content, and no large artifact JSON bodies.
- No repository calculates economics from logs, traces, CloudWatch, or SDK metadata.
- No hard-coded model IDs, prices, fake ledgers, replay/synthetic/live-capture modes, or product seed histories are introduced.
- Root checks remain green.

## Product design

PR-008 is a persistence-boundary slice. It should make the product's documented domain model durable while leaving user-visible workflow behavior unchanged until PR-009 wires the Control API to these repositories.

The product model remains:

```text
Document -> TranslationJob -> Run -> StageEvents / Artifacts / LedgerItems -> EvaluationResult -> ReviewDecision -> Job economics
```

`TranslationJob` remains the business unit. `Run` remains a technical attempt. `LedgerItem` records remain the source of truth for economics.

The repository package should expose persistent implementations that can be swapped in wherever the existing interfaces are consumed. Application code should not need to know DynamoDB key details or S3 presigning mechanics. Those are persistence concerns.

PR-008 should not overpromise transactional product behavior. A repository `put` can prove one durable item write, and a query can prove one access pattern, but reviewer acceptance and job finalization are multi-record business transactions. The plan for PR-009 must explicitly decide whether to use DynamoDB transactions, conditional updates, idempotency keys, or compensating retries before persistent Control API behavior is enabled.

AWS-specific code should be isolated behind a deliberate export boundary. The current root `@agentcore-pdf-translator/data` import is used by the Control API for in-memory repositories, interfaces, state guards, and ID helpers. Pulling DynamoDB/S3 SDK modules into that root path would be a hidden coupling and could become a frontend bundling problem if later UI code imports shared data helpers. Prefer a package subpath such as `@agentcore-pdf-translator/data/aws` or `@agentcore-pdf-translator/data/persistent` for AWS-backed implementations.

PR-008 should establish repository contract tests that are adapter-neutral. The in-memory adapter and the DynamoDB adapter should agree on externally visible ordering and return shapes unless the plan deliberately records a difference. For example, comparison views expect V1/V2/V3 row ordering, while artifact lists currently behave like created-time timelines. The DynamoDB physical GSI sort key can be used for efficient query shape, but adapter methods may still sort returned arrays after query if that is needed to preserve the repository contract.

Optional index fields must reflect real relationships, not placeholders. Jobs without a `comparisonGroupId` should not appear in `byComparisonGroup`. Source-document artifacts without a `jobId` or `runId` should not appear in job/run artifact indexes. DynamoDB mappers should omit absent optional key attributes entirely so sparse GSIs stay sparse and meaningful.

Persistent repository construction should be explicit. Do not let implementation code discover region, table names, or buckets implicitly from process environment deep inside repository classes. The future Lambda adapter can translate environment variables into validated repository config in PR-009. PR-008 should expose constructors/factories that receive explicit config and clients or client config.

Suggested package shape:

```text
packages/data/src/dynamodb/client.ts
packages/data/src/dynamodb/errors.ts
packages/data/src/dynamodb/keys.ts
packages/data/src/dynamodb/mappers.ts
packages/data/src/dynamodb/pagination.ts
packages/data/src/dynamodb/repositories.ts
packages/data/src/s3-artifacts.ts
packages/data/src/persistent.ts
packages/data/test/dynamodb-repositories.test.ts
packages/data/test/dynamodb-keys.test.ts
packages/data/test/s3-artifacts.test.ts
```

The DynamoDB physical design must match PR-007:

```text
Documents: PK documentId; GSI byWorkspace workspaceId / createdAtDocumentId
TranslationJobs: PK jobId; GSIs byDocument, byComparisonGroup, byStatus
Runs: PK runId; GSIs byJob, byDocument, byStatus
StageEvents: PK runId; SK sequencePaddedStageNameStageEventId
Artifacts: PK artifactId; GSIs byRun, byDocument, byJob
LedgerItems: PK runId; SK stageSequencePaddedCreatedAtLedgerItemId; GSIs byJob, byDocument, byComponentType
EvaluationResults: PK runId; SK createdAtEvaluationResultId
ReviewDecisions: PK jobId; SK createdAtReviewDecisionId
PriceBooks: PK priceBookVersion; GSI byStatus status / updatedAtPriceBookVersion
AppSettings: PK settingKey
```

Composite attributes are persistence-layer fields. They should not become product schema fields unless a later requirement proves that shared persistence schemas are needed.

Composite sort keys should use a single documented delimiter and canonical key components. Numeric components must be zero-padded. Timestamp components must be canonical UTC ISO strings so DynamoDB lexicographic sort order matches chronology. Domain timestamps may still retain the original schema-valid value.

Repository reads should be explicit about consistency. Primary-key `get` operations can request strongly consistent reads. GSI list methods cannot. That limitation must be visible in code/tests and handed off to PR-009 so API workflows do not infer read-your-write guarantees from repository existence.

When an API layer later filters repository results by `workspaceId`, correctness requires complete query results first. Repository helpers should therefore exhaust pagination before any client-side filtering. If implementation adds any optional filter predicate helper, tests must prove filtering does not stop pagination early.

Repository writes should be explicit about replacement semantics. Aggregate records such as `Document`, `TranslationJob`, `Run`, `StageEvent`, `PriceBook`, and `AppSetting` may need replacement/upsert semantics because current Control API code updates them through `put`. Append-only evidence records such as `LedgerItem`, `ReviewDecision`, and `EvaluationResult` should be create-if-absent. Artifact metadata should default to create-if-absent, with any idempotent overwrite case documented and tested.

The S3 repository should operate on object keys built by `s3-keys.ts`, preserve content type metadata, and keep bytes out of DynamoDB. JSON helpers are acceptable for artifact JSON files, but they must still store objects in S3 and parse/return JSON through explicit repository calls with validation. S3 key validation is a defense-in-depth boundary for future API code: repository methods should accept documented artifact keys, not arbitrary URLs, absolute paths, or prefix-wide access requests.

## Deterministic checks

Required local checks for implementation:

- `pnpm install --frozen-lockfile`
- `pnpm --filter @agentcore-pdf-translator/data typecheck`
- `pnpm --filter @agentcore-pdf-translator/data test`
- `pnpm typecheck`
- `pnpm test`
- `pnpm lint`
- `pnpm cdk synth`
- `git diff --check`

Targeted tests to add or update:

- Composite key builders produce exactly the PR-007 physical key attributes, including padded numeric prefixes for attempt numbers, stage-event sequences, and ledger stage sequences.
- Composite key builders canonicalize or reject mixed-offset timestamps so key ordering is chronological, with tests for a non-UTC offset timestamp.
- Domain-to-DynamoDB mappers include all domain fields, required composite fields, and no raw bytes.
- Mapper tests reject or flag large artifact payload-shaped properties such as `body`, `bytes`, `base64`, `pdfBytes`, or `content` if they are accidentally introduced into DynamoDB items.
- Mapper tests prove absent optional GSI attributes are omitted entirely and never serialized as empty strings or stringified nullish placeholders.
- DynamoDB-to-domain mappers validate with shared schemas, strip persistence-only fields from returned objects, and reject malformed records.
- `put` methods send `PutCommand` requests to the correct table with the expected item shape.
- Optional fields are removed before marshalling or the DynamoDB document client is configured with equivalent `removeUndefinedValues` behavior.
- Append-only repositories use conditional expressions or equivalent conflict detection for ledger items, review decisions, evaluation results, and artifact metadata.
- Adapter-neutral repository contract tests cover ordering and duplicate-write behavior for both in-memory and DynamoDB-backed implementations where practical.
- `get` methods send `GetCommand` requests by primary key, use strongly consistent reads where appropriate, and return `undefined` for missing records.
- List methods send `QueryCommand` requests with the correct table/index/key condition and never send `ScanCommand`.
- GSI list-method tests assert no invalid `ConsistentRead` setting is used on GSI queries and document eventual consistency.
- Query expressions use expression attribute names/values rather than interpolating caller input into expressions.
- Query pagination is exhausted when `LastEvaluatedKey` is present.
- `PriceBookRepository.getActive()` queries `PriceBooks.byStatus`, returns the single active price book, returns `undefined` for none, and throws on multiple active rows.
- `PriceBookRepository.getActive()` tests prove duplicate detection is not bypassed by a one-row query limit.
- `AppSettingRepository` supports `ACTIVE_PRICE_BOOK_VERSION` as the authoritative selected-current pointer used by the current Control API design.
- Persistent factory/config tests reject missing table names, missing bucket names, unsupported regions, and accidental env-only construction.
- S3 repository write/read methods send the expected S3 commands with bucket, key, content type, and body.
- S3 key validation tests reject empty keys, leading slash keys, `s3://` values, non-`workspaces/` prefixes, and traversal-like segments.
- Contextual S3 key validation tests reject keys whose workspace/document/job/run segments do not match supplied metadata or expected IDs.
- S3 read helpers handle Node stream bodies, `Uint8Array` bodies, and string bodies where supported.
- S3 read helpers surface missing objects, unsupported body types, and invalid JSON as repository errors rather than generic SDK exceptions where possible.
- Presigned URL methods build GET/PUT commands without making live AWS calls in tests, require explicit expiration, use static dummy credentials or injected signer behavior, and do not allow ACLs or wildcard prefixes.
- Package export tests or typecheck coverage prove AWS-backed implementations are importable from their intended subpath without breaking existing root imports.
- Package export tests prove root `@agentcore-pdf-translator/data` imports do not expose or require AWS SDK-backed runtime modules.
- Repository tests prove `LedgerItem` rows remain the source for cost data and are not replaced by logs or SDK metadata.
- Guardrail tests assert no forbidden mode strings such as `LIVE_CAPTURE`, `REPLAY_CAPTURED`, or `SYNTHETIC_SEED` are introduced.

## Deployed verification

No deployed verification is planned for PR-008.

Reason: PR-008 creates repository implementations and S3 object persistence utilities, but does not wire them into the Control API Lambda or any deployed product request path. The repository currently has CI-backed synth, not a CI-backed deployment workflow for this slice.

If implementation discovers an existing CI-backed deployment path and wires no product behavior to it, do not treat deployment as completion evidence. Use deterministic tests and synth for PR-008, then defer direct product-path verification to PR-009.

## Telemetry verification

Telemetry verification is not applicable for PR-008.

Reason: this slice does not introduce a deployed runtime flow, AgentCore execution, CloudWatch application signal, or product request that can be isolated by trace ID, request ID, build ID, or commit SHA. Repository code must not use telemetry as the source of economics truth.

## Implementation steps

1. Confirm baseline:
   - Verify `main` is clean.
   - Load the required implementation skills before code edits: `backend-patterns`, `typescript`, `testing`, and `security`; use `refactoring` after checks are green.
   - Run or inspect the current checks enough to know the repository starts from the completed PR-007 state.
   - Done when the baseline state and any pre-existing failures are recorded in `PLAN.md`.

2. Add persistence configuration and errors:
   - Add DynamoDB table-name config types and repository-specific errors.
   - Add S3 artifact repository config types.
   - Add explicit errors for not found only where useful, conditional conflicts, repository invariants, malformed persisted rows, and S3 artifact decoding.
   - Add a deliberate export boundary for AWS-backed implementations.
   - Add config validation for region, table names, bucket name, and injected clients/client config.
   - Done when the types are exported and covered by typecheck.

3. Add DynamoDB key builders and mapper tests:
   - Implement composite key builders for every PR-007 table/index key.
   - Implement domain-to-item and item-to-domain mappers.
   - Add undefined-field stripping or marshalling configuration coverage.
   - Done when tests prove exact key names, padding, sparse optional-index behavior, schema validation, undefined handling, and no raw bytes in DynamoDB items.

4. Implement shared DynamoDB helpers:
   - Add a pagination helper for query-all behavior.
   - Add small command helper utilities if they reduce duplication without hiding table/index choices.
   - Add conditional-write support for append-only rows and idempotency/conflict behavior.
   - Add consistency behavior explicitly: strong reads where supported, documented eventual consistency for GSI queries.
   - Done when tests cover multi-page query behavior, including complete pagination before any client-side filtering.

5. Implement entity repositories:
   - Implement persistent repositories for documents, jobs, runs, stage events, artifacts, ledger items, evaluations, reviews, price books, and app settings.
   - Preserve existing interface semantics.
   - Add shared repository contract tests for in-memory and persistent implementations, or document exactly why a behavior is intentionally adapter-specific.
   - Do not claim multi-record Control API transitions are atomic; record the PR-009 transaction requirement in `PLAN.md`.
   - Done when each interface has a DynamoDB implementation and tests prove primary get/put/list behavior.

6. Implement S3 artifact object repository:
   - Add byte/object read-write methods and presigned URL helpers for future API work.
   - Keep it separate from artifact metadata repositories.
   - Define and export a clearly named object-store interface or port, such as `ArtifactObjectStore`, so callers do not confuse it with metadata `ArtifactRepository`.
   - Require explicit content type for uploads and explicit expiration for presigned URLs.
   - Handle supported S3 body shapes and classify unsupported bodies.
   - Validate S3 keys before object operations and presign operations.
   - Done when tests prove command shape and no live AWS dependency.

7. Export factories:
   - Export a factory that creates all persistent repositories from injected AWS SDK clients and table/bucket config.
   - Keep environment variable reading out of deep repository code.
   - Done when later API code can instantiate repositories without importing individual implementation classes unless desired.

8. Run deterministic checks:
   - Run the package and root checks listed above.
   - Fix any failures inside PR-008 scope.
   - Done when all required checks pass or blockers are recorded precisely.

9. Review and finalize:
   - Review for scope creep, security, maintainability, and product-model alignment.
   - Update `PLAN.md` with final evidence.
   - Prepare the branch/PR only after checks are green.

## Risks and constraints

- DynamoDB key drift: if mapper key names do not match PR-007 table/index names, PR-009 will fail at runtime. Tests must assert exact names.
- Silent scans: using `Scan` would hide missing indexes and become expensive. Tests must reject `ScanCommand`.
- Pagination loss: list methods returning only the first page would lose business records and understate economics. Tests must cover pagination.
- Adapter drift: in-memory and DynamoDB repositories could return different ordering or duplicate-write behavior. Contract tests must make adapter-visible behavior explicit.
- Price-book ambiguity: silently choosing one active price book could make costs non-deterministic. `getActive()` must surface multiple-active corruption.
- Price-book duplicate masking: querying only one active row can hide duplicate active price books. Query enough rows to prove there is at most one active record.
- Price-book authority drift: `PriceBooks.status=ACTIVE` and `AppSettings.ACTIVE_PRICE_BOOK_VERSION` can disagree. PR-008 should expose both accurately and PR-009 must decide how updates keep them coherent.
- Schema drift: returning raw DynamoDB items without Zod parsing could leak persistence fields or malformed records into business logic.
- Timestamp sort drift: mixed-offset timestamps can sort incorrectly if used verbatim in DynamoDB sort keys. Key builders must canonicalize or reject them.
- GSI consistency drift: a flow can write an item and immediately query a GSI, then incorrectly think the item is missing. PR-009 must use returned write results, primary-key reads, retries, or clear eventual-consistency handling.
- Item-size drift: storing full artifact JSON or base64 payloads in DynamoDB could exceed item limits and violate the product boundary. Store content in S3 and metadata in DynamoDB.
- Event mutability: overwriting ledger, review, evaluation, or artifact rows can rewrite business evidence. Append-only rows need conflict detection.
- Transaction gap: PR-008 repositories alone do not make reviewer acceptance atomic. PR-009 must not wire persistent review behavior until transaction or compensation behavior is designed and tested.
- Workspace leakage: current repository list interfaces are not all workspace-scoped. Persistent repositories must preserve `workspaceId`, and API handlers must keep workspace checks until interfaces are strengthened.
- Raw PDF leakage: repositories must never put PDF bytes or base64 payloads into DynamoDB items.
- Economics drift: logs, AWS SDK metadata, and CloudWatch cannot become the source of economic truth; only `LedgerItem` records can.
- Scope creep: PR-008 must not wire persistent behavior into the Control API or grant Lambda data-plane permissions. That belongs to PR-009.
- Export coupling: putting AWS SDK-backed modules behind the root data export could make unrelated imports load AWS SDK code and create future browser-bundling failures.
- S3 orphan risk: future flows that write S3 bytes and then fail DynamoDB metadata writes can leave orphaned objects. PR-009 must define idempotency or cleanup behavior before enabling upload/create-document flows.
- Lockfile/dependency drift: AWS SDK dependencies must be added intentionally and verified with a frozen install after lockfile update.
- Dependency classification drift: runtime AWS SDK packages placed in devDependencies can pass local tests and fail downstream consumers. Persistent repository dependencies belong in dependencies.
- Undefined marshalling drift: optional `undefined` values can fail DynamoDB document marshalling or be stored inconsistently unless removed/configured.
- Sparse-index drift: absent optional relationships serialized as empty strings or placeholders can pollute GSIs, break relationship queries, or fail DynamoDB key validation. Omit absent optional indexed attributes.
- Region/config drift: repositories instantiated with missing config or the wrong AWS region can pass unit tests but fail against the deployed `us-east-1` infrastructure. Validate config at construction.
- Credential-resolution drift: presign tests that accidentally use default credential resolution can pass on one machine and fail in CI. Use static dummy credentials or injected signer behavior.
- S3 key-boundary drift: generic key strings can later allow presigning or reading objects outside intended workspace artifact prefixes. Validate keys in repository methods.
- Artifact boundary drift: combining S3 bytes/presign behavior into metadata `ArtifactRepository` can blur the rule that DynamoDB holds metadata and S3 holds bytes. Keep the object-store port separate and clearly named.
- Filter-pagination drift: client-side workspace filtering before exhausting DynamoDB pages can drop records. Always exhaust query pages before filtering.
- SDK body-shape drift: S3 body handling can pass tests with fake strings but fail against real Node streams unless stream body handling is tested.
- AWS SDK test fragility: tests should prove command intent through injection/test doubles without live AWS calls.
- Security: S3 presign helpers are security-sensitive because they enable object access. Implementation must keep expiration explicit, avoid broad keys, and load the `security` skill when implementing.

## Progress, blockers, and evidence

- Completed prior phase: PR-007, CDK storage/database/API basics.
- PR-007 evidence:
  - PR #6 merged to `main`.
  - Merge commit: `ebc402f`.
  - Final evidence commit: `795b256`.
  - Post-merge CI passed.
- Next phase identified: PR-008, DynamoDB and S3 repositories.
- Planning source checked:
  - `AGENTS.md`
  - `docs/codex/BUILD_ORDER.md`
  - `docs/11-codex-implementation-brief-v1.0.md`
  - `docs/04-data-model-and-contracts-v0.3.md`
  - `docs/05-workflow-implementation-spec-v0.4.md`
  - `docs/07-infrastructure-cdk-spec-v0.6.md`
  - `docs/08-implementation-backlog-v0.7.md`
  - `docs/reference/S3_ARTIFACT_KEYS.md`
  - `docs/reference/ENTITY_MODEL.md`
  - `docs/codex/GUARDRAILS.md`
- Plan review pass 1:
  - Found gaps around active price-book behavior, DynamoDB pagination, `Scan` avoidance, S3 presign testing, and raw-byte boundaries.
  - Updated the plan to make those requirements explicit.
- Plan review pass 2:
  - Scope is specific to PR-008.
  - Verification is deterministic and does not require live AWS.
  - Forbidden product modes, hard-coded prices/model IDs, raw PDF storage, and log-based economics are explicitly excluded.
- Review-plan pass 3:
  - Initial answer was not 100% satisfied.
  - Found second-order risks around active price-book authority, non-atomic future Control API updates, timestamp sort-key drift, workspace scoping assumptions, append-only economics/product-event rows, S3 presign boundaries, and JSON artifact validation.
  - Updated the plan to make those requirements and PR-009 handoff constraints explicit.
  - Current answer after fixes: satisfied that the plan is specific, scoped, verifiable, and aligned with the product architecture for PR-008.
- Adversarial review pass 4:
  - Assumption: PR-007's table/index design is the right persistence target. Evidence: PR-007 is merged and the table design matches repository access patterns. Could be false if a PR-007 key name or GSI is wrong. Breakage: PR-008 repositories synthesize commands that do not match deployed tables. Plan response: exact key/index mapper tests and no infrastructure redesign unless a blocking mismatch is documented.
  - Assumption: current repository interfaces are sufficient for PR-008. Evidence: in-memory repos and Control API skeleton already use them. Could be false for conditional writes, transactions, and workspace scoping. Breakage: persistent behavior looks compatible but loses atomicity or tenant boundaries. Plan response: add repository errors/conditional helpers, preserve workspace fields, and explicitly defer multi-record transaction design to PR-009.
  - Assumption: array-returning list methods are acceptable for MVP. Evidence: current interfaces return arrays and MVP data volume is small. Could be false as history grows. Breakage: unbounded memory/latency. Plan response: page internally for correctness now and leave public pagination/API shape to later product work.
  - Assumption: DynamoDB GSI queries can back list methods. Evidence: PR-007 created matching GSIs. Could be false for immediate read-after-write because GSIs are eventually consistent. Breakage: PR-009 creates a job/run and list endpoints appear stale. Plan response: document GSI eventual consistency, avoid invalid strong-read settings on GSIs, and require PR-009 to use returned write results, primary-key reads, retries, or explicit consistency handling.
  - Assumption: DynamoDB can store all domain records directly. Evidence: schemas model metadata and normalized economics rows. Could be false if large artifact JSON or raw payloads enter domain objects. Breakage: item-size failures and raw PDF/product-boundary violations. Plan response: guard mappers against payload-shaped fields, keep large content in S3, and store only metadata/references in DynamoDB.
  - Assumption: timestamp strings sort chronologically. Evidence: schemas require ISO datetimes. Could be false with non-UTC offsets. Breakage: timelines and ledgers query in the wrong order. Plan response: canonicalize or reject mixed-offset timestamps for key components.
  - Assumption: `PriceBooks.status=ACTIVE` and `AppSettings.ACTIVE_PRICE_BOOK_VERSION` can coexist cleanly. Evidence: current Control API uses the app setting and PR-007 added `PriceBooks.byStatus`. Could be false if they disagree. Breakage: costs use a different price book than settings show. Plan response: keep app setting as selected-current authority, make `getActive()` surface duplicate-active corruption, and require PR-009 to define update coherence.
  - Assumption: append-only business evidence can use current `put` methods safely. Evidence: current code writes generated IDs once. Could be false if a duplicate ID overwrites a ledger/review/evaluation row. Breakage: economics or reviewer evidence is rewritten. Plan response: use create-if-absent/conflict detection for append-only rows and document any intentional idempotent overwrite.
  - Assumption: S3 object operations can be tested without live AWS. Evidence: command-shape tests can use injected clients. Could be false if fake bodies do not match AWS SDK runtime body streams. Breakage: S3 reads pass tests and fail in Lambda. Plan response: test supported body shapes, classify unsupported bodies, and avoid live AWS dependency.
  - Assumption: presigned URLs are harmless repository utilities. Evidence: future API needs them. Could be false if helpers allow broad keys, ACLs, long expirations, or missing upload constraints. Breakage: object access escapes intended boundaries. Plan response: require explicit operation/key/content type/expiration, no ACLs, no prefixes, and security review before implementation.
  - Assumption: adding AWS SDK dependencies to `/packages/data` has limited blast radius. Evidence: only Control API currently imports the data package. Could be false if root exports load AWS SDK modules for every consumer or future frontend imports data helpers. Breakage: browser bundling and dependency weight issues. Plan response: isolate AWS-backed implementations behind a deliberate package subpath.
  - Assumption: PR-008 does not need deployed verification. Evidence: no deployed product path will use the repositories until PR-009. Could be false if implementation secretly wires Control API persistence. Breakage: unverified deployed stateful behavior. Plan response: keep Control API wiring and IAM grants out of scope; if they are added, update plan and verification requirements first.
  - Imagined failure after implementation: root imports of `@agentcore-pdf-translator/data` start loading AWS SDK modules and later break a web build. Prevented by the subpath export requirement.
  - Imagined failure after implementation: `listByJob()` misses a just-created run due to GSI eventual consistency. Prevented by consistency notes and PR-009 handoff requirements.
  - Imagined failure after implementation: a duplicate `LedgerItem` ID overwrites economic evidence. Prevented by append-only conditional writes.
  - Imagined failure after implementation: S3 JSON reads pass tests with string fakes but fail on Lambda stream bodies. Prevented by explicit body-shape tests.
  - Imagined failure after implementation: a full JSON artifact is accidentally persisted into DynamoDB and exceeds item limits. Prevented by mapper guardrails and S3-only content storage.
- Adversarial review pass 5:
  - Assumption: in-memory behavior and DynamoDB index order can both be treated as the repository contract. Evidence: existing in-memory repos sort mostly by `createdAt`, while PR-007 GSIs sometimes sort by type or workflow variant. Could be false because comparison views expect variant order and artifact timelines may expect created order. Breakage: local tests and persistent behavior disagree. Plan response: require adapter-neutral repository contract tests and explicitly define ordering.
  - Assumption: append-only conflict detection can fit behind existing `put` methods without behavior drift. Evidence: generated IDs are normally unique. Could be false on retries or duplicate IDs. Breakage: in-memory silently overwrites while DynamoDB throws, or DynamoDB silently overwrites evidence. Plan response: document replacement vs append-only semantics and test duplicate-write behavior across adapters where practical.
  - Assumption: removing `undefined` values is just an implementation detail. Evidence: schemas use many optional fields. Could be false because DynamoDB document marshalling can reject undefined values or persist unexpected shapes depending on configuration. Breakage: writes fail only for records with omitted optional fields. Plan response: require undefined stripping or equivalent marshalling config and tests.
  - Assumption: subpath exports alone prevent AWS SDK coupling. Evidence: package exports can isolate runtime modules. Could be false if root `index.ts` re-exports persistent modules or type/value exports accidentally import SDK code. Breakage: existing root imports become AWS SDK/browser-hostile. Plan response: package export tests must prove root imports stay clean and AWS-backed implementations are only imported through the intended subpath.
- Adversarial review pass 6:
  - Assumption: repository constructors can rely on later environment wiring. Evidence: PR-009 will own Lambda env integration. Could be false if PR-008 hides env reads inside repository classes. Breakage: tests pass locally but deployed code talks to the wrong region/table/bucket. Plan response: explicit validated config and injected clients/client config, with `us-east-1` enforcement.
  - Assumption: presign tests will remain offline by default. Evidence: command-shape tests can be local. Could be false if `getSignedUrl` triggers default credential-provider resolution. Breakage: CI fails or local tests depend on developer AWS credentials. Plan response: static dummy credentials or injected signer behavior in tests.
  - Assumption: S3 keys are safe opaque strings. Evidence: S3 treats keys as object names. Could be false at the product boundary because future API input may be attacker-controlled. Breakage: presigned URLs expose arbitrary bucket objects or non-artifact prefixes. Plan response: validate documented artifact key shape before reads/writes/presign.
  - Assumption: runtime AWS SDK dependencies can be added anywhere. Evidence: tests compile with devDependencies. Could be false for downstream runtime packages. Breakage: persistent repositories import missing SDK packages when consumed outside tests. Plan response: runtime SDK packages must be package dependencies.
  - Assumption: client-side filtering after query is straightforward. Evidence: current API filters by `workspaceId` after repository calls. Could be false if filtering is applied per page and stops too early. Breakage: later pages containing valid workspace records disappear. Plan response: exhaust pagination before filtering and test that behavior.
  - Imagined failure after implementation: a developer runs tests with AWS credentials and presign tests pass, but CI has no credentials and fails. Prevented by static dummy credentials or signer injection.
  - Imagined failure after implementation: PR-009 instantiates repositories without a region and SDK defaults differ from `us-east-1`. Prevented by required explicit region validation.
  - Imagined failure after implementation: `/api/runs/{runId}/artifacts` accepts an artifact key and presigns `workspaces-other/...` or `s3://...`. Prevented by S3 key validation before presigning.
- Adversarial review pass 7:
  - Assumption: `ArtifactRepository` can naturally absorb S3 object behavior. Evidence: older docs mention `ArtifactRepo.createPresignedGetUrl`, but current code's `ArtifactRepository` is metadata-only. Could be false because mixing bytes and metadata blurs the S3/DynamoDB boundary. Breakage: future code stores bytes in DynamoDB-adjacent abstractions or hides presign security inside metadata reads. Plan response: require a separate clearly named object-store port.
  - Assumption: active price-book duplicate detection is guaranteed by querying `byStatus`. Evidence: `PriceBooks.byStatus` exists. Could be false if implementation uses `Limit: 1`. Breakage: duplicate active price books are silently ignored and costs become non-deterministic. Plan response: query enough rows to detect duplicates and test that behavior.
  - Assumption: `workspaces/` prefix validation is sufficient for S3 keys. Evidence: all documented keys begin with `workspaces/`. Could be false when a caller has expected metadata and supplies another workspace/job/run key inside the same prefix. Breakage: presigned URLs expose the wrong artifact. Plan response: validate key segments against expected IDs when context exists.
- Adversarial review pass 8:
  - Assumption: optional indexed attributes can be handled by generic undefined stripping. Evidence: many optional fields are already covered by undefined handling. Could be false if key-builder code replaces absent optional relationships with empty strings or `"undefined"` to build GSI sort keys. Breakage: jobs without comparison groups appear in bogus index partitions, source artifacts appear under fake job/run IDs, or DynamoDB rejects empty key attributes. Plan response: require sparse optional-index behavior and mapper tests for absent `comparisonGroupId`, artifact `jobId`, artifact `runId`, and artifact `stageEventId`.
  - Assumption: saying `/packages/data` exports persistent classes is compatible with root-import isolation. Evidence: package-level exports can include subpaths. Could be false if implementation interprets it as root `index.ts` re-exporting AWS classes. Breakage: root imports load AWS SDK modules. Plan response: wording now says persistent classes/factories are provided through the dedicated persistent/AWS export boundary.
  - Imagined failure after implementation: `listByComparisonGroup("undefined")` returns jobs that never joined a comparison group because the mapper wrote `comparisonGroupId: "undefined"`. Prevented by sparse optional-index tests.
- Current blockers:
  - None for planning.
- Implementation started on branch `codex/dynamodb-s3-repositories`.
- Baseline checks before implementation:
  - `pnpm --filter @agentcore-pdf-translator/data typecheck` passed.
  - `pnpm --filter @agentcore-pdf-translator/data test` passed.
- Added runtime AWS SDK dependencies to `@agentcore-pdf-translator/data`:
  - `@aws-sdk/client-dynamodb`
  - `@aws-sdk/lib-dynamodb`
  - `@aws-sdk/client-s3`
  - `@aws-sdk/s3-request-presigner`
- Implemented PR-008 local persistence slice:
  - Added root-safe repository errors and shared repository ordering helpers.
  - Tightened in-memory repository behavior for append-only artifact, ledger, evaluation, and review rows.
  - Added duplicate-active price-book detection for in-memory and DynamoDB repositories.
  - Added DynamoDB mappers with PR-007 table/index key attributes, sparse optional GSI attributes, UTC sort-key timestamps, schema parsing at DB boundaries, and inline-payload rejection.
  - Added DynamoDB repository implementations behind `@agentcore-pdf-translator/data/persistent`.
  - Added S3 artifact object-store port and implementation separate from metadata `ArtifactRepository`.
  - Added S3 key/context validation, explicit content type and expiration validation, injected offline presigning support, and stream/string/byte body handling.
  - Added package export guardrails so the root data export does not import or expose AWS-backed implementations.
- Refactoring assessment:
  - Kept AWS-backed modules behind the persistent subpath to avoid root import coupling.
  - Shared ordering logic between in-memory and DynamoDB adapters instead of duplicating adapter-specific ordering.
  - Did not wire persistent behavior into Control API or infrastructure because that is PR-009 scope.
  - No further refactor was needed after checks; additional abstraction would widen the slice without improving the current contract.
- Final deterministic evidence:
  - `pnpm --filter @agentcore-pdf-translator/data typecheck` passed.
  - `pnpm --filter @agentcore-pdf-translator/data test` passed: 3 files, 27 tests.
  - `pnpm typecheck` passed across workspace packages/apps.
  - `pnpm test` passed across workspace packages/apps.
  - `pnpm lint` passed with zero warnings.
  - `pnpm install --frozen-lockfile` passed.
  - `pnpm cdk synth` passed and synthesized to `infra/cdk.out`.
- Deployed verification:
  - Not applicable for PR-008 because this slice deliberately does not wire the persistent repositories into the deployed Control API and does not change deployed behavior.
- Telemetry verification:
  - Not applicable for PR-008 because no deployed request path uses these repositories yet.
- Current blockers:
  - None.
- PR-008 completion evidence:
  - PR #7 merged to `main`.
  - Merge commit: `c3f2136`.
  - Post-merge CI run `26139422547` passed on merged SHA `c3f21360b644fb018f711442f8801ef41e836c27`.
  - Post-merge CI job `verify` passed typecheck, tests, lint, AWS configuration, and CDK synth.
