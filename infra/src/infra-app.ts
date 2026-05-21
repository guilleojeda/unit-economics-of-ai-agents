import type { App } from "aws-cdk-lib";
import { resolveConfig } from "./config.js";
import { stackName } from "./names.js";
import { ControlApiStack } from "./stacks/control-api-stack.js";
import { DatabaseStack } from "./stacks/database-stack.js";
import { FrontendStack } from "./stacks/frontend-stack.js";
import { StorageStack } from "./stacks/storage-stack.js";

export type InfrastructureStacks = {
  readonly storageStack: StorageStack;
  readonly databaseStack: DatabaseStack;
  readonly controlApiStack: ControlApiStack;
  readonly frontendStack: FrontendStack;
};

export function createInfrastructure(app: App): InfrastructureStacks {
  const config = resolveConfig(app);

  const storageStack = new StorageStack(app, stackName(config, "Storage"), {
    config,
    env: config.env
  });

  const databaseStack = new DatabaseStack(app, stackName(config, "Database"), {
    config,
    env: config.env
  });

  const controlApiStack = new ControlApiStack(app, stackName(config, "ControlApi"), {
    artifactBucket: storageStack.artifactBucket,
    config,
    env: config.env,
    tables: databaseStack.tables
  });

  const frontendStack = new FrontendStack(app, stackName(config, "Frontend"), {
    artifactBucket: storageStack.artifactBucket,
    config,
    controlApi: controlApiStack.controlApi,
    env: config.env,
    originProofSecret: controlApiStack.cloudFrontOriginProofSecret
  });
  frontendStack.addDependency(storageStack);
  frontendStack.addDependency(controlApiStack);

  return {
    storageStack,
    databaseStack,
    controlApiStack,
    frontendStack
  };
}
