#!/usr/bin/env node

// PR-009 CI-invoked helper only. This is not a local deployment path.

import { appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const cloudFormationExecutionRole = process.env.CLOUDFORMATION_EXECUTION_ROLE;
const githubEnvPath = requiredEnv("GITHUB_ENV");
const runId = requiredEnv("GITHUB_RUN_ID");
const runAttempt = requiredEnv("GITHUB_RUN_ATTEMPT");
const region = process.env.AWS_REGION ?? "us-east-1";

if (!cloudFormationExecutionRole) {
  appendFileSync(
    githubEnvPath,
    ["CI_CDK_DEPLOY_ROLE_ASSUMED=false", "CI_CDK_DEPLOY_ROLE_SESSION_NAME=", ""].join("\n"),
  );
  console.log("CLOUDFORMATION_EXECUTION_ROLE is not configured; keeping pipeline role credentials.");
  process.exit(0);
}

const sessionName = `cdk-${runId}-${runAttempt}`.replace(/[^A-Za-z0-9+=,.@-]/g, "-").slice(0, 64);
const assume = spawnSync(
  "aws",
  [
    "sts",
    "assume-role",
    "--role-arn",
    cloudFormationExecutionRole,
    "--role-session-name",
    sessionName,
    "--duration-seconds",
    "3600",
    "--output",
    "json",
  ],
  {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  },
);

if (assume.status !== 0) {
  const stderr = assume.stderr
    .trim()
    .replaceAll(cloudFormationExecutionRole, "[REDACTED_CLOUDFORMATION_EXECUTION_ROLE]");
  throw new Error(`Assuming CLOUDFORMATION_EXECUTION_ROLE failed: ${stderr}`);
}

const assumedRole = JSON.parse(assume.stdout);
const credentials = assumedRole.Credentials;
if (
  !credentials ||
  typeof credentials.AccessKeyId !== "string" ||
  typeof credentials.SecretAccessKey !== "string" ||
  typeof credentials.SessionToken !== "string"
) {
  throw new Error("AWS STS assume-role response did not contain complete credentials");
}

for (const secretValue of [
  credentials.AccessKeyId,
  credentials.SecretAccessKey,
  credentials.SessionToken,
]) {
  console.log(`::add-mask::${secretValue}`);
}

appendFileSync(
  githubEnvPath,
  [
    `AWS_ACCESS_KEY_ID=${credentials.AccessKeyId}`,
    `AWS_SECRET_ACCESS_KEY=${credentials.SecretAccessKey}`,
    `AWS_SESSION_TOKEN=${credentials.SessionToken}`,
    `AWS_REGION=${region}`,
    `AWS_DEFAULT_REGION=${region}`,
    "CI_CDK_DEPLOY_ROLE_ASSUMED=true",
    `CI_CDK_DEPLOY_ROLE_SESSION_NAME=${sessionName}`,
    "",
  ].join("\n"),
);

console.log("Assumed CLOUDFORMATION_EXECUTION_ROLE for CDK deployment operations.");
