#!/usr/bin/env node

// PR-009 CI-invoked helper only. This is not a local deployment path.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const repository = requiredEnv("GITHUB_REPOSITORY");
const sha = requiredEnv("GITHUB_SHA");
const token = requiredEnv("GITHUB_TOKEN");
const serverUrl = process.env.GITHUB_SERVER_URL ?? "https://github.com";
const outputPath = process.env.PR_PROVENANCE_PATH ?? ".ci/deploy/pr-provenance.json";

const response = await fetch(`https://api.github.com/repos/${repository}/commits/${sha}/pulls`, {
  headers: {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2022-11-28",
  },
});

if (!response.ok) {
  throw new Error(`GitHub commit-to-PR lookup failed with HTTP ${response.status}`);
}

const pulls = await response.json();
if (!Array.isArray(pulls)) {
  throw new Error("GitHub commit-to-PR lookup returned an unexpected payload");
}

const mergedPulls = pulls.filter((pull) => pull?.state === "closed" && pull?.merged_at);
if (mergedPulls.length === 0) {
  throw new Error(
    `Commit ${sha} is not associated with a merged PR; refusing to deploy a non-PR main push.`,
  );
}

const selectedPull = mergedPulls[0];
const provenance = {
  status: "MERGED_PR_FOUND",
  repository,
  commitSha: sha,
  prNumber: selectedPull.number,
  prUrl: selectedPull.html_url ?? `${serverUrl}/${repository}/pull/${selectedPull.number}`,
  mergedAt: selectedPull.merged_at,
  mergeCommitSha: selectedPull.merge_commit_sha ?? null,
  headRef: selectedPull.head?.ref ?? null,
  baseRef: selectedPull.base?.ref ?? null,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(provenance, null, 2)}\n`);
console.log(`Resolved merged PR #${provenance.prNumber} for ${sha}.`);
