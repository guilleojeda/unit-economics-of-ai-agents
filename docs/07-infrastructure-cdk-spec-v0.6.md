# 07 — Infrastructure and CDK spec v0.6

## Deployment target

```text
Region: us-east-1
Stage defaults: dev, prod
Naming pattern: agentcore-pdf-translator-{stage}
```

`us-east-1` is locked by user decision and because AgentCore endpoints/support exist there.

## CDK strategy

Use AWS CDK TypeScript.

Use CloudFormation/L1 resources for AgentCore first:

```text
AWS::BedrockAgentCore::Runtime
AWS::BedrockAgentCore::RuntimeEndpoint
AWS::BedrockAgentCore::Gateway
AWS::BedrockAgentCore::GatewayTarget
AWS::BedrockAgentCore::PolicyEngine
AWS::BedrockAgentCore::Policy
AWS::BedrockAgentCore::Memory, only if memory is enabled later
```

If an alpha/high-level CDK AgentCore construct is used, pin the exact package version.

## CDK app layout

```text
/infra
  bin/app.ts
  lib/config.ts
  lib/names.ts
  lib/stacks/storage-stack.ts
  lib/stacks/database-stack.ts
  lib/stacks/lambda-stack.ts
  lib/stacks/api-stack.ts
  lib/stacks/agentcore-stack.ts
  lib/stacks/observability-stack.ts
  lib/stacks/security-stack.ts
  lib/constructs/artifact-bucket.ts
  lib/constructs/dynamo-table.ts
  lib/constructs/tool-lambda.ts
  lib/constructs/agentcore-runtime.ts
  lib/constructs/agentcore-gateway.ts
```

## Stack dependency graph

```text
SecurityStack
  ↓
StorageStack
  ↓
DatabaseStack
  ↓
LambdaStack
  ↓
AgentCoreStack
  ↓
ApiStack
  ↓
ObservabilityStack
```

## StorageStack

Create one artifact bucket per environment:

```text
agentcore-pdf-translator-{stage}-{accountId}-us-east-1
```

Bucket settings:

```text
Block all public access: true
Server-side encryption: S3-managed or KMS-managed
Versioning: enabled
Object ownership: bucket owner enforced
Lifecycle: optional cleanup for dev only
CORS: allow frontend origin for direct upload/download if needed
```

Do not store PDF bytes in DynamoDB, Lambda payloads, AgentCore payloads, or API responses. Store artifact metadata in DynamoDB and object bytes in S3.

## DatabaseStack

Create tables:

```text
Documents
TranslationJobs
Runs
StageEvents
Artifacts
LedgerItems
EvaluationResults
ReviewDecisions
PriceBooks
AppSettings
```

Default table settings:

```text
Billing mode: PAY_PER_REQUEST
Point-in-time recovery: enabled
Deletion protection: enabled for prod, configurable for dev
Encryption: AWS-owned key acceptable for MVP; KMS configurable
Streams: disabled unless later needed
TTL: disabled for business records
```

Indexes:

```text
Documents: PK documentId; GSI1 workspaceId / createdAt#documentId
TranslationJobs: PK jobId; GSI1 documentId; GSI2 comparisonGroupId; GSI3 status
Runs: PK runId; GSI1 jobId; GSI2 documentId; GSI3 status
StageEvents: PK runId; SK sequencePadded#stageName#stageEventId
Artifacts: PK artifactId; GSI1 runId; GSI2 documentId; GSI3 jobId
LedgerItems: PK runId; SK stageSequencePadded#createdAt#ledgerItemId; GSI1 jobId; GSI2 documentId; GSI3 componentType
EvaluationResults: PK runId; SK createdAt#evaluationResultId
ReviewDecisions: PK jobId; SK createdAt#reviewDecisionId
PriceBooks: PK priceBookVersion
AppSettings: PK settingKey
```

## LambdaStack

Create:

```text
ControlApiLambda
PdfPipelineToolsLambda
TranslationToolsLambda
EvaluationToolsLambda
RuntimeCostReconciliationLambda, optional
SeedDataLambda, dev only optional
```

ControlApiLambda responsibilities:

```text
Document upload presign
Document CRUD/read APIs
Job creation
Run creation
AgentCore Runtime invocation
Timeline/ledger/artifact/evaluation reads
Reviewer decision
Job economics rollup
Comparison endpoint
Price book endpoint
```

PdfPipelineToolsLambda:

```text
inspect_pdf
extract_text_layout
extract_images
recompose_pdf
```

Runtime:

```text
Python container image preferred if using PyMuPDF/reportlab/pypdfium2.
TypeScript acceptable only if coordinate-preserving PDF tooling is sufficient.
```

TranslationToolsLambda:

```text
chunk_and_align
translate_text_chunks
translate_image_text
```

EvaluationToolsLambda:

```text
evaluate_translation
deterministic checks
Bedrock evaluator call
EVALUATION_JSON artifact creation
```

## API Gateway

Use API Gateway HTTP API unless REST API features are specifically needed.

Routes:

```text
POST /api/documents/presign
POST /api/documents
GET  /api/documents
GET  /api/documents/{documentId}
POST /api/documents/{documentId}/inspect
GET  /api/documents/{documentId}/jobs
POST /api/documents/{documentId}/jobs
GET  /api/jobs
GET  /api/jobs/{jobId}
GET  /api/jobs/{jobId}/runs
GET  /api/jobs/{jobId}/ledger
GET  /api/jobs/{jobId}/economics
POST /api/jobs/{jobId}/runs
GET  /api/runs/{runId}
GET  /api/runs/{runId}/timeline
GET  /api/runs/{runId}/artifacts
GET  /api/runs/{runId}/evaluation
GET  /api/runs/{runId}/ledger
POST /api/runs/{runId}/review
GET  /api/compare
GET  /api/price-books/current
PUT  /api/price-books/current
```

Auth for MVP:

```text
No public internet exposure for prod unless Cognito or another auth layer is added.
For dev, protect with environment allowlist, private deployment, or basic auth.
```

## AgentCore Runtime

Create one AgentCore Runtime:

```text
agentcore-pdf-translator-{stage}-runtime
```

Runtime artifact:

```text
ECR image containing /apps/agent-runtime
```

Endpoint strategy:

```text
Use DEFAULT endpoint for dev.
Create stable named endpoint for prod if needed.
```

Control API role needs permission to invoke the runtime.

Runtime environment variables:

```text
AWS_REGION=us-east-1
STAGE=dev
WORKSPACE_ID=ws_default
DOCUMENTS_TABLE=...
TRANSLATION_JOBS_TABLE=...
RUNS_TABLE=...
STAGE_EVENTS_TABLE=...
ARTIFACTS_TABLE=...
LEDGER_ITEMS_TABLE=...
EVALUATION_RESULTS_TABLE=...
REVIEW_DECISIONS_TABLE=...
PRICE_BOOKS_TABLE=...
APP_SETTINGS_TABLE=...
ARTIFACT_BUCKET=...
AGENTCORE_GATEWAY_ID=...
AGENTCORE_GATEWAY_URL=...
DEFAULT_TEXT_MODEL_ID=...
DEFAULT_EVALUATOR_MODEL_ID=...
ACTIVE_PRICE_BOOK_VERSION=...
```

## AgentCore Gateway

Create one Gateway:

```text
agentcore-pdf-translator-{stage}-gateway
```

Create three GatewayTargets:

```text
PdfPipelineTools
TranslationTools
EvaluationTools
```

Tool schemas:

```text
/infra/tool-schemas/pdf-pipeline-tools.json
/infra/tool-schemas/translation-tools.json
/infra/tool-schemas/evaluation-tools.json
```

Tool names exposed through Gateway:

```text
PdfPipelineTools___inspect_pdf
PdfPipelineTools___extract_text_layout
PdfPipelineTools___extract_images
PdfPipelineTools___recompose_pdf
TranslationTools___chunk_and_align
TranslationTools___translate_text_chunks
TranslationTools___translate_image_text
EvaluationTools___evaluate_translation
```

## AgentCore Policy

Include infrastructure hook for Policy, but keep first policy narrow.

Policy goal:

```text
Prevent image translation tool use unless workflow variant is V2_TEXT_AND_IMAGE_ANNOTATION or V3_OPTIMIZED.
```

Optional second policy:

```text
Prevent translate_image_text when imageCount exceeds configured threshold.
```

Do not let Policy block first end-to-end V1.

## AgentCore Memory

Do not provision Memory in MVP unless glossary/reviewer preference memory is added.

Reason:

```text
The document itself is not memory.
The cost ledger does not require memory.
The current workflow can use static glossary configuration.
```

## ObservabilityStack

Required CloudWatch log groups:

```text
/aws/lambda/agentcore-pdf-translator-{stage}-control-api
/aws/lambda/agentcore-pdf-translator-{stage}-pdf-tools
/aws/lambda/agentcore-pdf-translator-{stage}-translation-tools
/aws/lambda/agentcore-pdf-translator-{stage}-evaluation-tools
/aws/agentcore/agentcore-pdf-translator-{stage}-runtime, if applicable
```

Dashboards:

```text
Run health:
  active runs
  failed runs
  average run duration
  stage failure count

Cost health:
  average full workflow cost
  average LLM-only cost
  average non-model cost
  average human review cost
  cost per accepted job

AgentCore:
  runtime sessions
  runtime latency/duration
  gateway invocations
  gateway latency
  gateway user/system errors
  policy authorization decisions, if enabled

Bedrock:
  model calls
  input/output tokens
  evaluator calls
  translation calls
```

Alarms optional for MVP:

```text
Control API 5xx count
Tool Lambda errors
Gateway system errors
Run failure rate
Full workflow cost above configured ceiling
```

## IAM boundaries

Use least privilege.

ControlApiRole:

```text
s3:PutObject for upload prefix via presigned URL creation
s3:GetObject for artifact download presign
s3:HeadObject for artifact validation
dynamodb:GetItem/PutItem/UpdateItem/Query/BatchGetItem
bedrock-agentcore:InvokeAgentRuntime
logs write
```

AgentRuntimeExecutionRole:

```text
dynamodb read/write application tables
s3 read/write artifact bucket
AgentCore Gateway invocation permission
CloudWatch logs write
ADOT/observability permissions if required
```

PdfPipelineToolsRole:

```text
s3:GetObject on source/artifact prefixes
s3:PutObject on run artifact prefixes
logs write
```

TranslationToolsRole and EvaluationToolsRole:

```text
s3:GetObject
s3:PutObject
dynamodb:GetItem on PriceBooks/AppSettings if needed
bedrock model invocation permissions for configured models
logs write
```

Avoid broad wildcard permissions except during temporary development spikes.

## ECR and build artifacts

Create ECR repositories:

```text
agentcore-pdf-translator-{stage}-agent-runtime
agentcore-pdf-translator-{stage}-pdf-tools, if PDF tools use a Lambda container image
```

Use zip bundles for ControlApiLambda, TranslationToolsLambda, EvaluationToolsLambda. Use container image for AgentCore Runtime and optionally PDF tools.

Pin image tags by commit SHA or build ID. Do not deploy mutable `latest` to prod.

## Frontend hosting

Preferred simple MVP:

```text
Next.js static/export or SPA hosted on S3 + CloudFront
API Gateway backend
```

Alternative:

```text
Amplify Hosting
```

Frontend environment variables:

```text
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_STAGE
NEXT_PUBLIC_AWS_REGION=us-east-1
```

## Network model

MVP:

```text
No VPC for Lambda or AgentCore Runtime unless a private dependency appears.
Use public AWS service endpoints with IAM.
```

VPC adds complexity without clear MVP value.

## CI deployment sequence

The immediate next infrastructure task is `PR-009 - CI-backed dev deployment pipeline`. Its implementation contract is `docs/codex/PR-009-CI-DEPLOYMENT-PIPELINE.md`.

All deployment must run through the repository's CI/CD workflow using CDK/IaC. Do not run `cdk deploy` manually from a developer machine, and do not change AWS resources through the console to implement or verify product behavior.

PR-009 must deploy the current dev stacks first:

```text
AgentCorePdfTranslator-dev-StorageStack
AgentCorePdfTranslator-dev-DatabaseStack
AgentCorePdfTranslator-dev-ControlApiStack
```

Persistent Control API behavior remains deferred to PR-010. The PR-009 smoke check should prove that the deployed placeholder Control API responds from AWS and points callers to PR-010 for real persistence behavior.

```text
1. CI checks out the merged SHA.
2. CI installs dependencies.
3. CI builds shared packages.
4. CI builds frontend assets when frontend hosting exists.
5. CI builds Lambda bundles.
6. CI builds the agent runtime container image when AgentCore Runtime exists.
7. CI pushes container images to ECR with immutable commit/build tags.
8. CI runs cdk synth.
9. CI runs cdk deploy for SecurityStack.
10. CI runs cdk deploy for StorageStack.
11. CI runs cdk deploy for DatabaseStack.
12. CI runs cdk deploy for LambdaStack.
13. CI runs cdk deploy for AgentCoreStack.
14. CI runs cdk deploy for ApiStack.
15. CI runs cdk deploy for ObservabilityStack.
16. CI captures stack outputs for verification.
17. CI or a CI-invoked task seeds active price-book configuration only.
18. Codex uses the deployed app or API directly and records evidence in PLAN.md.
```

Do not seed fake product-facing runs. Seed only configuration and optionally controlled documents through normal ingestion.

Before frontend hosting exists, deployed verification can use the deployed API and stack outputs directly. Once frontend hosting exists, deployed verification must include direct use of the rendered app.

## Required stack outputs

```text
ArtifactBucketName
DocumentsTableName
TranslationJobsTableName
RunsTableName
StageEventsTableName
ArtifactsTableName
LedgerItemsTableName
EvaluationResultsTableName
ReviewDecisionsTableName
PriceBooksTableName
AppSettingsTableName
ControlApiUrl
ControlApiLambdaName
AgentRuntimeArn
AgentRuntimeEndpointArn
AgentRuntimeEndpointName
AgentCoreGatewayId
AgentCoreGatewayUrl
PdfPipelineToolsLambdaArn
TranslationToolsLambdaArn
EvaluationToolsLambdaArn
FrontendUrl, if frontend hosting is deployed
```

## Infrastructure acceptance criteria

```text
CI/CD deploys all core resources to us-east-1 through CDK.
Artifact bucket is private, encrypted, and blocks public access.
All DynamoDB tables exist with required keys and indexes.
Control API can read/write DynamoDB and generate S3 presigned URLs.
Control API can invoke AgentCore Runtime.
AgentCore Runtime can load run/job/document state from DynamoDB.
AgentCore Gateway exists with three Lambda targets.
Agent can invoke all required Gateway tools.
Translation/evaluation tools can call Bedrock.
All Lambdas write logs to CloudWatch.
AgentCore and Gateway observability are enabled or documented as required deployment step.
Active price book can be seeded and read.
Stack outputs include all resource names/ARNs needed for app configuration.
Post-merge deployment and direct deployed verification evidence are recorded before a slice is accepted.
```
