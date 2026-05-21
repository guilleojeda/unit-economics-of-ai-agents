#!/usr/bin/env node

// CI-invoked helper only. This is not a local deployment path.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { execFileSync } from "node:child_process";

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const outputsPath = requiredEnv("CDK_OUTPUTS_PATH");
const outputPath = process.env.SMOKE_RESULT_PATH ?? ".ci/deploy/smoke-result.json";
const accessMode = process.env.CONTROL_API_ACCESS_MODE ?? "UNKNOWN";

const outputs = JSON.parse(readFileSync(outputsPath, "utf8"));
const controlApiStack = outputs["AgentCorePdfTranslator-dev-ControlApiStack"];
const controlApiUrl = controlApiStack?.ControlApiUrl;
if (typeof controlApiUrl !== "string" || !controlApiUrl.startsWith("https://")) {
  throw new Error("CDK outputs do not contain a valid ControlApiUrl");
}

if (accessMode !== "DEV_SECRET_HEADER") {
  throw new Error(`Unsupported Control API smoke access mode: ${accessMode}`);
}

const devAccessTokenSecretArn = controlApiStack?.ControlApiDevAccessTokenSecretArn;
if (typeof devAccessTokenSecretArn !== "string" || !devAccessTokenSecretArn.startsWith("arn:")) {
  throw new Error("CDK outputs do not contain ControlApiDevAccessTokenSecretArn");
}

function parseSecretToken(secretString) {
  try {
    const parsed = JSON.parse(secretString);
    if (parsed && typeof parsed === "object" && typeof parsed.token === "string") {
      return parsed.token;
    }
  } catch {
    return secretString;
  }

  return secretString;
}

const secretJson = JSON.parse(
  execFileSync(
    "aws",
    ["secretsmanager", "get-secret-value", "--secret-id", devAccessTokenSecretArn, "--output", "json"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ),
);
const devAccessToken = parseSecretToken(secretJson.SecretString);
if (typeof devAccessToken !== "string" || devAccessToken.length === 0) {
  throw new Error("Control API dev access token secret is empty");
}

const target = new URL("/api/price-books/current", controlApiUrl).toString();
const startedAt = new Date();
const response = await fetch(target, {
  method: "GET",
  headers: {
    accept: "application/json",
    "x-dev-access-token": devAccessToken,
  },
});
const responseText = await response.text();
let responseJson;
try {
  responseJson = JSON.parse(responseText);
} catch {
  responseJson = null;
}

const requestId =
  response.headers.get("apigw-requestid") ??
  response.headers.get("x-amzn-requestid") ??
  response.headers.get("x-amz-apigw-id");

const result = {
  status: "FAILED",
  checkedAt: new Date().toISOString(),
  target,
  method: "GET",
  accessMode,
  httpStatus: response.status,
  requestId,
  durationMs: new Date().getTime() - startedAt.getTime(),
  responseBody: responseJson,
};

if (
  response.status === 200 &&
  responseJson?.priceBook?.status === "ACTIVE" &&
  responseJson?.setting?.settingKey === "ACTIVE_PRICE_BOOK_VERSION"
) {
  result.status = "PASSED";
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);

if (result.status !== "PASSED") {
  console.error("Control API smoke check failed.");
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(`Protected Control API smoke check passed for ${target}.`);
