import { CfnOutput, Duration, Stack } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";
import { CfnStage, HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import type { Bucket } from "aws-cdk-lib/aws-s3";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AppConfig } from "../config.js";
import { controlApiLambdaName, controlApiName } from "../names.js";
import type { DatabaseTables } from "./database-stack.js";

type RouteDefinition = {
  readonly method: HttpMethod;
  readonly path: string;
};

export type ControlApiStackProps = StackProps & {
  readonly artifactBucket: Bucket;
  readonly config: AppConfig;
  readonly tables: DatabaseTables;
};

const routeDefinitions: ReadonlyArray<RouteDefinition> = [
  { method: HttpMethod.POST, path: "/api/documents/presign" },
  { method: HttpMethod.POST, path: "/api/documents" },
  { method: HttpMethod.GET, path: "/api/documents" },
  { method: HttpMethod.GET, path: "/api/documents/{documentId}" },
  { method: HttpMethod.POST, path: "/api/documents/{documentId}/inspect" },
  { method: HttpMethod.GET, path: "/api/documents/{documentId}/jobs" },
  { method: HttpMethod.POST, path: "/api/documents/{documentId}/jobs" },
  { method: HttpMethod.GET, path: "/api/jobs" },
  { method: HttpMethod.GET, path: "/api/jobs/{jobId}" },
  { method: HttpMethod.GET, path: "/api/jobs/{jobId}/runs" },
  { method: HttpMethod.GET, path: "/api/jobs/{jobId}/ledger" },
  { method: HttpMethod.GET, path: "/api/jobs/{jobId}/economics" },
  { method: HttpMethod.POST, path: "/api/jobs/{jobId}/runs" },
  { method: HttpMethod.GET, path: "/api/runs/{runId}" },
  { method: HttpMethod.GET, path: "/api/runs/{runId}/timeline" },
  { method: HttpMethod.GET, path: "/api/runs/{runId}/artifacts" },
  { method: HttpMethod.GET, path: "/api/runs/{runId}/evaluation" },
  { method: HttpMethod.GET, path: "/api/runs/{runId}/ledger" },
  { method: HttpMethod.POST, path: "/api/runs/{runId}/review" },
  { method: HttpMethod.GET, path: "/api/artifacts/{artifactId}/download-url" },
  { method: HttpMethod.GET, path: "/api/compare" },
  { method: HttpMethod.GET, path: "/api/price-books/current" },
  { method: HttpMethod.PUT, path: "/api/price-books/current" }
];

const sourceUploadExpiresInSeconds = "600";
const maxSourcePdfBytes = "10485760";

function controlledFixtureSha256(): string {
  const stackDir = dirname(fileURLToPath(import.meta.url));
  const fixturePath = join(stackDir, "../../../demo-data/controlled-spanish-source.pdf");
  return createHash("sha256").update(readFileSync(fixturePath)).digest("hex");
}

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

export class ControlApiStack extends Stack {
  public readonly controlApi: HttpApi;
  public readonly controlApiLambda: NodejsFunction;
  public readonly cloudFrontOriginProofSecret: Secret;

  public constructor(scope: Construct, id: string, props: ControlApiStackProps) {
    super(scope, id, props);

    const devAccessTokenSecret = new Secret(this, "DevAccessTokenSecret", {
      secretName: `${props.config.resourcePrefix}-control-api-dev-access-token`,
      description: "Dev-only Control API access token for PR-010 direct and CI verification.",
      generateSecretString: {
        passwordLength: 48,
        excludePunctuation: true
      }
    });
    this.cloudFrontOriginProofSecret = new Secret(this, "CloudFrontOriginProofSecret", {
      secretName: `${props.config.resourcePrefix}-control-api-cloudfront-origin-proof`,
      description: "Dev-only shared origin proof injected by CloudFront before Control API origin requests.",
      generateSecretString: {
        passwordLength: 48,
        excludePunctuation: true
      }
    });

    const stackDir = dirname(fileURLToPath(import.meta.url));
    this.controlApiLambda = new NodejsFunction(this, "ControlApiPlaceholderLambda", {
      functionName: controlApiLambdaName(props.config),
      runtime: Runtime.NODEJS_24_X,
      entry: join(stackDir, "../../../apps/control-api/src/lambda.ts"),
      handler: "handler",
      memorySize: 256,
      timeout: Duration.seconds(8),
      logRetention: RetentionDays.ONE_WEEK,
      bundling: {
        format: OutputFormat.ESM,
        mainFields: ["module", "main"],
        sourceMap: false,
        externalModules: []
      },
      environment: {
        STAGE: props.config.stage,
        WORKSPACE_ID: props.config.workspaceId,
        ACTIVE_PRICE_BOOK_VERSION: props.config.activePriceBookVersion,
        ARTIFACT_BUCKET: props.artifactBucket.bucketName,
        DEV_ACCESS_TOKEN_SECRET_ARN: devAccessTokenSecret.secretArn,
        CLOUDFRONT_ORIGIN_PROOF_SECRET_ARN: this.cloudFrontOriginProofSecret.secretArn,
        SOURCE_UPLOAD_EXPIRES_IN_SECONDS: sourceUploadExpiresInSeconds,
        MAX_SOURCE_PDF_BYTES: maxSourcePdfBytes,
        CONTROLLED_FIXTURE_SHA256: controlledFixtureSha256(),
        PRICE_BOOK_HUMAN_REVIEW_HOURLY_RATE_USD: props.config.priceBookHumanReviewHourlyRateUsd,
        BUILD_SHA: process.env.GITHUB_SHA ?? "local-synth",
        ...tableEnvironment(props.tables)
      }
    });
    devAccessTokenSecret.grantRead(this.controlApiLambda);
    this.cloudFrontOriginProofSecret.grantRead(this.controlApiLambda);
    props.artifactBucket.grantReadWrite(this.controlApiLambda);
    for (const table of Object.values(props.tables)) {
      table.grantReadWriteData(this.controlApiLambda);
    }

    this.controlApi = new HttpApi(this, "ControlApi", {
      apiName: controlApiName(props.config),
      createDefaultStage: true
    });
    const defaultStageResource = this.controlApi.defaultStage?.node.defaultChild;
    if (!(defaultStageResource instanceof CfnStage)) {
      throw new Error("Expected Control API default stage CloudFormation resource.");
    }
    defaultStageResource.defaultRouteSettings = {
      throttlingBurstLimit: 20,
      throttlingRateLimit: 10
    };

    const integration = new HttpLambdaIntegration(
      "ControlApiIntegration",
      this.controlApiLambda
    );

    for (const route of routeDefinitions) {
      this.controlApi.addRoutes({
        path: route.path,
        methods: [route.method],
        integration
      });
    }

    new CfnOutput(this, "ControlApiUrl", {
      value: this.controlApi.url ?? "unavailable"
    });

    new CfnOutput(this, "ControlApiLambdaName", {
      value: this.controlApiLambda.functionName
    });

    new CfnOutput(this, "ControlApiDevAccessTokenSecretArn", {
      value: devAccessTokenSecret.secretArn
    });

    new CfnOutput(this, "ControlApiOriginProofSecretArn", {
      value: this.cloudFrontOriginProofSecret.secretArn
    });

    new CfnOutput(this, "ControlApiAccessMode", {
      value: "DEV_SECRET_HEADER_OR_CLOUDFRONT_ORIGIN_PROOF"
    });

    new CfnOutput(this, "ControlApiSmokeRoute", {
      value: "GET /api/price-books/current"
    });
  }
}
