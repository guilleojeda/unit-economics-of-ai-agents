import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  type QueryCommandInput
} from "@aws-sdk/lib-dynamodb";
import {
  RepositoryConflictError,
  RepositoryConfigError,
  RepositorySerializationError
} from "../errors.js";
import type { DynamoDbItem } from "./mappers.js";

export type DynamoTableNames = {
  readonly documents: string;
  readonly translationJobs: string;
  readonly runs: string;
  readonly stageEvents: string;
  readonly artifacts: string;
  readonly ledgerItems: string;
  readonly evaluationResults: string;
  readonly reviewDecisions: string;
  readonly priceBooks: string;
  readonly appSettings: string;
};

export type PersistentRepositoryConfig = {
  readonly region: "us-east-1";
  readonly tableNames: DynamoTableNames;
  readonly artifactBucketName: string;
};

export type DynamoCommand = PutCommand | GetCommand | QueryCommand;

export type DynamoDbSender = {
  send(command: DynamoCommand): Promise<unknown>;
};

export function validatePersistentRepositoryConfig(
  config: PersistentRepositoryConfig
): PersistentRepositoryConfig {
  if (config.region !== "us-east-1") {
    throw new RepositoryConfigError("Persistent repositories must be configured for us-east-1");
  }

  const requiredTableKeys = [
    "documents",
    "translationJobs",
    "runs",
    "stageEvents",
    "artifacts",
    "ledgerItems",
    "evaluationResults",
    "reviewDecisions",
    "priceBooks",
    "appSettings"
  ] as const;

  if (Object.keys(config.tableNames).length !== requiredTableKeys.length) {
    throw new RepositoryConfigError("Persistent repositories require all 10 DynamoDB table names");
  }

  for (const key of requiredTableKeys) {
    const value = config.tableNames[key];
    if (typeof value !== "string" || value.length === 0) {
      throw new RepositoryConfigError(`Missing DynamoDB table name for ${key}`);
    }
  }

  if (config.artifactBucketName.length === 0) {
    throw new RepositoryConfigError("Persistent repositories require an artifact bucket name");
  }

  return config;
}

export function createDynamoDbDocumentSender(region: "us-east-1"): DynamoDbSender {
  const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
    marshallOptions: {
      removeUndefinedValues: true
    }
  });

  return {
    async send(command: DynamoCommand): Promise<unknown> {
      if (command instanceof PutCommand) {
        return documentClient.send(command);
      }

      if (command instanceof GetCommand) {
        return documentClient.send(command);
      }

      return documentClient.send(command);
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDynamoItemArray(value: unknown): value is DynamoDbItem[] {
  return Array.isArray(value) && value.every(isRecord);
}

function responseItem(response: unknown): DynamoDbItem | undefined {
  if (!isRecord(response)) {
    throw new RepositorySerializationError("DynamoDB get response is not an object");
  }

  const item = response.Item;
  if (item === undefined) {
    return undefined;
  }

  if (!isRecord(item)) {
    throw new RepositorySerializationError("DynamoDB get Item is not an object");
  }

  return item;
}

function responseItems(response: unknown): DynamoDbItem[] {
  if (!isRecord(response)) {
    throw new RepositorySerializationError("DynamoDB query response is not an object");
  }

  const items = response.Items ?? [];
  if (!isDynamoItemArray(items)) {
    throw new RepositorySerializationError("DynamoDB query Items is not an object array");
  }

  return items;
}

function responseLastEvaluatedKey(response: unknown): DynamoDbItem | undefined {
  if (!isRecord(response)) {
    throw new RepositorySerializationError("DynamoDB query response is not an object");
  }

  const lastEvaluatedKey = response.LastEvaluatedKey;
  if (lastEvaluatedKey === undefined) {
    return undefined;
  }

  if (!isRecord(lastEvaluatedKey)) {
    throw new RepositorySerializationError("DynamoDB LastEvaluatedKey is not an object");
  }

  return lastEvaluatedKey;
}

function isConditionalCheckFailure(error: unknown): boolean {
  return isRecord(error) && error.name === "ConditionalCheckFailedException";
}

export async function sendPut(
  client: DynamoDbSender,
  command: PutCommand,
  conflictMessage: string
): Promise<void> {
  try {
    await client.send(command);
  } catch (error: unknown) {
    if (isConditionalCheckFailure(error)) {
      throw new RepositoryConflictError(conflictMessage);
    }

    throw error;
  }
}

export async function getOne(
  client: DynamoDbSender,
  tableName: string,
  key: DynamoDbItem
): Promise<DynamoDbItem | undefined> {
  const response = await client.send(
    new GetCommand({
      TableName: tableName,
      Key: key,
      ConsistentRead: true
    })
  );

  return responseItem(response);
}

export async function queryAll(
  client: DynamoDbSender,
  input: QueryCommandInput
): Promise<DynamoDbItem[]> {
  const items: DynamoDbItem[] = [];
  let exclusiveStartKey: DynamoDbItem | undefined;

  do {
    const response = await client.send(
      new QueryCommand({
        ...input,
        ...(exclusiveStartKey === undefined ? {} : { ExclusiveStartKey: exclusiveStartKey })
      })
    );
    items.push(...responseItems(response));
    exclusiveStartKey = responseLastEvaluatedKey(response);
  } while (exclusiveStartKey !== undefined);

  return items;
}
