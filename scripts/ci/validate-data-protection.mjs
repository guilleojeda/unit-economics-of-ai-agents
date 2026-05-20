#!/usr/bin/env node

// PR-009 CI-invoked helper only. This is not a local deployment path.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const expectedStacks = [
  "AgentCorePdfTranslator-dev-StorageStack",
  "AgentCorePdfTranslator-dev-DatabaseStack",
  "AgentCorePdfTranslator-dev-ControlApiStack",
];

const assemblyDir = process.env.CDK_ASSEMBLY_DIR ?? ".ci/deploy/cdk.out";
const manifestPath = join(assemblyDir, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const failures = [];

const stackArtifacts = Object.entries(manifest.artifacts ?? {}).filter(
  ([, artifact]) => artifact.type === "aws:cloudformation:stack",
);
const stackNames = stackArtifacts.map(([name]) => name).sort();

for (const expectedStack of expectedStacks) {
  if (!stackNames.includes(expectedStack)) {
    failures.push(`missing expected stack in assembly: ${expectedStack}`);
  }
}

const unexpectedStacks = stackNames.filter((stackName) => !expectedStacks.includes(stackName));
if (unexpectedStacks.length > 0) {
  failures.push(`unexpected stacks in assembly: ${unexpectedStacks.join(", ")}`);
}

const stackSummaries = [];

const findStack = (stackName) => {
  const entry = stackArtifacts.find(([name]) => name === stackName);
  if (!entry) {
    return undefined;
  }
  const [, artifact] = entry;
  return {
    stackName,
    templateFile: artifact.properties?.templateFile,
    template: JSON.parse(readFileSync(join(assemblyDir, artifact.properties.templateFile), "utf8")),
  };
};

const requireRetain = (resourceId, resource) => {
  if (resource.DeletionPolicy !== "Retain") {
    failures.push(`${resourceId} must use DeletionPolicy Retain`);
  }
  if (resource.UpdateReplacePolicy !== "Retain") {
    failures.push(`${resourceId} must use UpdateReplacePolicy Retain`);
  }
};

const storageStack = findStack("AgentCorePdfTranslator-dev-StorageStack");
if (storageStack) {
  const resources = storageStack.template.Resources ?? {};
  const bucketEntries = Object.entries(resources).filter(
    ([, resource]) => resource.Type === "AWS::S3::Bucket",
  );

  if (bucketEntries.length !== 1) {
    failures.push(`expected exactly one artifact bucket, found ${bucketEntries.length}`);
  }

  for (const [resourceId, resource] of bucketEntries) {
    requireRetain(resourceId, resource);
    if (resource.Properties?.VersioningConfiguration?.Status !== "Enabled") {
      failures.push(`${resourceId} must enable S3 versioning`);
    }
    if (resource.Properties?.PublicAccessBlockConfiguration?.BlockPublicAcls !== true) {
      failures.push(`${resourceId} must block public ACLs`);
    }
    if (resource.Properties?.PublicAccessBlockConfiguration?.BlockPublicPolicy !== true) {
      failures.push(`${resourceId} must block public policies`);
    }
  }

  const autoDeleteResources = Object.entries(resources).filter(([resourceId, resource]) => {
    return resourceId.includes("AutoDeleteObjects") || String(resource.Type).includes("AutoDelete");
  });
  if (autoDeleteResources.length > 0) {
    failures.push("artifact bucket must not include S3 auto-delete custom resources");
  }

  stackSummaries.push({
    stackName: storageStack.stackName,
    templateFile: storageStack.templateFile,
    s3Buckets: bucketEntries.map(([resourceId]) => ({
      resourceId,
      deletionPolicy: "Retain",
      updateReplacePolicy: "Retain",
      versioning: "Enabled",
      autoDeleteObjects: false,
    })),
  });
}

const databaseStack = findStack("AgentCorePdfTranslator-dev-DatabaseStack");
if (databaseStack) {
  const resources = databaseStack.template.Resources ?? {};
  const tableEntries = Object.entries(resources).filter(
    ([, resource]) => resource.Type === "AWS::DynamoDB::Table",
  );

  if (tableEntries.length === 0) {
    failures.push("expected DynamoDB tables in database stack");
  }

  for (const [resourceId, resource] of tableEntries) {
    requireRetain(resourceId, resource);
    if (resource.Properties?.PointInTimeRecoverySpecification?.PointInTimeRecoveryEnabled !== true) {
      failures.push(`${resourceId} must enable DynamoDB point-in-time recovery`);
    }
    if (resource.Properties?.TimeToLiveSpecification?.Enabled === true) {
      failures.push(`${resourceId} must not enable product-record TTL`);
    }
  }

  stackSummaries.push({
    stackName: databaseStack.stackName,
    templateFile: databaseStack.templateFile,
    dynamoDbTables: tableEntries.map(([resourceId, resource]) => ({
      resourceId,
      deletionPolicy: "Retain",
      updateReplacePolicy: "Retain",
      pointInTimeRecovery: "Enabled",
      timeToLiveEnabled: resource.Properties?.TimeToLiveSpecification?.Enabled === true,
    })),
  });
}

const controlApiStack = findStack("AgentCorePdfTranslator-dev-ControlApiStack");
if (controlApiStack) {
  stackSummaries.push({
    stackName: controlApiStack.stackName,
    templateFile: controlApiStack.templateFile,
    dataBearingResources: false,
  });
}

const summary = {
  checkedAt: new Date().toISOString(),
  assemblyDir,
  expectedStacks,
  stackNames,
  status: failures.length === 0 ? "PASSED" : "FAILED",
  stacks: stackSummaries,
};

if (process.env.DATA_PROTECTION_SUMMARY_PATH) {
  mkdirSync(dirname(process.env.DATA_PROTECTION_SUMMARY_PATH), { recursive: true });
  writeFileSync(process.env.DATA_PROTECTION_SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`);
}

if (failures.length > 0) {
  console.error("Data-resource protection validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Data-resource protection validation passed.");
