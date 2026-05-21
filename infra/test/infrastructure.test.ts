import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { createInfrastructure } from "../src/infra-app.js";

type SynthesizedInfrastructure = {
  readonly storage: Template;
  readonly database: Template;
  readonly controlApi: Template;
};

const expectedRoutes = [
  "POST /api/documents/presign",
  "POST /api/documents",
  "GET /api/documents",
  "GET /api/documents/{documentId}",
  "POST /api/documents/{documentId}/inspect",
  "GET /api/documents/{documentId}/jobs",
  "POST /api/documents/{documentId}/jobs",
  "GET /api/jobs",
  "GET /api/jobs/{jobId}",
  "GET /api/jobs/{jobId}/runs",
  "GET /api/jobs/{jobId}/ledger",
  "GET /api/jobs/{jobId}/economics",
  "POST /api/jobs/{jobId}/runs",
  "GET /api/runs/{runId}",
  "GET /api/runs/{runId}/timeline",
  "GET /api/runs/{runId}/artifacts",
  "GET /api/runs/{runId}/evaluation",
  "GET /api/runs/{runId}/ledger",
  "POST /api/runs/{runId}/review",
  "GET /api/artifacts/{artifactId}/download-url",
  "GET /api/compare",
  "GET /api/price-books/current",
  "PUT /api/price-books/current"
].sort();

function synthesize(context: Readonly<Record<string, unknown>> = {}): SynthesizedInfrastructure {
  const app = new App({
    context: {
      priceBookHumanReviewHourlyRateUsd: "90",
      ...context
    }
  });
  const stacks = createInfrastructure(app);

  return {
    storage: Template.fromStack(stacks.storageStack),
    database: Template.fromStack(stacks.databaseStack),
    controlApi: Template.fromStack(stacks.controlApiStack)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function properties(resource: unknown): Record<string, unknown> {
  if (!isRecord(resource) || !isRecord(resource.Properties)) {
    throw new Error("Expected CloudFormation resource with object properties.");
  }

  return resource.Properties;
}

function stringProperty(resource: unknown, propertyName: string): string {
  const value = properties(resource)[propertyName];
  if (typeof value !== "string") {
    throw new Error(`Expected ${propertyName} to be a string.`);
  }

  return value;
}

function resourceValues(template: Template, type: string): ReadonlyArray<unknown> {
  return Object.values(template.findResources(type) as Record<string, unknown>);
}

function allResourceTypes(templates: ReadonlyArray<Template>): ReadonlyArray<string> {
  return templates.flatMap((template) =>
    Object.values(template.toJSON().Resources as Record<string, { readonly Type?: unknown }>).map(
      (resource) => {
        if (typeof resource.Type !== "string") {
          throw new Error("Expected resource type to be a string.");
        }

        return resource.Type;
      }
    )
  );
}

function expectTable(
  template: Template,
  options: {
    readonly tableName: string;
    readonly partitionKey: string;
    readonly sortKey?: string;
    readonly globalSecondaryIndexes?: ReadonlyArray<{
      readonly indexName: string;
      readonly partitionKey: string;
      readonly sortKey?: string;
    }>;
  }
): void {
  template.hasResourceProperties("AWS::DynamoDB::Table", {
    TableName: options.tableName,
    BillingMode: "PAY_PER_REQUEST",
    PointInTimeRecoverySpecification: {
      PointInTimeRecoveryEnabled: true
    },
    KeySchema: Match.arrayWith([
      {
        AttributeName: options.partitionKey,
        KeyType: "HASH"
      },
      ...(options.sortKey === undefined
        ? []
        : [
            {
              AttributeName: options.sortKey,
              KeyType: "RANGE"
            }
          ])
    ]),
    AttributeDefinitions: Match.arrayWith([
      {
        AttributeName: options.partitionKey,
        AttributeType: "S"
      },
      ...(options.sortKey === undefined
        ? []
        : [
            {
              AttributeName: options.sortKey,
              AttributeType: "S"
            }
          ])
    ]),
    GlobalSecondaryIndexes:
      options.globalSecondaryIndexes === undefined
        ? Match.absent()
        : Match.arrayWith(
            options.globalSecondaryIndexes.map((index) => ({
              IndexName: index.indexName,
              Projection: {
                ProjectionType: "ALL"
              },
              KeySchema: Match.arrayWith([
                {
                  AttributeName: index.partitionKey,
                  KeyType: "HASH"
                },
                ...(index.sortKey === undefined
                  ? []
                  : [
                      {
                        AttributeName: index.sortKey,
                        KeyType: "RANGE"
                      }
                    ])
              ])
            }))
          )
  });
}

function actionValues(value: unknown): ReadonlyArray<string> {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.filter((candidate): candidate is string => typeof candidate === "string");
  }

  return [];
}

describe("PR-007 infrastructure", () => {
  it("creates a private retained artifact bucket with TLS-only transport", () => {
    const { storage } = synthesize();

    storage.resourceCountIs("AWS::S3::Bucket", 1);
    storage.hasResource("AWS::S3::Bucket", {
      DeletionPolicy: "Retain",
      UpdateReplacePolicy: "Retain"
    });
    storage.hasResourceProperties("AWS::S3::Bucket", {
      BucketName: {
        "Fn::Join": Match.arrayWith([
          Match.arrayWith(["agentcore-pdf-translator-dev-", { Ref: "AWS::AccountId" }, "-us-east-1"])
        ])
      },
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          {
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: "AES256"
            }
          }
        ]
      },
      OwnershipControls: {
        Rules: [
          {
            ObjectOwnership: "BucketOwnerEnforced"
          }
        ]
      },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true
      },
      VersioningConfiguration: {
        Status: "Enabled"
      }
    });
    storage.hasResourceProperties("AWS::S3::BucketPolicy", {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "s3:*",
            Condition: {
              Bool: {
                "aws:SecureTransport": "false"
              }
            },
            Effect: "Deny"
          })
        ])
      }
    });
    storage.hasOutput("ArtifactBucketName", {});
  });

  it("creates ten DynamoDB tables with required keys, indexes, and retention controls", () => {
    const { database } = synthesize();

    database.resourceCountIs("AWS::DynamoDB::Table", 10);
    expectTable(database, {
      tableName: "agentcore-pdf-translator-dev-documents",
      partitionKey: "documentId",
      globalSecondaryIndexes: [
        {
          indexName: "byWorkspace",
          partitionKey: "workspaceId",
          sortKey: "createdAtDocumentId"
        }
      ]
    });
    expectTable(database, {
      tableName: "agentcore-pdf-translator-dev-translation-jobs",
      partitionKey: "jobId",
      globalSecondaryIndexes: [
        { indexName: "byDocument", partitionKey: "documentId", sortKey: "createdAtJobId" },
        {
          indexName: "byComparisonGroup",
          partitionKey: "comparisonGroupId",
          sortKey: "workflowVariantCreatedAtJobId"
        },
        { indexName: "byStatus", partitionKey: "status", sortKey: "updatedAtJobId" }
      ]
    });
    expectTable(database, {
      tableName: "agentcore-pdf-translator-dev-runs",
      partitionKey: "runId",
      globalSecondaryIndexes: [
        {
          indexName: "byJob",
          partitionKey: "jobId",
          sortKey: "attemptNumberPaddedCreatedAtRunId"
        },
        { indexName: "byDocument", partitionKey: "documentId", sortKey: "createdAtRunId" },
        { indexName: "byStatus", partitionKey: "status", sortKey: "updatedAtRunId" }
      ]
    });
    expectTable(database, {
      tableName: "agentcore-pdf-translator-dev-stage-events",
      partitionKey: "runId",
      sortKey: "sequencePaddedStageNameStageEventId"
    });
    expectTable(database, {
      tableName: "agentcore-pdf-translator-dev-artifacts",
      partitionKey: "artifactId",
      globalSecondaryIndexes: [
        {
          indexName: "byRun",
          partitionKey: "runId",
          sortKey: "artifactTypeCreatedAtArtifactId"
        },
        {
          indexName: "byDocument",
          partitionKey: "documentId",
          sortKey: "artifactTypeCreatedAtArtifactId"
        },
        { indexName: "byJob", partitionKey: "jobId", sortKey: "createdAtArtifactId" }
      ]
    });
    expectTable(database, {
      tableName: "agentcore-pdf-translator-dev-ledger-items",
      partitionKey: "runId",
      sortKey: "stageSequencePaddedCreatedAtLedgerItemId",
      globalSecondaryIndexes: [
        { indexName: "byJob", partitionKey: "jobId", sortKey: "createdAtLedgerItemId" },
        {
          indexName: "byDocument",
          partitionKey: "documentId",
          sortKey: "createdAtLedgerItemId"
        },
        {
          indexName: "byComponentType",
          partitionKey: "componentType",
          sortKey: "createdAtLedgerItemId"
        }
      ]
    });
    expectTable(database, {
      tableName: "agentcore-pdf-translator-dev-evaluation-results",
      partitionKey: "runId",
      sortKey: "createdAtEvaluationResultId"
    });
    expectTable(database, {
      tableName: "agentcore-pdf-translator-dev-review-decisions",
      partitionKey: "jobId",
      sortKey: "createdAtReviewDecisionId"
    });
    expectTable(database, {
      tableName: "agentcore-pdf-translator-dev-price-books",
      partitionKey: "priceBookVersion",
      globalSecondaryIndexes: [
        {
          indexName: "byStatus",
          partitionKey: "status",
          sortKey: "updatedAtPriceBookVersion"
        }
      ]
    });
    expectTable(database, {
      tableName: "agentcore-pdf-translator-dev-app-settings",
      partitionKey: "settingKey"
    });

    for (const resource of resourceValues(database, "AWS::DynamoDB::Table")) {
      const tableProperties = properties(resource);
      expect(tableProperties.TimeToLiveSpecification).toBeUndefined();
      expect(tableProperties.StreamSpecification).toBeUndefined();
    }

    for (const outputName of [
      "DocumentsTableName",
      "TranslationJobsTableName",
      "RunsTableName",
      "StageEventsTableName",
      "ArtifactsTableName",
      "LedgerItemsTableName",
      "EvaluationResultsTableName",
      "ReviewDecisionsTableName",
      "PriceBooksTableName",
      "AppSettingsTableName"
    ]) {
      database.hasOutput(outputName, {});
    }
  });

  it("enables DynamoDB deletion protection for prod tables", () => {
    const { database } = synthesize({ stage: "prod" });

    for (const resource of resourceValues(database, "AWS::DynamoDB::Table")) {
      expect(properties(resource).DeletionProtectionEnabled).toBe(true);
    }
  });

  it("creates a Lambda-token-protected explicit Control API route surface", () => {
    const { controlApi } = synthesize();

    controlApi.resourceCountIs("AWS::ApiGatewayV2::Route", expectedRoutes.length);
    controlApi.hasResourceProperties("AWS::ApiGatewayV2::Api", {
      Name: "agentcore-pdf-translator-dev-control-api",
      ProtocolType: "HTTP",
      CorsConfiguration: Match.absent()
    });

    const routeResources = resourceValues(controlApi, "AWS::ApiGatewayV2::Route");
    const routeKeys = routeResources.map((resource) => stringProperty(resource, "RouteKey")).sort();
    expect(routeKeys).toEqual(expectedRoutes);
    expect(routeKeys).not.toContain("$default");

    for (const route of routeResources) {
      expect(properties(route).AuthorizationType).toBe("NONE");
    }
  });

  it("creates a persistent Control API Lambda with bounded settings and least-scoped service permissions", () => {
    const { controlApi } = synthesize();

    const productLambdas = resourceValues(controlApi, "AWS::Lambda::Function").filter(
      (resource) =>
        isRecord(resource) &&
        isRecord(resource.Properties) &&
        resource.Properties.FunctionName === "agentcore-pdf-translator-dev-control-api"
    );
    expect(productLambdas).toHaveLength(1);
    controlApi.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "agentcore-pdf-translator-dev-control-api",
      Handler: "index.handler",
      Runtime: "nodejs24.x",
      Environment: {
        Variables: Match.objectLike({
          ACTIVE_PRICE_BOOK_VERSION: "pricebook_default",
          APP_SETTINGS_TABLE: Match.anyValue(),
          ARTIFACT_BUCKET: Match.anyValue(),
          ARTIFACTS_TABLE: Match.anyValue(),
          CONTROLLED_FIXTURE_SHA256: Match.stringLikeRegexp("^[0-9a-f]{64}$"),
          DEV_ACCESS_TOKEN_SECRET_ARN: Match.anyValue(),
          DOCUMENTS_TABLE: Match.anyValue(),
          EVALUATION_RESULTS_TABLE: Match.anyValue(),
          LEDGER_ITEMS_TABLE: Match.anyValue(),
          MAX_SOURCE_PDF_BYTES: "10485760",
          PRICE_BOOKS_TABLE: Match.anyValue(),
          PRICE_BOOK_HUMAN_REVIEW_HOURLY_RATE_USD: "90",
          REVIEW_DECISIONS_TABLE: Match.anyValue(),
          RUNS_TABLE: Match.anyValue(),
          SOURCE_UPLOAD_EXPIRES_IN_SECONDS: "600",
          STAGE: "dev",
          STAGE_EVENTS_TABLE: Match.anyValue(),
          TRANSLATION_JOBS_TABLE: Match.anyValue(),
          WORKSPACE_ID: "ws_default"
        })
      }
    });

    const lambda = resourceValues(controlApi, "AWS::Lambda::Function")[0];
    const lambdaProperties = properties(lambda);
    expect(lambdaProperties.MemorySize).toBe(256);
    expect(lambdaProperties.Timeout).toBe(8);
    expect(lambdaProperties.ReservedConcurrentExecutions).toBe(5);
    const environment = lambdaProperties.Environment;
    if (!isRecord(environment) || !isRecord(environment.Variables)) {
      throw new Error("Expected Lambda environment variables.");
    }
    expect(environment.Variables.AWS_REGION).toBeUndefined();
    expect(JSON.stringify(environment.Variables)).not.toContain("x-dev-access-token");

    const code = lambdaProperties.Code;
    if (!isRecord(code)) {
      throw new Error("Expected bundled Lambda code.");
    }
    expect(code.ZipFile).toBeUndefined();

    let sawDynamo = false;
    let sawS3 = false;
    let sawSecretRead = false;
    for (const resource of resourceValues(controlApi, "AWS::IAM::Policy")) {
      const policyDocument = properties(resource).PolicyDocument;
      if (!isRecord(policyDocument) || !Array.isArray(policyDocument.Statement)) {
        throw new Error("Expected IAM policy statements.");
      }

      const actions = policyDocument.Statement.flatMap((statement) =>
        isRecord(statement) ? actionValues(statement.Action) : []
      );
      sawDynamo ||= actions.some((action) => action.startsWith("dynamodb:"));
      sawS3 ||= actions.some((action) => action.startsWith("s3:"));
      sawSecretRead ||= actions.includes("secretsmanager:GetSecretValue");
      expect(actions.some((action) => action.startsWith("bedrock:"))).toBe(false);
      expect(actions.some((action) => action.startsWith("bedrock-agentcore:"))).toBe(false);
      expect(actions).not.toContain("lambda:InvokeFunction");
    }
    expect(sawDynamo).toBe(true);
    expect(sawS3).toBe(true);
    expect(sawSecretRead).toBe(true);

    controlApi.resourceCountIs("AWS::SecretsManager::Secret", 1);
    controlApi.hasResourceProperties("AWS::SecretsManager::Secret", {
      Name: "agentcore-pdf-translator-dev-control-api-dev-access-token",
      GenerateSecretString: Match.objectLike({
        PasswordLength: 48,
        ExcludePunctuation: true
      })
    });
    controlApi.hasResourceProperties("Custom::LogRetention", {
      LogGroupName: Match.anyValue(),
      RetentionInDays: 7
    });

    for (const permission of resourceValues(controlApi, "AWS::Lambda::Permission")) {
      const permissionProperties = properties(permission);
      expect(permissionProperties.Principal).toBe("apigateway.amazonaws.com");
      expect(JSON.stringify(permissionProperties.SourceArn)).toContain("execute-api");
    }

    controlApi.hasOutput("ControlApiUrl", {});
    controlApi.hasOutput("ControlApiLambdaName", {});
    controlApi.hasOutput("ControlApiDevAccessTokenSecretArn", {});
    controlApi.hasOutput("ControlApiAccessMode", {
      Value: "DEV_SECRET_HEADER"
    });
    controlApi.hasOutput("ControlApiSmokeRoute", {
      Value: "GET /api/price-books/current"
    });
  });

  it("keeps PR-007 free of deferred service resources and context lookups", () => {
    const templates = Object.values(synthesize());
    const resourceTypes = allResourceTypes(templates);

    expect(resourceTypes).not.toContain("AWS::EC2::VPC");
    expect(resourceTypes).not.toContain("AWS::Cognito::UserPool");
    expect(resourceTypes).not.toContain("AWS::BedrockAgentCore::Runtime");
    expect(resourceTypes).not.toContain("AWS::BedrockAgentCore::Gateway");
    expect(resourceTypes).not.toContain("AWS::Bedrock::Agent");

    const lambdaCount = resourceTypes.filter((type) => type === "AWS::Lambda::Function").length;
    expect(lambdaCount).toBeLessThanOrEqual(2);
  });

  it("rejects unsafe stage and anonymous API configuration", () => {
    expect(() => synthesize({ stage: "Prod" })).toThrow(/Stage/u);
    expect(() => synthesize({ stage: "dev-stage-name-too-long" })).toThrow(/15/u);
    expect(() =>
      synthesize({ stage: "prod", allowUnauthenticatedPlaceholderApi: true })
    ).toThrow(/Anonymous/u);
  });
});
