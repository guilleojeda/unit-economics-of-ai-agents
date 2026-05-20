#!/usr/bin/env node

// PR-009 CI-invoked helper only. This is not a local deployment path.

import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";

const expectedStacks = [
  "AgentCorePdfTranslator-dev-StorageStack",
  "AgentCorePdfTranslator-dev-DatabaseStack",
  "AgentCorePdfTranslator-dev-ControlApiStack",
];

const outputPath = process.env.PREDEPLOY_STACK_STATUS_PATH ?? ".ci/deploy/predeploy-stack-status.json";
const unsafeStatuses = new Set([
  "CREATE_IN_PROGRESS",
  "ROLLBACK_IN_PROGRESS",
  "ROLLBACK_COMPLETE",
  "DELETE_IN_PROGRESS",
  "DELETE_FAILED",
  "UPDATE_IN_PROGRESS",
  "UPDATE_COMPLETE_CLEANUP_IN_PROGRESS",
  "UPDATE_ROLLBACK_IN_PROGRESS",
  "UPDATE_ROLLBACK_FAILED",
  "UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS",
  "REVIEW_IN_PROGRESS",
  "IMPORT_IN_PROGRESS",
  "IMPORT_ROLLBACK_IN_PROGRESS",
  "IMPORT_ROLLBACK_FAILED",
]);

const statuses = [];
const failures = [];

for (const stackName of expectedStacks) {
  const result = spawnSync(
    "aws",
    ["cloudformation", "describe-stacks", "--stack-name", stackName, "--output", "json"],
    {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    },
  );

  if (result.status === 0) {
    const payload = JSON.parse(result.stdout);
    const stack = payload.Stacks?.[0];
    const stackStatus = stack?.StackStatus ?? "UNKNOWN";
    statuses.push({
      stackName,
      status: stackStatus,
      stackId: stack?.StackId ?? null,
      lastUpdatedTime: stack?.LastUpdatedTime ?? null,
      creationTime: stack?.CreationTime ?? null,
    });
    if (unsafeStatuses.has(stackStatus)) {
      failures.push(`${stackName} is in unsafe status ${stackStatus}`);
    }
    continue;
  }

  const stderr = result.stderr.trim();
  if (stderr.includes("does not exist")) {
    statuses.push({
      stackName,
      status: "ABSENT",
      stackId: null,
      lastUpdatedTime: null,
      creationTime: null,
    });
    continue;
  }

  failures.push(`${stackName} status lookup failed: ${stderr}`);
}

const summary = {
  checkedAt: new Date().toISOString(),
  expectedStacks,
  status: failures.length === 0 ? "DEPLOYABLE_OR_ABSENT" : "BLOCKED",
  stacks: statuses,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);

if (failures.length > 0) {
  console.error("Pre-deploy stack status check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Pre-deploy stack status check passed.");
