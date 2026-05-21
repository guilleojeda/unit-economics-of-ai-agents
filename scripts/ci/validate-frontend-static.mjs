#!/usr/bin/env node

// CI-invoked helper only. This is not a local deployment path.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";

const sourceRoots = ["apps/web/src/app", "apps/web/src/components", "apps/web/src/lib"];
const outputDir = process.env.FRONTEND_BUILD_DIR ?? "apps/web/out";
const outputPath = process.env.FRONTEND_STATIC_VALIDATION_PATH ?? null;

const failures = [];
const scannedSourceFiles = [];
const scannedOutputFiles = [];

function walkFiles(root) {
  if (!existsSync(root)) {
    return [];
  }

  const entries = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) {
      continue;
    }
    const stat = statSync(current);
    if (stat.isDirectory()) {
      for (const child of readdirSorted(current)) {
        stack.push(join(current, child));
      }
      continue;
    }
    if (stat.isFile()) {
      entries.push(current);
    }
  }
  return entries.sort();
}

function readdirSorted(path) {
  return [...readdirSync(path)].sort();
}

function isTextFile(path) {
  return [
    ".css",
    ".html",
    ".js",
    ".json",
    ".mjs",
    ".svg",
    ".ts",
    ".tsx",
    ".txt",
    ".xml"
  ].includes(extname(path));
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function inspectSource() {
  for (const file of sourceRoots.flatMap((root) => walkFiles(root))) {
    const rel = relative(process.cwd(), file);
    if (/\.(test|spec)\.[cm]?[tj]sx?$/u.test(rel)) {
      continue;
    }
    scannedSourceFiles.push(rel);

    if (/\/route\.[cm]?[tj]s$/u.test(rel)) {
      failures.push(`${rel} is a Next.js route handler; PR-010A must remain a static export.`);
    }

    if (!isTextFile(file)) {
      continue;
    }

    const text = readFileSync(file, "utf8");
    const forbiddenSourcePatterns = [
      [/from ["']next\/headers["']/u, "server-only next/headers import"],
      [/from ["']next\/navigation["'];?\s*$/mu, "server-only redirect/navigation import"],
      [/\bcookies\s*\(/u, "server-side cookies usage"],
      [/\bheaders\s*\(/u, "server-side headers usage"],
      [/["']use server["']/u, "server action directive"],
      [/\bserviceWorker\b/u, "service worker usage"],
      [/\bnavigator\.serviceWorker\b/u, "service worker registration"],
      [/\bcaches\./u, "Cache Storage API usage"],
      [/\bCacheStorage\b/u, "Cache Storage API usage"],
      [/fixture-context/u, "production fixture context reference"],
      [/lib\/fixtures/u, "production fixture module reference"],
      [/cmp_refunds/u, "hard-coded fixture comparison ID"],
      [/job_v2|job_v3/u, "hard-coded V2/V3 fixture job ID"],
      [/LIVE_CAPTURE|REPLAY_CAPTURED|SYNTHETIC_SEED/u, "forbidden product mode constant"],
      [/x-dev-access-token/u, "direct Control API token header in browser source"],
      [/x-cloudfront-origin-proof/u, "origin proof header in browser source"]
    ];

    for (const [pattern, label] of forbiddenSourcePatterns) {
      if (pattern.test(text)) {
        failures.push(`${rel} contains ${label}`);
      }
    }
  }
}

function inspectOutput() {
  if (!existsSync(outputDir)) {
    return;
  }

  const indexPath = join(outputDir, "index.html");
  if (!existsSync(indexPath)) {
    failures.push(`${outputDir} is missing index.html`);
  }

  for (const file of walkFiles(outputDir)) {
    const rel = relative(outputDir, file);
    scannedOutputFiles.push({
      path: rel,
      bytes: statSync(file).size,
      sha256: sha256File(file)
    });

    const basename = rel.split("/").pop() ?? rel;
    if (rel.endsWith(".map")) {
      failures.push(`${rel} is a public source map`);
    }
    if (/^(sw|service-worker|workbox).*\.(js|mjs)$/iu.test(basename)) {
      failures.push(`${rel} is a service-worker/offline-cache artifact`);
    }
    if (/\.pdf$/iu.test(rel)) {
      failures.push(`${rel} is a PDF artifact in the static frontend output`);
    }
    if (/\.(log|tsbuildinfo|trace)$/iu.test(rel) || rel.includes(".next/trace")) {
      failures.push(`${rel} is a build-debug artifact`);
    }

    if (!isTextFile(file)) {
      continue;
    }

    const text = readFileSync(file, "utf8");
    const forbiddenOutputPatterns = [
      [/AKIA[0-9A-Z]{16}/u, "AWS access key"],
      [/ASIA[0-9A-Z]{16}/u, "AWS temporary access key"],
      [/X-Amz-Signature=/iu, "presigned URL signature"],
      [/X-Amz-Credential=/iu, "presigned URL credential"],
      [/AWS_SECRET_ACCESS_KEY/u, "AWS secret environment variable name"],
      [/AWS_SESSION_TOKEN/u, "AWS session token environment variable name"],
      [/x-dev-access-token/iu, "direct Control API token header"],
      [/x-cloudfront-origin-proof/iu, "CloudFront origin proof header"],
      [/Authorization:\s*Bearer/iu, "bearer authorization literal"],
      [/localhost:\d+/iu, "localhost endpoint"],
      [/cmp_refunds/u, "hard-coded fixture comparison ID"],
      [/job_v2|job_v3/u, "hard-coded V2/V3 fixture job ID"],
      [/fixture-model/u, "fixture model ID"],
      [/LIVE_CAPTURE|REPLAY_CAPTURED|SYNTHETIC_SEED/u, "forbidden product mode constant"]
    ];

    for (const [pattern, label] of forbiddenOutputPatterns) {
      if (pattern.test(text)) {
        failures.push(`${rel} contains ${label}`);
      }
    }
  }
}

inspectSource();
inspectOutput();

const summary = {
  checkedAt: new Date().toISOString(),
  status: failures.length === 0 ? "PASSED" : "FAILED",
  sourceRoots,
  outputDir,
  sourceFileCount: scannedSourceFiles.length,
  outputFileCount: scannedOutputFiles.length,
  outputTotalBytes: scannedOutputFiles.reduce((total, file) => total + file.bytes, 0),
  outputFiles: scannedOutputFiles,
  failures
};

if (outputPath !== null) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
}

if (failures.length > 0) {
  console.error("Frontend static validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Frontend static validation passed.");
