import { Aws, CfnOutput, CfnResource, Duration, Stack } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";
import { DockerImageAsset, Platform } from "aws-cdk-lib/aws-ecr-assets";
import {
  Effect,
  PolicyStatement,
  Role,
  ServicePrincipal
} from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import type { Bucket } from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AppConfig } from "../config.js";
import {
  agentCoreGatewayName,
  agentCoreRuntimeName,
  gatewayToolLambdaName
} from "../names.js";
import type { DatabaseTables } from "./database-stack.js";

export type AgentCoreStackProps = StackProps & {
  readonly artifactBucket: Bucket;
  readonly config: AppConfig;
  readonly tables: DatabaseTables;
};

export type AgentCoreRuntimeReference = {
  readonly runtimeArn: string;
  readonly runtimeEndpointArn: string;
  readonly runtimeQualifier: string;
};

type ToolGroup = {
  readonly id: string;
  readonly targetName: string;
  readonly lambdaNameSuffix: string;
  readonly tools: ReadonlyArray<{
    readonly name: string;
    readonly description: string;
  }>;
};

const runtimeQualifier = "DEFAULT";
const gatewayTargetVersion = "pr-012.1";

const toolGroups: ReadonlyArray<ToolGroup> = [
  {
    id: "PdfPipeline",
    targetName: "pdf-pipeline",
    lambdaNameSuffix: "pdf-pipeline",
    tools: [
      { name: "inspect_pdf", description: "Inspect a controlled source PDF artifact." },
      { name: "extract_text_layout", description: "Extract deterministic text-layout proof artifacts." },
      { name: "extract_images", description: "Skip V1 image extraction with explicit proof evidence." },
      { name: "chunk_and_align", description: "Create deterministic source chunk proof artifacts." },
      { name: "recompose_pdf", description: "Create deterministic translated PDF proof artifacts." }
    ]
  },
  {
    id: "Translation",
    targetName: "translation",
    lambdaNameSuffix: "translation",
    tools: [
      { name: "translate_text_chunks", description: "Create deterministic translated chunk proof artifacts." }
    ]
  },
  {
    id: "Evaluation",
    targetName: "evaluation",
    lambdaNameSuffix: "evaluation",
    tools: [
      { name: "evaluate_translation", description: "Create deterministic evaluation proof artifacts." }
    ]
  }
];

function tableEnvironment(tables: DatabaseTables): Readonly<Record<string, string>> {
  return {
    DOCUMENTS_TABLE: tables.Documents.tableName,
    TRANSLATION_JOBS_TABLE: tables.TranslationJobs.tableName,
    RUNS_TABLE: tables.Runs.tableName,
    STAGE_EVENTS_TABLE: tables.StageEvents.tableName,
    ARTIFACTS_TABLE: tables.Artifacts.tableName,
    LEDGER_ITEMS_TABLE: tables.LedgerItems.tableName,
    EVALUATION_RESULTS_TABLE: tables.EvaluationResults.tableName,
    REVIEW_DECISIONS_TABLE: tables.ReviewDecisions.tableName,
    PRICE_BOOKS_TABLE: tables.PriceBooks.tableName,
    APP_SETTINGS_TABLE: tables.AppSettings.tableName
  };
}

function agentCoreServicePrincipal(): ServicePrincipal {
  return new ServicePrincipal("bedrock-agentcore.amazonaws.com", {
    conditions: {
      StringEquals: {
        "aws:SourceAccount": Aws.ACCOUNT_ID
      },
      ArnLike: {
        "aws:SourceArn": `arn:aws:bedrock-agentcore:us-east-1:${Aws.ACCOUNT_ID}:*`
      }
    }
  });
}

function toolInputSchema(): Record<string, unknown> {
  const stringSchema = { Type: "string" };
  return {
    Type: "object",
    Required: [
      "workspaceId",
      "documentId",
      "jobId",
      "runId",
      "workflowVariant",
      "sourceLanguage",
      "targetLanguage",
      "priceBookVersion",
      "stageName",
      "inputArtifacts",
      "invocation",
      "provenance",
      "options"
    ],
    Properties: {
      workspaceId: stringSchema,
      documentId: stringSchema,
      jobId: stringSchema,
      runId: stringSchema,
      workflowVariant: stringSchema,
      sourceLanguage: stringSchema,
      targetLanguage: stringSchema,
      priceBookVersion: stringSchema,
      stageName: stringSchema,
      inputArtifacts: {
        Type: "array",
        Items: {
          Type: "object"
        }
      },
      invocation: {
        Type: "object"
      },
      provenance: {
        Type: "object"
      },
      options: {
        Type: "object"
      }
    }
  };
}

function toolOutputSchema(): Record<string, unknown> {
  return {
    Type: "object",
    Properties: {
      status: { Type: "string" },
      stageName: { Type: "string" },
      outputArtifacts: {
        Type: "array",
        Items: {
          Type: "object"
        }
      }
    }
  };
}

function toolDefinitions(group: ToolGroup): ReadonlyArray<Record<string, unknown>> {
  return group.tools.map((tool) => ({
    Name: tool.name,
    Description: tool.description,
    InputSchema: toolInputSchema(),
    OutputSchema: toolOutputSchema()
  }));
}

export class AgentCoreStack extends Stack {
  public readonly runtimeReference: AgentCoreRuntimeReference;

  public constructor(scope: Construct, id: string, props: AgentCoreStackProps) {
    super(scope, id, props);

    const stackDir = dirname(fileURLToPath(import.meta.url));
    const repoRoot = join(stackDir, "../../..");
    const commonEnvironment = {
      STAGE: props.config.stage,
      WORKSPACE_ID: props.config.workspaceId,
      ARTIFACT_BUCKET: props.artifactBucket.bucketName,
      BUILD_SHA: process.env.GITHUB_SHA ?? "local-synth",
      AGENTCORE_GATEWAY_TARGET_VERSION: gatewayTargetVersion,
      ...tableEnvironment(props.tables)
    };

    const runtimeImage = new DockerImageAsset(this, "AgentRuntimeImage", {
      directory: repoRoot,
      file: "apps/agent-runtime/Dockerfile",
      platform: Platform.LINUX_ARM64,
      exclude: [
        ".aws-sam",
        ".ci",
        ".git",
        "**/node_modules",
        "apps/web/out",
        "cdk.out",
        "infra/cdk.out",
        "node_modules"
      ]
    });

    const runtimeRole = new Role(this, "AgentCoreRuntimeRole", {
      assumedBy: agentCoreServicePrincipal(),
      description: "Execution role for PR-012 AgentCore Runtime."
    });
    runtimeImage.repository.grantPull(runtimeRole);
    props.artifactBucket.grantReadWrite(runtimeRole);
    for (const table of Object.values(props.tables)) {
      table.grantReadWriteData(runtimeRole);
    }
    runtimeRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams",
          "logs:PutLogEvents"
        ],
        resources: [`arn:aws:logs:us-east-1:${Aws.ACCOUNT_ID}:log-group:/aws/bedrock-agentcore/runtimes/*`]
      })
    );

    const gatewayRole = new Role(this, "AgentCoreGatewayRole", {
      assumedBy: agentCoreServicePrincipal(),
      description: "Execution role for PR-012 AgentCore Gateway."
    });
    gatewayRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams",
          "logs:PutLogEvents"
        ],
        resources: [`arn:aws:logs:us-east-1:${Aws.ACCOUNT_ID}:log-group:/aws/bedrock-agentcore/gateways/*`]
      })
    );

    const toolLambdas = new Map<string, NodejsFunction>();
    for (const group of toolGroups) {
      const toolLambda = new NodejsFunction(this, `${group.id}GatewayToolLambda`, {
        functionName: gatewayToolLambdaName(props.config, group.lambdaNameSuffix),
        runtime: Runtime.NODEJS_24_X,
        entry: join(stackDir, "../../../apps/gateway-tools/src/lambda.ts"),
        handler: "handler",
        memorySize: 256,
        timeout: Duration.seconds(20),
        logRetention: RetentionDays.ONE_WEEK,
        bundling: {
          format: OutputFormat.ESM,
          mainFields: ["module", "main"],
          sourceMap: false,
          externalModules: []
        },
        environment: {
          ...commonEnvironment,
          TOOL_GROUP: group.targetName,
          TOOL_LAMBDA_ALIAS: "$LATEST"
        }
      });
      props.artifactBucket.grantReadWrite(toolLambda);
      for (const table of Object.values(props.tables)) {
        table.grantReadWriteData(toolLambda);
      }
      toolLambda.grantInvoke(gatewayRole);
      toolLambdas.set(group.targetName, toolLambda);
    }

    const gateway = new CfnResource(this, "AgentCoreGateway", {
      type: "AWS::BedrockAgentCore::Gateway",
      properties: {
        Name: agentCoreGatewayName(props.config),
        Description: "PR-012 MCP Gateway for deterministic PDF translation proof tools.",
        AuthorizerType: "AWS_IAM",
        ProtocolType: "MCP",
        ProtocolConfiguration: {
          Mcp: {
            SupportedVersions: ["2025-06-18"],
            Instructions: "Expose only deterministic PR-012 PDF workflow proof tools."
          }
        },
        RoleArn: gatewayRole.roleArn,
        Tags: {
          Stage: props.config.stage,
          Application: "agentcore-pdf-translator"
        }
      }
    });

    runtimeRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["bedrock-agentcore:InvokeGateway"],
        resources: [gateway.getAtt("GatewayArn").toString()]
      })
    );

    for (const group of toolGroups) {
      const toolLambda = toolLambdas.get(group.targetName);
      if (toolLambda === undefined) {
        throw new Error(`Missing tool Lambda for ${group.targetName}`);
      }
      toolLambda.addPermission(`${group.id}AgentCoreGatewayInvoke`, {
        principal: new ServicePrincipal("bedrock-agentcore.amazonaws.com"),
        action: "lambda:InvokeFunction",
        sourceArn: gateway.getAtt("GatewayArn").toString()
      });
      new CfnResource(this, `${group.id}GatewayTarget`, {
        type: "AWS::BedrockAgentCore::GatewayTarget",
        properties: {
          GatewayIdentifier: gateway.ref,
          Name: group.targetName,
          Description: `PR-012 ${group.targetName} deterministic Lambda tools.`,
          TargetConfiguration: {
            Mcp: {
              Lambda: {
                LambdaArn: toolLambda.functionArn,
                ToolSchema: {
                  InlinePayload: toolDefinitions(group)
                }
              }
            }
          }
        }
      });
    }

    const runtime = new CfnResource(this, "AgentCoreRuntime", {
      type: "AWS::BedrockAgentCore::Runtime",
      properties: {
        AgentRuntimeName: agentCoreRuntimeName(props.config),
        Description: "PR-012 TypeScript Strands AgentCore Runtime for Gateway proof execution.",
        AgentRuntimeArtifact: {
          ContainerConfiguration: {
            ContainerUri: runtimeImage.imageUri
          }
        },
        NetworkConfiguration: {
          NetworkMode: "PUBLIC"
        },
        ProtocolConfiguration: "HTTP",
        RoleArn: runtimeRole.roleArn,
        EnvironmentVariables: {
          ...commonEnvironment,
          AGENTCORE_GATEWAY_ID: gateway.ref,
          AGENTCORE_GATEWAY_URL: gateway.getAtt("GatewayUrl").toString(),
          AGENTCORE_RUNTIME_QUALIFIER: runtimeQualifier,
          AGENTCORE_RUNTIME_IMAGE_URI: runtimeImage.imageUri,
          STRANDS_AGENT_VERSION: "typescript-strands-layer"
        },
        Tags: {
          Stage: props.config.stage,
          Application: "agentcore-pdf-translator"
        }
      }
    });

    const runtimeEndpoint = new CfnResource(this, "AgentCoreRuntimeEndpoint", {
      type: "AWS::BedrockAgentCore::RuntimeEndpoint",
      properties: {
        AgentRuntimeId: runtime.getAtt("AgentRuntimeId").toString(),
        AgentRuntimeVersion: runtime.getAtt("AgentRuntimeVersion").toString(),
        Name: runtimeQualifier,
        Description: "Default PR-012 AgentCore Runtime endpoint.",
        Tags: {
          Stage: props.config.stage,
          Application: "agentcore-pdf-translator"
        }
      }
    });

    this.runtimeReference = {
      runtimeArn: runtime.getAtt("AgentRuntimeArn").toString(),
      runtimeEndpointArn: runtimeEndpoint.getAtt("AgentRuntimeEndpointArn").toString(),
      runtimeQualifier
    };

    new CfnOutput(this, "AgentCoreRuntimeArn", {
      value: this.runtimeReference.runtimeArn
    });
    new CfnOutput(this, "AgentCoreRuntimeId", {
      value: runtime.getAtt("AgentRuntimeId").toString()
    });
    new CfnOutput(this, "AgentCoreRuntimeEndpointArn", {
      value: this.runtimeReference.runtimeEndpointArn
    });
    new CfnOutput(this, "AgentCoreRuntimeQualifier", {
      value: runtimeQualifier
    });
    new CfnOutput(this, "AgentCoreRuntimeImageUri", {
      value: runtimeImage.imageUri
    });
    new CfnOutput(this, "AgentCoreGatewayId", {
      value: gateway.ref
    });
    new CfnOutput(this, "AgentCoreGatewayArn", {
      value: gateway.getAtt("GatewayArn").toString()
    });
    new CfnOutput(this, "AgentCoreGatewayUrl", {
      value: gateway.getAtt("GatewayUrl").toString()
    });
    new CfnOutput(this, "AgentCoreGatewayTargetVersion", {
      value: gatewayTargetVersion
    });
    for (const group of toolGroups) {
      const toolLambda = toolLambdas.get(group.targetName);
      if (toolLambda !== undefined) {
        new CfnOutput(this, `${group.id}GatewayToolLambdaName`, {
          value: toolLambda.functionName
        });
      }
    }
  }
}
