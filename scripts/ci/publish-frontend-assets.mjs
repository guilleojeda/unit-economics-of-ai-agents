#!/usr/bin/env node

// CI-invoked helper only. This is not a local deployment path.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, extname, join, relative } from "node:path";

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const buildDir = process.env.FRONTEND_BUILD_DIR ?? "apps/web/out";
const outputsPath = requiredEnv("CDK_OUTPUTS_PATH");
const outputPath = process.env.FRONTEND_PUBLISH_SUMMARY_PATH ?? ".ci/deploy/frontend-publish.json";
const outputs = JSON.parse(readFileSync(outputsPath, "utf8"));
const frontendOutputs = outputs["AgentCorePdfTranslator-dev-FrontendStack"];

const bucketName = frontendOutputs?.FrontendBucketName;
const distributionId = frontendOutputs?.FrontendDistributionId;
const frontendUrl = frontendOutputs?.FrontendUrl;

if (typeof bucketName !== "string" || bucketName.length === 0) {
  throw new Error("CDK outputs are missing FrontendBucketName");
}
if (typeof distributionId !== "string" || distributionId.length === 0) {
  throw new Error("CDK outputs are missing FrontendDistributionId");
}
if (typeof frontendUrl !== "string" || !frontendUrl.startsWith("https://")) {
  throw new Error("CDK outputs are missing a valid FrontendUrl");
}
if (!existsSync(join(buildDir, "index.html"))) {
  throw new Error(`${buildDir} must contain index.html before publishing`);
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

function walkFiles(root) {
  const files = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) {
      continue;
    }
    const stat = statSync(current);
    if (stat.isDirectory()) {
      for (const child of [...readdirSync(current)].sort()) {
        stack.push(join(current, child));
      }
      continue;
    }
    if (stat.isFile()) {
      files.push(current);
    }
  }
  return files.sort();
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function cacheControlFor(key) {
  if (key.endsWith(".html")) {
    return "no-store";
  }
  if (key.startsWith("_next/static/")) {
    return "public,max-age=31536000,immutable";
  }
  return "public,max-age=3600";
}

function assertPublishable(key) {
  const basename = key.split("/").pop() ?? key;
  if (key.endsWith(".map")) {
    throw new Error(`${key} is a public source map and must not be published`);
  }
  if (/^(sw|service-worker|workbox).*\.(js|mjs)$/iu.test(basename)) {
    throw new Error(`${key} is a service-worker/offline-cache artifact and must not be published`);
  }
  if (/\.pdf$/iu.test(key)) {
    throw new Error(`${key} is a PDF artifact and must not be published as a frontend asset`);
  }
  if (/\.(log|tsbuildinfo|trace)$/iu.test(key) || key.includes(".next/trace")) {
    throw new Error(`${key} is a build-debug artifact and must not be published`);
  }
}

function aws(args) {
  return execFileSync("aws", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 10 * 1024 * 1024
  });
}

const manifest = [];
for (const file of walkFiles(buildDir)) {
  const key = relative(buildDir, file).split("\\").join("/");
  assertPublishable(key);
  const cacheControl = cacheControlFor(key);
  const contentType = contentTypes[extname(key)] ?? "application/octet-stream";

  aws([
    "s3api",
    "put-object",
    "--bucket",
    bucketName,
    "--key",
    key,
    "--body",
    file,
    "--cache-control",
    cacheControl,
    "--content-type",
    contentType,
    "--metadata",
    `commit-sha=${process.env.GITHUB_SHA ?? "local"},build-stage=${process.env.CDK_STAGE ?? "dev"}`
  ]);

  manifest.push({
    key,
    bytes: statSync(file).size,
    sha256: sha256File(file),
    cacheControl,
    contentType
  });
}

const invalidationPayload = JSON.parse(
  aws([
    "cloudfront",
    "create-invalidation",
    "--distribution-id",
    distributionId,
    "--paths",
    "/*",
    "--output",
    "json"
  ])
);
const invalidationId = invalidationPayload.Invalidation?.Id;
if (typeof invalidationId !== "string" || invalidationId.length === 0) {
  throw new Error("CloudFront invalidation did not return an invalidation ID");
}

aws([
  "cloudfront",
  "wait",
  "invalidation-completed",
  "--distribution-id",
  distributionId,
  "--id",
  invalidationId
]);

const summary = {
  status: "PASSED",
  checkedAt: new Date().toISOString(),
  frontendUrl,
  bucketNameSha256: createHash("sha256").update(bucketName).digest("hex"),
  distributionId,
  buildDir,
  fileCount: manifest.length,
  totalBytes: manifest.reduce((total, file) => total + file.bytes, 0),
  immutableAssetCount: manifest.filter((file) => file.cacheControl.includes("immutable")).length,
  htmlNoStoreCount: manifest.filter((file) => file.key.endsWith(".html") && file.cacheControl === "no-store").length,
  invalidationId,
  invalidationStatus: "Completed",
  manifest
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);

console.log(
  `Published ${manifest.length} frontend asset(s) to CloudFront distribution ${distributionId}.`
);
