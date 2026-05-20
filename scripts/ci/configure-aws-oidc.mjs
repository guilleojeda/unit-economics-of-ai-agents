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

const requestUrl = requiredEnv("ACTIONS_ID_TOKEN_REQUEST_URL");
const requestToken = requiredEnv("ACTIONS_ID_TOKEN_REQUEST_TOKEN");
const pipelineExecutionRole = requiredEnv("PIPELINE_EXECUTION_ROLE");
const githubEnvPath = requiredEnv("GITHUB_ENV");
const runId = requiredEnv("GITHUB_RUN_ID");
const runAttempt = requiredEnv("GITHUB_RUN_ATTEMPT");
const region = process.env.AWS_REGION ?? "us-east-1";
const sessionName = `gha-${runId}-${runAttempt}`.replace(/[^A-Za-z0-9+=,.@-]/g, "-").slice(0, 64);

const oidcResponse = await fetch(`${requestUrl}&audience=sts.amazonaws.com`, {
  headers: {
    authorization: `bearer ${requestToken}`,
  },
});

if (!oidcResponse.ok) {
  throw new Error(`GitHub OIDC token request failed with HTTP ${oidcResponse.status}`);
}

const oidcPayload = await oidcResponse.json();
if (typeof oidcPayload.value !== "string" || oidcPayload.value.length === 0) {
  throw new Error("GitHub OIDC token response did not contain a token value");
}

const sts = spawnSync(
  "aws",
  [
    "sts",
    "assume-role-with-web-identity",
    "--role-arn",
    pipelineExecutionRole,
    "--role-session-name",
    sessionName,
    "--web-identity-token",
    oidcPayload.value,
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

if (sts.status !== 0) {
  const stderr = sts.stderr
    .trim()
    .replaceAll(oidcPayload.value, "[REDACTED_OIDC_TOKEN]")
    .replaceAll(pipelineExecutionRole, "[REDACTED_PIPELINE_ROLE]");
  throw new Error(`AWS OIDC assume-role failed: ${stderr}`);
}

const assumedRole = JSON.parse(sts.stdout);
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
    `CI_DEPLOY_ROLE_SESSION_NAME=${sessionName}`,
    "",
  ].join("\n"),
);

console.log("Configured AWS credentials through GitHub OIDC.");
