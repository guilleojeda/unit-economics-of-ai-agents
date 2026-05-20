#!/usr/bin/env node

// PR-009 CI-invoked helper only. This is not a local deployment path.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

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

if (accessMode !== "DEV_UNAUTHENTICATED_PLACEHOLDER") {
  throw new Error(`Unsupported PR-009 smoke access mode: ${accessMode}`);
}

const target = new URL("/api/jobs", controlApiUrl).toString();
const startedAt = new Date();
const response = await fetch(target, {
  method: "GET",
  headers: {
    accept: "application/json",
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

const deferredUntil = responseJson?.error?.details?.deferredUntil;
if (
  response.status === 501 &&
  responseJson?.error?.code === "NOT_IMPLEMENTED" &&
  deferredUntil === "PR-010"
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

console.log(`Control API smoke check passed for ${target}.`);
