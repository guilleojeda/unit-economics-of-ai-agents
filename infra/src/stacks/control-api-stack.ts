import { CfnOutput, Duration, Stack } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";
import { HttpApi, HttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpIamAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import type { Bucket } from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import type { AppConfig } from "../config.js";
import { controlApiPlaceholderSource } from "../lambda/control-api-placeholder.js";
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
  { method: HttpMethod.GET, path: "/api/compare" },
  { method: HttpMethod.GET, path: "/api/price-books/current" },
  { method: HttpMethod.PUT, path: "/api/price-books/current" }
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

export class ControlApiStack extends Stack {
  public readonly controlApi: HttpApi;
  public readonly controlApiLambda: Function;

  public constructor(scope: Construct, id: string, props: ControlApiStackProps) {
    super(scope, id, props);

    this.controlApiLambda = new Function(this, "ControlApiPlaceholderLambda", {
      functionName: controlApiLambdaName(props.config),
      runtime: Runtime.NODEJS_24_X,
      handler: "index.handler",
      code: Code.fromInline(controlApiPlaceholderSource),
      memorySize: 128,
      timeout: Duration.seconds(10),
      environment: {
        STAGE: props.config.stage,
        WORKSPACE_ID: props.config.workspaceId,
        ACTIVE_PRICE_BOOK_VERSION: props.config.activePriceBookVersion,
        ARTIFACT_BUCKET: props.artifactBucket.bucketName,
        ...tableEnvironment(props.tables)
      }
    });

    this.controlApi = new HttpApi(this, "ControlApi", {
      apiName: controlApiName(props.config),
      createDefaultStage: true,
      ...(props.config.allowUnauthenticatedPlaceholderApi
        ? {}
        : {
            defaultAuthorizer: new HttpIamAuthorizer()
          })
    });

    const integration = new HttpLambdaIntegration(
      "ControlApiPlaceholderIntegration",
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
  }
}
