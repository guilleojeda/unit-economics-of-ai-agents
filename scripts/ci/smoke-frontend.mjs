#!/usr/bin/env node

// CI-invoked helper only. This is not a local deployment path.

import { execFileSync } from "node:child_process";
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
if (typeof frontendUrl !== "string" || !frontendUrl.startsWith("https://")) {
  throw new Error("CDK outputs do not contain a valid FrontendUrl");
}
if (typeof browserAccessSecretArn !== "string" || !browserAccessSecretArn.startsWith("arn:")) {
  throw new Error("CDK outputs do not contain FrontendBrowserAccessSecretArn");
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

const secretJson = JSON.parse(
  aws(["secretsmanager", "get-secret-value", "--secret-id", browserAccessSecretArn, "--output", "json"])
);
const browserSecret = parseBrowserSecret(secretJson.SecretString);
const authHeader = `Basic ${Buffer.from(
  `${browserSecret.username}:${browserSecret.password}`,
  "utf8"
).toString("base64")}`;

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
      wwwAuthenticate: response.headers.get("www-authenticate")
    },
    text
  };
}

const unauthRoot = await timedFetch("/");
const authRoot = await timedFetch("/", {
  headers: {
    authorization: authHeader,
    accept: "text/html"
  }
});
const authDeepLink = await timedFetch("/documents", {
  headers: {
    authorization: authHeader,
    accept: "text/html"
  }
});
const unauthApi = await timedFetch("/api/price-books/current", {
  headers: {
    accept: "application/json"
  }
});
const authApi = await timedFetch("/api/price-books/current", {
  headers: {
    authorization: authHeader,
    accept: "application/json"
  }
});

let authApiJson = null;
try {
  authApiJson = JSON.parse(authApi.text);
} catch {
  authApiJson = null;
}

const checks = [
  ["unauthRootDenied", unauthRoot.status === 401],
  ["authRootLoads", authRoot.status === 200 && authRoot.text.includes("AgentCore Unit Economics")],
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
  responses: {
    unauthRoot: {
      path: unauthRoot.path,
      status: unauthRoot.status,
      durationMs: unauthRoot.durationMs,
      wwwAuthenticate: unauthRoot.headers.wwwAuthenticate
    },
    authRoot: {
      path: authRoot.path,
      status: authRoot.status,
      durationMs: authRoot.durationMs,
      cacheControl: authRoot.headers.cacheControl,
      referrerPolicy: authRoot.headers.referrerPolicy,
      frameOptions: authRoot.headers.frameOptions,
      contentTypeOptions: authRoot.headers.contentTypeOptions
    },
    authDeepLink: {
      path: authDeepLink.path,
      status: authDeepLink.status,
      durationMs: authDeepLink.durationMs
    },
    unauthApi: {
      path: unauthApi.path,
      status: unauthApi.status,
      durationMs: unauthApi.durationMs
    },
    authApi: {
      path: authApi.path,
      status: authApi.status,
      durationMs: authApi.durationMs,
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
