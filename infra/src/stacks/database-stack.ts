import { CfnOutput, RemovalPolicy, Stack } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";
import {
  AttributeType,
  BillingMode,
  ProjectionType,
  Table,
  type GlobalSecondaryIndexProps,
  type TableProps
} from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";
import type { AppConfig } from "../config.js";
import { tableName, type TableKey } from "../names.js";

type TableDefinition = {
  readonly key: TableKey;
  readonly partitionKey: string;
  readonly sortKey?: string;
  readonly outputName: string;
  readonly globalSecondaryIndexes?: ReadonlyArray<IndexDefinition>;
};

type IndexDefinition = {
  readonly indexName: string;
  readonly partitionKey: string;
  readonly sortKey?: string;
};

export type DatabaseTables = Readonly<Record<TableKey, Table>>;

export type DatabaseStackProps = StackProps & {
  readonly config: AppConfig;
};

const tableDefinitions: ReadonlyArray<TableDefinition> = [
  {
    key: "Documents",
    partitionKey: "documentId",
    outputName: "DocumentsTableName",
    globalSecondaryIndexes: [
      {
        indexName: "byWorkspace",
        partitionKey: "workspaceId",
        sortKey: "createdAtDocumentId"
      }
    ]
  },
  {
    key: "TranslationJobs",
    partitionKey: "jobId",
    outputName: "TranslationJobsTableName",
    globalSecondaryIndexes: [
      {
        indexName: "byDocument",
        partitionKey: "documentId",
        sortKey: "createdAtJobId"
      },
      {
        indexName: "byComparisonGroup",
        partitionKey: "comparisonGroupId",
        sortKey: "workflowVariantCreatedAtJobId"
      },
      {
        indexName: "byStatus",
        partitionKey: "status",
        sortKey: "updatedAtJobId"
      }
    ]
  },
  {
    key: "Runs",
    partitionKey: "runId",
    outputName: "RunsTableName",
    globalSecondaryIndexes: [
      {
        indexName: "byJob",
        partitionKey: "jobId",
        sortKey: "attemptNumberPaddedCreatedAtRunId"
      },
      {
        indexName: "byDocument",
        partitionKey: "documentId",
        sortKey: "createdAtRunId"
      },
      {
        indexName: "byStatus",
        partitionKey: "status",
        sortKey: "updatedAtRunId"
      }
    ]
  },
  {
    key: "StageEvents",
    partitionKey: "runId",
    sortKey: "sequencePaddedStageNameStageEventId",
    outputName: "StageEventsTableName"
  },
  {
    key: "Artifacts",
    partitionKey: "artifactId",
    outputName: "ArtifactsTableName",
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
      {
        indexName: "byJob",
        partitionKey: "jobId",
        sortKey: "createdAtArtifactId"
      }
    ]
  },
  {
    key: "LedgerItems",
    partitionKey: "runId",
    sortKey: "stageSequencePaddedCreatedAtLedgerItemId",
    outputName: "LedgerItemsTableName",
    globalSecondaryIndexes: [
      {
        indexName: "byJob",
        partitionKey: "jobId",
        sortKey: "createdAtLedgerItemId"
      },
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
  },
  {
    key: "EvaluationResults",
    partitionKey: "runId",
    sortKey: "createdAtEvaluationResultId",
    outputName: "EvaluationResultsTableName"
  },
  {
    key: "ReviewDecisions",
    partitionKey: "jobId",
    sortKey: "createdAtReviewDecisionId",
    outputName: "ReviewDecisionsTableName"
  },
  {
    key: "PriceBooks",
    partitionKey: "priceBookVersion",
    outputName: "PriceBooksTableName",
    globalSecondaryIndexes: [
      {
        indexName: "byStatus",
        partitionKey: "status",
        sortKey: "updatedAtPriceBookVersion"
      }
    ]
  },
  {
    key: "AppSettings",
    partitionKey: "settingKey",
    outputName: "AppSettingsTableName"
  }
];

function createTable(scope: Construct, config: AppConfig, definition: TableDefinition): Table {
  const tableProps: TableProps = {
    tableName: tableName(config, definition.key),
    partitionKey: {
      name: definition.partitionKey,
      type: AttributeType.STRING
    },
    ...(definition.sortKey === undefined
      ? {}
      : {
          sortKey: {
            name: definition.sortKey,
            type: AttributeType.STRING
          }
        }),
    billingMode: BillingMode.PAY_PER_REQUEST,
    deletionProtection: config.stage === "prod",
    pointInTimeRecoverySpecification: {
      pointInTimeRecoveryEnabled: true
    },
    removalPolicy: RemovalPolicy.RETAIN
  };

  const table = new Table(scope, definition.key, tableProps);

  for (const index of definition.globalSecondaryIndexes ?? []) {
    const indexProps: GlobalSecondaryIndexProps = {
      indexName: index.indexName,
      partitionKey: {
        name: index.partitionKey,
        type: AttributeType.STRING
      },
      ...(index.sortKey === undefined
        ? {}
        : {
            sortKey: {
              name: index.sortKey,
              type: AttributeType.STRING
            }
          }),
      projectionType: ProjectionType.ALL
    };

    table.addGlobalSecondaryIndex(indexProps);
  }

  return table;
}

export class DatabaseStack extends Stack {
  public readonly tables: DatabaseTables;

  public constructor(scope: Construct, id: string, props: DatabaseStackProps) {
    super(scope, id, props);

    const entries = tableDefinitions.map(
      (definition) => [definition.key, createTable(this, props.config, definition)] as const
    );
    this.tables = Object.fromEntries(entries) as DatabaseTables;

    for (const definition of tableDefinitions) {
      new CfnOutput(this, definition.outputName, {
        value: this.tables[definition.key].tableName
      });
    }
  }
}
