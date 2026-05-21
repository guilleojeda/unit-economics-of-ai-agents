#!/usr/bin/env node

// CI-invoked helper only. This is not a local deployment path.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
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
const outputPath = process.env.FRONTEND_SMOKE_RESULT_PATH ?? ".ci/deploy/frontend-smoke.json";
const outputs = JSON.parse(readFileSync(outputsPath, "utf8"));
const frontendOutputs = outputs["AgentCorePdfTranslator-dev-FrontendStack"];

const frontendUrl = frontendOutputs?.FrontendUrl;
const browserAccessSecretArn = frontendOutputs?.FrontendBrowserAccessSecretArn;
const frontendBucketName = frontendOutputs?.FrontendBucketName;
if (typeof frontendUrl !== "string" || !frontendUrl.startsWith("https://")) {
  throw new Error("CDK outputs do not contain a valid FrontendUrl");
}
if (typeof browserAccessSecretArn !== "string" || !browserAccessSecretArn.startsWith("arn:")) {
  throw new Error("CDK outputs do not contain FrontendBrowserAccessSecretArn");
}
if (typeof frontendBucketName !== "string" || frontendBucketName.length === 0) {
  throw new Error("CDK outputs do not contain FrontendBucketName");
}

function aws(args) {
  return execFileSync("aws", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024
  });
}

function parseBrowserSecret(secretString) {
  const parsed = JSON.parse(secretString);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof parsed.username !== "string" ||
    typeof parsed.password !== "string" ||
    parsed.username.length === 0 ||
    parsed.password.length === 0
  ) {
    throw new Error("Frontend browser access secret must contain username and password");
  }
  return parsed;
}

function headFrontendObject(key) {
  try {
    const response = JSON.parse(
      aws(["s3api", "head-object", "--bucket", frontendBucketName, "--key", key, "--output", "json"])
    );
    return {
      exists: true,
      key,
      cacheControl: response.CacheControl ?? null,
      contentLength: response.ContentLength ?? null,
      contentType: response.ContentType ?? null
    };
  } catch (error) {
    return {
      exists: false,
      key,
      errorName: error instanceof Error ? error.name : "UnknownError"
    };
  }
}

const secretJson = JSON.parse(
  aws(["secretsmanager", "get-secret-value", "--secret-id", browserAccessSecretArn, "--output", "json"])
);
const browserSecret = parseBrowserSecret(secretJson.SecretString);
const authHeader = `Basic ${Buffer.from(
  `${browserSecret.username}:${browserSecret.password}`,
  "utf8"
).toString("base64")}`;
const readinessTimeoutMs = Number.parseInt(
  process.env.FRONTEND_SMOKE_READY_TIMEOUT_MS ?? "300000",
  10
);
const readinessIntervalMs = Number.parseInt(
  process.env.FRONTEND_SMOKE_READY_INTERVAL_MS ?? "5000",
  10
);

if (!Number.isSafeInteger(readinessTimeoutMs) || readinessTimeoutMs < 1) {
  throw new Error("FRONTEND_SMOKE_READY_TIMEOUT_MS must be a positive integer when set");
}
if (!Number.isSafeInteger(readinessIntervalMs) || readinessIntervalMs < 1) {
  throw new Error("FRONTEND_SMOKE_READY_INTERVAL_MS must be a positive integer when set");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function timedFetch(path, options = {}) {
  const startedAt = Date.now();
  const response = await fetch(new URL(path, frontendUrl), options);
  const text = await response.text();
  return {
    path,
    status: response.status,
    durationMs: Date.now() - startedAt,
    headers: {
      cacheControl: response.headers.get("cache-control"),
      contentType: response.headers.get("content-type"),
      referrerPolicy: response.headers.get("referrer-policy"),
      frameOptions: response.headers.get("x-frame-options"),
      contentTypeOptions: response.headers.get("x-content-type-options"),
      xCache: response.headers.get("x-cache"),
      wwwAuthenticate: response.headers.get("www-authenticate")
    },
    text
  };
}

function summarizeBody(text) {
  return {
    sha256: createHash("sha256").update(text).digest("hex"),
    sample: text.replace(/\s+/gu, " ").trim().slice(0, 240)
  };
}

async function eventually(label, fetcher, isReady) {
  const deadline = Date.now() + readinessTimeoutMs;
  let attempt = 0;
  let lastResponse;

  while (Date.now() <= deadline) {
    attempt += 1;
    lastResponse = await fetcher();
    lastResponse.attempts = attempt;

    if (isReady(lastResponse)) {
      return lastResponse;
    }

    if (Date.now() + readinessIntervalMs > deadline) {
      break;
    }
    await sleep(readinessIntervalMs);
  }

  if (lastResponse === undefined) {
    throw new Error(`${label} did not run`);
  }
  return lastResponse;
}

function containsAppShell(response) {
  return response.status === 200 && response.text.includes("AgentCore Unit Economics");
}

const publishedIndexObject = headFrontendObject("index.html");
const unauthRoot = await eventually(
  "unauthenticated root denial",
  () => timedFetch("/"),
  (response) => response.status === 401
);
const authRoot = await eventually("authenticated root app shell", () => timedFetch("/", {
  headers: {
    authorization: authHeader,
    accept: "text/html"
  }
}), containsAppShell);
const authIndex = await eventually("authenticated explicit app shell", () => timedFetch("/index.html", {
  headers: {
    authorization: authHeader,
    accept: "text/html"
  }
}), containsAppShell);
const authDeepLink = await eventually("authenticated deep-link app shell", () => timedFetch("/documents", {
  headers: {
    authorization: authHeader,
    accept: "text/html"
  }
}), containsAppShell);
const unauthApi = await eventually(
  "unauthenticated API denial",
  () => timedFetch("/api/price-books/current", {
    headers: {
      accept: "application/json"
    }
  }),
  (response) => response.status === 401
);
const authApi = await eventually("authenticated CloudFront API", () => timedFetch("/api/price-books/current", {
  headers: {
    authorization: authHeader,
    accept: "application/json"
  }
}), (response) => {
  if (response.status !== 200) {
    return false;
  }
  try {
    return JSON.parse(response.text)?.priceBook?.status === "ACTIVE";
  } catch {
    return false;
  }
});

let authApiJson = null;
try {
  authApiJson = JSON.parse(authApi.text);
} catch {
  authApiJson = null;
}

const checks = [
  ["publishedIndexObjectExists", publishedIndexObject.exists],
  ["unauthRootDenied", unauthRoot.status === 401],
  ["authRootLoads", authRoot.status === 200 && authRoot.text.includes("AgentCore Unit Economics")],
  ["authIndexLoads", authIndex.status === 200 && authIndex.text.includes("AgentCore Unit Economics")],
  ["authDeepLinkLoads", authDeepLink.status === 200 && authDeepLink.text.includes("AgentCore Unit Economics")],
  ["unauthApiDenied", unauthApi.status === 401],
  ["authApiLoadsThroughCloudFront", authApi.status === 200 && authApiJson?.priceBook?.status === "ACTIVE"],
  ["securityHeadersPresent", authRoot.headers.referrerPolicy === "no-referrer" && authRoot.headers.frameOptions === "DENY"],
  ["noSecretLiteralsInHtml", !/x-dev-access-token|x-cloudfront-origin-proof|X-Amz-Signature=/iu.test(authRoot.text)]
];

const failedChecks = checks.filter(([, passed]) => !passed).map(([name]) => name);
const result = {
  status: failedChecks.length === 0 ? "PASSED" : "FAILED",
  checkedAt: new Date().toISOString(),
  frontendUrl,
  accessMode: frontendOutputs.FrontendAccessMode,
  browserAccessSecretArn,
  checks: Object.fromEntries(checks),
  failedChecks,
  publishedObjects: {
    index: publishedIndexObject
  },
  responses: {
    unauthRoot: {
      path: unauthRoot.path,
      status: unauthRoot.status,
      durationMs: unauthRoot.durationMs,
      attempts: unauthRoot.attempts,
      wwwAuthenticate: unauthRoot.headers.wwwAuthenticate
    },
    authRoot: {
      path: authRoot.path,
      status: authRoot.status,
      durationMs: authRoot.durationMs,
      attempts: authRoot.attempts,
      cacheControl: authRoot.headers.cacheControl,
      referrerPolicy: authRoot.headers.referrerPolicy,
      frameOptions: authRoot.headers.frameOptions,
      contentTypeOptions: authRoot.headers.contentTypeOptions,
      xCache: authRoot.headers.xCache,
      body: summarizeBody(authRoot.text)
    },
    authIndex: {
      path: authIndex.path,
      status: authIndex.status,
      durationMs: authIndex.durationMs,
      attempts: authIndex.attempts,
      cacheControl: authIndex.headers.cacheControl,
      referrerPolicy: authIndex.headers.referrerPolicy,
      frameOptions: authIndex.headers.frameOptions,
      contentTypeOptions: authIndex.headers.contentTypeOptions,
      xCache: authIndex.headers.xCache,
      body: summarizeBody(authIndex.text)
    },
    authDeepLink: {
      path: authDeepLink.path,
      status: authDeepLink.status,
      durationMs: authDeepLink.durationMs,
      attempts: authDeepLink.attempts,
      xCache: authDeepLink.headers.xCache,
      body: summarizeBody(authDeepLink.text)
    },
    unauthApi: {
      path: unauthApi.path,
      status: unauthApi.status,
      durationMs: unauthApi.durationMs,
      attempts: unauthApi.attempts
    },
    authApi: {
      path: authApi.path,
      status: authApi.status,
      durationMs: authApi.durationMs,
      attempts: authApi.attempts,
      priceBookStatus: authApiJson?.priceBook?.status ?? null
    }
  }
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);

if (result.status !== "PASSED") {
  console.error("Frontend smoke check failed.");
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(`Frontend smoke check passed for ${frontendUrl}.`);
