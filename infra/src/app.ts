import { App, Stack } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";
import type { Construct } from "constructs";

class FoundationStack extends Stack {
  public constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);
  }
}

const app = new App();

new FoundationStack(app, "AgentCorePdfTranslatorFoundationStack", {
  env: {
    region: "us-east-1"
  }
});
