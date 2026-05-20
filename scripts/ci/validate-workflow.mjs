#!/usr/bin/env node

// PR-009 CI-invoked helper only. This is not a local deployment path.

import { readFileSync } from "node:fs";

const workflowPath = ".github/workflows/ci.yml";
const workflow = readFileSync(workflowPath, "utf8");

const failures = [];

const requireIncludes = (label, needle) => {
  if (!workflow.includes(needle)) {
    failures.push(`${label}: expected workflow to include ${JSON.stringify(needle)}`);
  }
};

const requireMatches = (label, pattern) => {
  if (!pattern.test(workflow)) {
    failures.push(`${label}: expected workflow to match ${pattern}`);
  }
};

const forbidMatches = (label, pattern) => {
  if (pattern.test(workflow)) {
    failures.push(`${label}: forbidden workflow match ${pattern}`);
  }
};

requireMatches("pull request trigger", /^on:\n(?:  [^\n]*\n)*  pull_request:/m);
requireMatches("main push trigger", /^  push:\n    branches:\n      - main/m);
forbidMatches("no manual deployment trigger", /^  workflow_dispatch:/m);

requireMatches("top-level read-only permissions", /^permissions:\n  contents: read\n/m);
forbidMatches("no top-level OIDC permission", /^permissions:\n(?:  .+\n)*  id-token: write/m);

requireIncludes("verify job exists", "  verify:\n");
requireMatches("verify job read-only permissions", /  verify:\n(?:[\s\S]*?)    permissions:\n      contents: read\n/);
requireMatches("deploy job main push condition", /  deploy-dev:\n    if: \$\{\{ github\.event_name == 'push' && github\.ref == 'refs\/heads\/main' \}\}/);
requireMatches("deploy job depends on verify", /  deploy-dev:\n(?:[\s\S]*?)    needs: verify\n/);
requireMatches("deploy OIDC is job scoped", /  deploy-dev:\n(?:[\s\S]*?)    permissions:\n      contents: read\n      id-token: write\n      pull-requests: read\n/);
requireMatches("deployment concurrency queues", /    concurrency:\n      group: agentcore-pdf-translator-dev-deploy\n      cancel-in-progress: false\n/);

const verifyJob = workflow.split("  deploy-dev:")[0] ?? "";
if (/(configure-aws|PIPELINE_EXECUTION_ROLE|aws sts|aws s3api|cdk deploy)/.test(verifyJob)) {
  failures.push("verify job must not configure AWS, call AWS APIs, or deploy");
}
if (/id-token: write/.test(verifyJob)) {
  failures.push("verify job must not request id-token: write");
}

forbidMatches("no GitHub JavaScript actions", /^\s+- uses:/m);
forbidMatches("no broad CDK deploy", /cdk deploy\s+--all/);
forbidMatches("no hotswap deployment", /--hotswap|--hotswap-fallback/);
forbidMatches("no watch deployment", /cdk watch/);
forbidMatches("no local approval prompts", /--require-approval\s+(?:broadening|any-change)/);

requireIncludes("workflow validation check is run", "pnpm ci:validate-workflow");
requireIncludes("typecheck is run", "pnpm typecheck");
requireIncludes("tests are run", "pnpm test");
requireIncludes("lint is run", "pnpm lint");
requireIncludes("synth is run", "pnpm cdk synth ${EXPECTED_STACKS}");
requireIncludes("data protection is validated", "node scripts/ci/validate-data-protection.mjs");
requireIncludes("merged PR provenance is required", "node scripts/ci/resolve-merged-pr.mjs");
requireIncludes("manual reruns are rejected", "Manual reruns are not accepted as the PR-009 post-merge deployment path");
requireIncludes("AWS OIDC is configured by CI script", "node scripts/ci/configure-aws-oidc.mjs");
requireIncludes("expected AWS account guard exists", "DEV_AWS_ACCOUNT_ID");
requireIncludes("predeploy stack status captured", "node scripts/ci/describe-stack-status.mjs");
requireIncludes("CDK deployment uses explicit stack list", "pnpm cdk deploy ${EXPECTED_STACKS}");
requireIncludes("CDK deployment uses fresh assembly", "--app ../.ci/deploy/cdk.out");
requireIncludes("CDK deployment is non-interactive", "--require-approval never");
requireIncludes("CDK deployment forces CI mode", "--ci");
requireIncludes("smoke check is run", "node scripts/ci/smoke-control-api.mjs");
requireIncludes("deploy artifact is created", "node scripts/ci/create-deploy-artifact.mjs");
requireIncludes("deploy artifact is uploaded to S3", "aws s3api put-object");

const expectedStacks = [
  "AgentCorePdfTranslator-dev-StorageStack",
  "AgentCorePdfTranslator-dev-DatabaseStack",
  "AgentCorePdfTranslator-dev-ControlApiStack",
];

for (const stackName of expectedStacks) {
  requireIncludes(`stack allowlist includes ${stackName}`, stackName);
}

const deployCommandLine = workflow
  .split("\n")
  .find((line) => line.includes("pnpm cdk deploy"));
if (deployCommandLine && !deployCommandLine.includes("${EXPECTED_STACKS}")) {
  failures.push("CDK deploy must use EXPECTED_STACKS allowlist");
}

if (failures.length > 0) {
  console.error(`Workflow contract validation failed for ${workflowPath}:`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Workflow contract validation passed.");
