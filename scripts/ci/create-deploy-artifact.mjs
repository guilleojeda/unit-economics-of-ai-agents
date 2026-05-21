#!/usr/bin/env node

// CI-invoked helper only. This is not a local deployment path.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const expectedStacks = [
  "AgentCorePdfTranslator-dev-StorageStack",
  "AgentCorePdfTranslator-dev-DatabaseStack",
  "AgentCorePdfTranslator-dev-ControlApiStack",
  "AgentCorePdfTranslator-dev-FrontendStack",
];

const expectedDatabaseOutputs = [
  "DocumentsTableName",
  "TranslationJobsTableName",
  "RunsTableName",
  "StageEventsTableName",
  "ArtifactsTableName",
  "LedgerItemsTableName",
  "EvaluationResultsTableName",
  "ReviewDecisionsTableName",
  "PriceBooksTableName",
  "AppSettingsTableName",
];

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const readJsonIfExists = (path) => (existsSync(path) ? readJson(path) : null);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const sha256File = (path) => sha256(readFileSync(path));

const readPackageVersion = (packageJsonPath) => {
  const packageJson = readJsonIfExists(packageJsonPath);
  return typeof packageJson?.version === "string" ? packageJson.version : null;
};

const outputPath = process.env.DEPLOY_ARTIFACT_PATH ?? ".ci/deploy/deploy-artifact-dev.json";
const cdkOutputsPath = requiredEnv("CDK_OUTPUTS_PATH");
const assemblyDir = requiredEnv("CDK_ASSEMBLY_DIR");
const dataProtectionSummaryPath = requiredEnv("DATA_PROTECTION_SUMMARY_PATH");
const smokeResultPath = requiredEnv("SMOKE_RESULT_PATH");
const frontendStaticValidationPath = requiredEnv("FRONTEND_STATIC_VALIDATION_PATH");
const frontendPublishSummaryPath = requiredEnv("FRONTEND_PUBLISH_SUMMARY_PATH");
const frontendSmokeResultPath = requiredEnv("FRONTEND_SMOKE_RESULT_PATH");
const awsIdentityPath = requiredEnv("AWS_IDENTITY_PATH");
const prProvenancePath = requiredEnv("PR_PROVENANCE_PATH");
const bucketVersioningPath = requiredEnv("DEPLOY_ARTIFACT_BUCKET_VERSIONING_PATH");
const artifactsBucketName = requiredEnv("ARTIFACTS_BUCKET_NAME");

const repository = requiredEnv("GITHUB_REPOSITORY");
const deployedCommitSha = requiredEnv("GITHUB_SHA");
const eventName = requiredEnv("GITHUB_EVENT_NAME");
const ref = requiredEnv("GITHUB_REF");
const runId = requiredEnv("GITHUB_RUN_ID");
const runAttempt = requiredEnv("GITHUB_RUN_ATTEMPT");
const workflowName = requiredEnv("GITHUB_WORKFLOW");
const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
const region = process.env.AWS_REGION ?? "us-east-1";
const stage = process.env.CDK_STAGE ?? "dev";
const accessMode = requiredEnv("CONTROL_API_ACCESS_MODE");

const cdkOutputs = readJson(cdkOutputsPath);
const dataProtectionSummary = readJson(dataProtectionSummaryPath);
const smokeResult = readJson(smokeResultPath);
const frontendStaticValidation = readJson(frontendStaticValidationPath);
const frontendPublishSummary = readJson(frontendPublishSummaryPath);
const frontendSmokeResult = readJson(frontendSmokeResultPath);
const awsIdentity = readJson(awsIdentityPath);
const prProvenance = readJson(prProvenancePath);
const bucketVersioning = readJson(bucketVersioningPath);
const pipelineIdentity = readJsonIfExists(process.env.AWS_PIPELINE_IDENTITY_PATH ?? "");
const predeployStackStatus = readJsonIfExists(
  process.env.PREDEPLOY_STACK_STATUS_PATH ?? ".ci/deploy/predeploy-stack-status.json",
);
const rootPackage = readJson("package.json");

const assemblyManifestPath = join(assemblyDir, "manifest.json");
const assemblyManifest = readJson(assemblyManifestPath);
const stackTemplateHashes = {};
const stackTemplateFiles = {};

for (const stackName of expectedStacks) {
  const artifact = assemblyManifest.artifacts?.[stackName];
  const templateFile = artifact?.properties?.templateFile;
  if (typeof templateFile !== "string") {
    throw new Error(`CDK assembly is missing template file for ${stackName}`);
  }
  const templatePath = join(assemblyDir, templateFile);
  stackTemplateFiles[stackName] = templateFile;
  stackTemplateHashes[stackName] = sha256File(templatePath);
}

const storageOutputs = cdkOutputs["AgentCorePdfTranslator-dev-StorageStack"];
const databaseOutputs = cdkOutputs["AgentCorePdfTranslator-dev-DatabaseStack"];
const controlApiOutputs = cdkOutputs["AgentCorePdfTranslator-dev-ControlApiStack"];
const frontendOutputs = cdkOutputs["AgentCorePdfTranslator-dev-FrontendStack"];
if (!storageOutputs || !databaseOutputs || !controlApiOutputs || !frontendOutputs) {
  throw new Error("CDK outputs are missing one or more expected stack output groups");
}

if (typeof storageOutputs.ArtifactBucketName !== "string") {
  throw new Error("Storage stack output ArtifactBucketName is required");
}

for (const outputName of expectedDatabaseOutputs) {
  if (typeof databaseOutputs[outputName] !== "string") {
    throw new Error(`Database stack output ${outputName} is required`);
  }
}

if (typeof controlApiOutputs.ControlApiUrl !== "string") {
  throw new Error("Control API stack output ControlApiUrl is required");
}
if (typeof controlApiOutputs.ControlApiLambdaName !== "string") {
  throw new Error("Control API stack output ControlApiLambdaName is required");
}
if (typeof controlApiOutputs.ControlApiDevAccessTokenSecretArn !== "string") {
  throw new Error("Control API stack output ControlApiDevAccessTokenSecretArn is required");
}
if (typeof controlApiOutputs.ControlApiOriginProofSecretArn !== "string") {
  throw new Error("Control API stack output ControlApiOriginProofSecretArn is required");
}
if (controlApiOutputs.ControlApiAccessMode !== "DEV_SECRET_HEADER_OR_CLOUDFRONT_ORIGIN_PROOF") {
  throw new Error("Control API access mode must include dev secret and CloudFront origin proof");
}
if (controlApiOutputs.ControlApiSmokeRoute !== "GET /api/price-books/current") {
  throw new Error("Control API smoke route output is not the protected price-book read route");
}
for (const outputName of [
  "FrontendUrl",
  "FrontendDistributionId",
  "FrontendDistributionDomainName",
  "FrontendBucketName",
  "FrontendBrowserAccessSecretArn",
  "FrontendOriginProofSecretArn",
  "FrontendAccessMode",
  "FrontendApiBasePath",
  "FrontendHostingMode",
]) {
  if (typeof frontendOutputs[outputName] !== "string") {
    throw new Error(`Frontend stack output ${outputName} is required`);
  }
}
if (frontendOutputs.FrontendAccessMode !== "CLOUDFRONT_BASIC_AUTH_AND_ORIGIN_PROOF") {
  throw new Error("Frontend access mode must be CLOUDFRONT_BASIC_AUTH_AND_ORIGIN_PROOF");
}
if (frontendOutputs.FrontendApiBasePath !== "/api") {
  throw new Error("Frontend API base path must be same-origin /api");
}
if (frontendOutputs.FrontendHostingMode !== "S3_CLOUDFRONT_STATIC_EXPORT") {
  throw new Error("Frontend hosting mode must be S3_CLOUDFRONT_STATIC_EXPORT");
}
if (frontendOutputs.FrontendOriginProofSecretArn !== controlApiOutputs.ControlApiOriginProofSecretArn) {
  throw new Error("Frontend and Control API origin proof secret outputs must match");
}
if (smokeResult.status !== "PASSED") {
  throw new Error("Smoke result must be PASSED before creating success deploy artifact");
}
if (frontendStaticValidation.status !== "PASSED") {
  throw new Error("Frontend static validation must be PASSED before creating success deploy artifact");
}
if (frontendPublishSummary.status !== "PASSED") {
  throw new Error("Frontend asset publication must be PASSED before creating success deploy artifact");
}
if (frontendSmokeResult.status !== "PASSED") {
  throw new Error("Frontend smoke result must be PASSED before creating success deploy artifact");
}
if (dataProtectionSummary.status !== "PASSED") {
  throw new Error("Data protection summary must be PASSED before creating success deploy artifact");
}
if (bucketVersioning.Status !== "Enabled") {
  throw new Error("Deploy artifact bucket versioning must be Enabled");
}
if (artifactsBucketName === storageOutputs.ArtifactBucketName) {
  throw new Error("Deploy artifact bucket must be distinct from the product workflow artifact bucket");
}
if (artifactsBucketName === frontendOutputs.FrontendBucketName) {
  throw new Error("Deploy artifact bucket must be distinct from the frontend static hosting bucket");
}

const cdkContext = {
  stage,
  region,
  workspaceId: process.env.CDK_WORKSPACE_ID ?? "ci_dev",
  activePriceBookVersion: process.env.CDK_PRICE_BOOK_VERSION ?? "ci_dev",
  priceBookHumanReviewHourlyRateUsd: process.env.CDK_PRICE_BOOK_HUMAN_REVIEW_HOURLY_RATE_USD ?? null
};

const artifactObjectKey = `deploy-artifacts/dev/${deployedCommitSha}/${runId}-${runAttempt}/deploy-artifact-dev.json`;
const artifact = {
  schemaVersion: "pr-010a-dev-deploy-v1",
  status: "SUCCESS",
  createdAt: new Date().toISOString(),
  repository,
  stage,
  region,
  aws: {
    accountId: awsIdentity.Account,
    callerArn: awsIdentity.Arn,
    callerUserId: awsIdentity.UserId,
    pipelineCallerArn: pipelineIdentity?.Arn ?? null,
    pipelineCallerUserId: pipelineIdentity?.UserId ?? null,
    expectedAccountSource:
      process.env.EXPECTED_DEV_AWS_ACCOUNT_ID_SOURCE ??
      "repository variable or secret DEV_AWS_ACCOUNT_ID",
    roleSessionName: process.env.CI_DEPLOY_ROLE_SESSION_NAME ?? null,
    roleChain: {
      pipelineExecutionRoleSecretConfigured: true,
      cloudFormationExecutionRoleSecretConfigured:
        process.env.CLOUDFORMATION_EXECUTION_ROLE_CONFIGURED === "true",
      cdkDeployRoleAssumed: process.env.CI_CDK_DEPLOY_ROLE_ASSUMED === "true",
      cdkDeployRoleSessionName: process.env.CI_CDK_DEPLOY_ROLE_SESSION_NAME ?? null,
      cdkDeploymentCredentialPath:
        "GitHub OIDC assumes PIPELINE_EXECUTION_ROLE; when CLOUDFORMATION_EXECUTION_ROLE is configured, CI then assumes it for CDK stack status, deploy, smoke, and artifact upload operations.",
      cloudFormationExecutionRoleUsage:
        "CLOUDFORMATION_EXECUTION_ROLE is used as the effective CDK deployment role when configured; CDK may still use bootstrap roles declared by the synthesized assembly.",
    },
  },
  github: {
    workflowName,
    eventName,
    ref,
    deployedCommitSha,
    runId,
    runAttempt,
    runUrl: `${serverUrl}/${repository}/actions/runs/${runId}`,
    associatedPullRequest: prProvenance,
  },
  stacks: {
    expectedStacks,
    predeployStatus: predeployStackStatus,
    outputs: {
      storage: storageOutputs,
      database: databaseOutputs,
      controlApi: controlApiOutputs,
      frontend: frontendOutputs,
    },
  },
  smoke: {
    controlApi: smokeResult,
    frontend: frontendSmokeResult,
  },
  artifact: {
    storage: "s3",
    bucketNameSha256: sha256(artifactsBucketName),
    objectKey: artifactObjectKey,
    retention: {
      bucketVersioningStatus: bucketVersioning.Status,
      overwriteProtection: "object key includes stage, deployed SHA, run ID, and run attempt",
      expiry: "controlled by the configured S3 artifact bucket lifecycle; no lifecycle expiry is set by PR-010A",
    },
  },
  runtime: {
    packageManager: rootPackage.packageManager,
    nodeVersion: process.version,
    cdkCliVersion: readPackageVersion("infra/node_modules/aws-cdk/package.json"),
    awsCdkLibVersion: readPackageVersion("infra/node_modules/aws-cdk-lib/package.json"),
    lockfileSha256: sha256File("pnpm-lock.yaml"),
    cdkContext,
    cdkContextFingerprint: sha256(JSON.stringify(cdkContext)),
    cdkAssemblyManifestSha256: sha256File(assemblyManifestPath),
    cdkStackTemplateFiles: stackTemplateFiles,
    cdkStackTemplateSha256: stackTemplateHashes,
    githubActionsRuntimeBasis:
      "workflow uses no GitHub JavaScript actions; checkout, pnpm setup, OIDC credential exchange, deploy artifact creation, and artifact upload are shell, AWS CLI, or repository Node scripts",
    githubActionRefs: [],
  },
  dataProtection: dataProtectionSummary,
  frontend: {
    url: frontendOutputs.FrontendUrl,
    distributionId: frontendOutputs.FrontendDistributionId,
    distributionDomainName: frontendOutputs.FrontendDistributionDomainName,
    bucketNameSha256: sha256(frontendOutputs.FrontendBucketName),
    accessMode: frontendOutputs.FrontendAccessMode,
    hostingMode: frontendOutputs.FrontendHostingMode,
    apiBasePath: frontendOutputs.FrontendApiBasePath,
    browserAccessSecretArn: frontendOutputs.FrontendBrowserAccessSecretArn,
    originProofSecretArn: frontendOutputs.FrontendOriginProofSecretArn,
    staticValidation: frontendStaticValidation,
    publish: {
      status: frontendPublishSummary.status,
      fileCount: frontendPublishSummary.fileCount,
      totalBytes: frontendPublishSummary.totalBytes,
      immutableAssetCount: frontendPublishSummary.immutableAssetCount,
      htmlNoStoreCount: frontendPublishSummary.htmlNoStoreCount,
      invalidationId: frontendPublishSummary.invalidationId,
      invalidationStatus: frontendPublishSummary.invalidationStatus,
      manifestSha256: sha256(JSON.stringify(frontendPublishSummary.manifest ?? [])),
    },
    smoke: frontendSmokeResult,
    directVerification:
      "Codex must retrieve the browser access credential from Secrets Manager, open the CloudFront URL, and directly exercise the rendered deployed app after this merged SHA deploys. Secret values are not stored in this artifact.",
  },
  controlApi: {
    accessMode,
    scope:
      "Protected PR-010A persistent Control API. CI direct smoke uses x-dev-access-token; browser traffic goes through CloudFront /api/* with an edge-injected origin proof.",
    smokeRoute: controlApiOutputs.ControlApiSmokeRoute,
    tokenSecretArn: controlApiOutputs.ControlApiDevAccessTokenSecretArn,
    originProofSecretArn: controlApiOutputs.ControlApiOriginProofSecretArn,
    directVerification:
      "Codex may retrieve the dev token from Secrets Manager for direct API verification after post-merge deployment. Browser JavaScript must never receive this token or the origin proof value.",
    forbidden:
      "No replay, synthetic-run, live-capture, recording, presentation, unauthenticated product API, hard-coded price, hard-coded model ID, or log-derived economics behavior is accepted.",
  },
  telemetry: {
    status: "NOT_VERIFIED_IN_CI",
    reason:
      "Queryable smoke-request telemetry is not established for PR-010A CI; direct API/frontend smoke evidence is recorded separately and telemetry must not be treated as economics source of truth.",
  },
};

const requiredTopLevelFields = [
  "schemaVersion",
  "status",
  "createdAt",
  "repository",
  "stage",
  "region",
  "aws",
  "github",
  "stacks",
  "smoke",
  "artifact",
  "runtime",
  "dataProtection",
  "frontend",
  "controlApi",
  "telemetry",
];

for (const field of requiredTopLevelFields) {
  if (!(field in artifact)) {
    throw new Error(`Deploy artifact missing required field ${field}`);
  }
}

const serialized = JSON.stringify(artifact, null, 2);
const forbiddenValueFragments = [
  process.env.AWS_SECRET_ACCESS_KEY,
  process.env.AWS_SESSION_TOKEN,
  process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
].filter((value) => typeof value === "string" && value.length > 0);

for (const value of forbiddenValueFragments) {
  if (serialized.includes(value)) {
    throw new Error("Deploy artifact contains a forbidden secret value");
  }
}

const forbiddenPatterns = [
  /AKIA[0-9A-Z]{16}/,
  /ASIA[0-9A-Z]{16}/,
  /X-Amz-Signature=/i,
  /X-Amz-Credential=/i,
  /AWS_SECRET_ACCESS_KEY/,
  /AWS_SESSION_TOKEN/,
  /BEGIN [A-Z ]+PRIVATE KEY/,
  /Authorization:\s*Bearer/i,
];

for (const pattern of forbiddenPatterns) {
  if (pattern.test(serialized)) {
    throw new Error(`Deploy artifact contains forbidden pattern ${pattern}`);
  }
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${serialized}\n`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const summary = [
    "## PR-010A dev deployment",
    "",
    `- Status: ${artifact.status}`,
    `- PR: ${artifact.github.associatedPullRequest.prUrl}`,
    `- Commit: \`${artifact.github.deployedCommitSha}\``,
    `- Run: ${artifact.github.runUrl}`,
    `- Region/stage: \`${artifact.region}\` / \`${artifact.stage}\``,
    `- AWS account: \`${artifact.aws.accountId}\``,
    `- Frontend URL: ${artifact.frontend.url}`,
    `- Control API URL: ${artifact.stacks.outputs.controlApi.ControlApiUrl}`,
    `- Control API smoke: ${artifact.smoke.controlApi.method} ${artifact.smoke.controlApi.target} -> ${artifact.smoke.controlApi.httpStatus}`,
    `- Frontend smoke: ${artifact.smoke.frontend.responses.authRoot.path} -> ${artifact.smoke.frontend.responses.authRoot.status}`,
    `- Deploy artifact key: \`${artifact.artifact.objectKey}\``,
    `- Deploy artifact bucket hash: \`${artifact.artifact.bucketNameSha256}\``,
    `- Frontend access: \`${artifact.frontend.accessMode}\``,
    `- Control API direct smoke access: \`${artifact.controlApi.accessMode}\``,
    `- GitHub action refs: none; workflow uses shell/AWS CLI/repository Node scripts.`,
    "",
  ].join("\n");
  writeFileSync(process.env.GITHUB_STEP_SUMMARY, summary, { flag: "a" });
}

console.log(`Created sanitized deploy artifact at ${outputPath}.`);
