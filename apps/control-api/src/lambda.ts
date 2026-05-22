import {
  createPersistentRepositories,
  type PersistentRepositories
} from "@agentcore-pdf-translator/data/persistent";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import type { PriceBook } from "@agentcore-pdf-translator/schemas";
import { dispatch } from "./router.js";
import { ControlApiError, errorResponse } from "./errors.js";
import { createAgentCoreRuntimeClient } from "./agentcore-runtime-client.js";
import type {
  ApiRequest,
  ApiResponse,
  ControlApiContext,
  HttpMethod
} from "./types.js";

type ApiGatewayV2Event = {
  readonly version?: string;
  readonly rawPath?: string;
  readonly requestContext?: {
    readonly http?: {
      readonly method?: string;
      readonly path?: string;
    };
    readonly requestId?: string;
  };
  readonly headers?: Record<string, string | undefined>;
  readonly queryStringParameters?: Record<string, string | undefined> | null;
  readonly body?: string | null;
  readonly isBase64Encoded?: boolean;
};

const devAccessHeader = "x-dev-access-token";
const cloudFrontOriginProofHeader = "x-cloudfront-origin-proof";
const jsonBodyLimitBytes = 64 * 1024;
const defaultSourceUploadExpiresInSeconds = 600;
const defaultMaxSourcePdfBytes = 10 * 1024 * 1024;

const secretsClient = new SecretsManagerClient({ region: "us-east-1" });
const cachedSecrets = new Map<string, string>();
let cachedContext: ControlApiContext | undefined;

function env(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new ControlApiError("INTERNAL_ERROR", `Missing required runtime configuration: ${name}`);
  }

  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value.length === 0 ? undefined : value;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || value.length === 0) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ControlApiError("INTERNAL_ERROR", "Runtime integer configuration is invalid");
  }

  return parsed;
}

function parseSecretToken(secretString: string): string {
  try {
    const parsed = JSON.parse(secretString) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "token" in parsed &&
      typeof parsed.token === "string"
    ) {
      return parsed.token;
    }
  } catch {
    return secretString;
  }

  return secretString;
}

async function getExpectedSecretToken(envName: string, emptyMessage: string): Promise<string> {
  const secretId = env(envName);
  const cachedToken = cachedSecrets.get(secretId);
  if (cachedToken !== undefined) {
    return cachedToken;
  }

  const response = await secretsClient.send(new GetSecretValueCommand({ SecretId: secretId }));
  if (typeof response.SecretString !== "string" || response.SecretString.length === 0) {
    throw new ControlApiError("INTERNAL_ERROR", emptyMessage);
  }

  const token = parseSecretToken(response.SecretString);
  cachedSecrets.set(secretId, token);
  return token;
}

function normalizedHeaders(headers: Record<string, string | undefined> | undefined): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (value !== undefined) {
      normalized[key.toLowerCase()] = value;
    }
  }

  return normalized;
}

function timingSafeStringEquals(left: string, right: string): boolean {
  const leftBytes = createHash("sha256").update(left).digest();
  const rightBytes = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftBytes, rightBytes) && left === right;
}

function headerCount(
  headers: Record<string, string | undefined> | undefined,
  headerName: string
): number {
  return Object.entries(headers ?? {}).filter(
    ([key, value]) => key.toLowerCase() === headerName && value !== undefined
  ).length;
}

function requireSingleHeaderValue(
  headers: Record<string, string | undefined> | undefined,
  normalized: Record<string, string>,
  headerName: string,
  rejectionMessage: string
): string | undefined {
  if (headerCount(headers, headerName) > 1) {
    throw new ControlApiError("AUTH_FORBIDDEN", rejectionMessage);
  }

  const supplied = normalized[headerName];
  if (supplied === undefined || supplied.length === 0) {
    return undefined;
  }

  if (supplied !== supplied.trim() || supplied.includes(",")) {
    throw new ControlApiError("AUTH_FORBIDDEN", rejectionMessage);
  }

  return supplied;
}

async function authorize(headers: Record<string, string | undefined> | undefined): Promise<void> {
  const normalized = normalizedHeaders(headers);
  const suppliedDevToken = requireSingleHeaderValue(
    headers,
    normalized,
    devAccessHeader,
    "Dev API access token was rejected"
  );
  const suppliedOriginProof = requireSingleHeaderValue(
    headers,
    normalized,
    cloudFrontOriginProofHeader,
    "CloudFront origin proof was rejected"
  );

  if (suppliedDevToken !== undefined && suppliedOriginProof !== undefined) {
    throw new ControlApiError("AUTH_FORBIDDEN", "Exactly one Control API credential is allowed");
  }

  if (suppliedDevToken === undefined && suppliedOriginProof === undefined) {
    throw new ControlApiError("AUTH_REQUIRED", "Control API credential is required");
  }

  if (suppliedDevToken !== undefined) {
    const expectedToken = await getExpectedSecretToken(
      "DEV_ACCESS_TOKEN_SECRET_ARN",
      "Dev access token secret is empty or unavailable"
    );
    if (!timingSafeStringEquals(suppliedDevToken, expectedToken)) {
      throw new ControlApiError("AUTH_FORBIDDEN", "Dev API access token was rejected");
    }
    return;
  }

  const expectedOriginProof = await getExpectedSecretToken(
    "CLOUDFRONT_ORIGIN_PROOF_SECRET_ARN",
    "CloudFront origin proof secret is empty or unavailable"
  );
  if (!timingSafeStringEquals(suppliedOriginProof ?? "", expectedOriginProof)) {
    throw new ControlApiError("AUTH_FORBIDDEN", "CloudFront origin proof was rejected");
  }
}

function parseMethod(method: string | undefined): HttpMethod {
  switch (method) {
    case "GET":
    case "POST":
    case "PUT":
    case "DELETE":
    case "PATCH":
    case "HEAD":
    case "OPTIONS":
      return method;
    default:
      throw new ControlApiError("METHOD_NOT_ALLOWED", "Unsupported HTTP method");
  }
}

function parseBody(event: ApiGatewayV2Event): unknown {
  if (event.body === undefined || event.body === null || event.body.length === 0) {
    return undefined;
  }

  const rawBody = event.isBase64Encoded === true
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  if (Buffer.byteLength(rawBody, "utf8") > jsonBodyLimitBytes) {
    throw new ControlApiError("PAYLOAD_TOO_LARGE", "JSON request body exceeds the dev API limit", {
      maxBodyBytes: jsonBodyLimitBytes
    });
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new ControlApiError("VALIDATION_ERROR", "Request body must be valid JSON");
  }
}

function defaultPriceBook(now: string): PriceBook {
  const priceBookVersion = env("ACTIVE_PRICE_BOOK_VERSION");
  return {
    priceBookVersion,
    status: "ACTIVE",
    currency: "USD",
    modelPrices: [],
    agentCorePrices: {},
    externalServicePrices: [],
    humanReviewHourlyRateDefaultUsd: Number(env("PRICE_BOOK_HUMAN_REVIEW_HOURLY_RATE_USD")),
    sourceNotes: ["PR-010 dev configuration price book; update through repository-controlled configuration."],
    createdAt: now,
    updatedAt: now
  };
}

async function createContext(): Promise<ControlApiContext> {
  if (cachedContext !== undefined) {
    return cachedContext;
  }

  const persistent = createPersistentRepositories({
    config: {
      region: "us-east-1",
      artifactBucketName: env("ARTIFACT_BUCKET"),
      tableNames: {
        documents: env("DOCUMENTS_TABLE"),
        translationJobs: env("TRANSLATION_JOBS_TABLE"),
        runs: env("RUNS_TABLE"),
        stageEvents: env("STAGE_EVENTS_TABLE"),
        artifacts: env("ARTIFACTS_TABLE"),
        ledgerItems: env("LEDGER_ITEMS_TABLE"),
        evaluationResults: env("EVALUATION_RESULTS_TABLE"),
        reviewDecisions: env("REVIEW_DECISIONS_TABLE"),
        priceBooks: env("PRICE_BOOKS_TABLE"),
        appSettings: env("APP_SETTINGS_TABLE")
      }
    }
  });

  const agentRuntimeClient = createAgentCoreRuntimeClient({
    agentRuntimeArn: env("AGENTCORE_RUNTIME_ARN"),
    qualifier: env("AGENTCORE_RUNTIME_QUALIFIER")
  });
  const context: ControlApiContext = {
    workspaceId: env("WORKSPACE_ID"),
    repositories: {
      documents: persistent.documents,
      jobs: persistent.translationJobs,
      runs: persistent.runs,
      stageEvents: persistent.stageEvents,
      artifacts: persistent.artifacts,
      ledgerItems: persistent.ledgerItems,
      evaluations: persistent.evaluationResults,
      reviewDecisions: persistent.reviewDecisions,
      priceBooks: persistent.priceBooks,
      appSettings: persistent.appSettings
    },
    artifactObjects: persistent.artifactObjects,
    config: {
      artifactBucketName: env("ARTIFACT_BUCKET"),
      sourceUploadExpiresInSeconds: parsePositiveInteger(
        optionalEnv("SOURCE_UPLOAD_EXPIRES_IN_SECONDS"),
        defaultSourceUploadExpiresInSeconds
      ),
      maxSourcePdfBytes: parsePositiveInteger(optionalEnv("MAX_SOURCE_PDF_BYTES"), defaultMaxSourcePdfBytes),
      controlledFixtureSha256: env("CONTROLLED_FIXTURE_SHA256"),
      businessUsdMax: 1_000_000
    },
    agentRuntimeClient,
    now: () => new Date().toISOString(),
    createId: (prefix) => `${prefix}_${randomUUID()}`
  };

  cachedContext = context;
  await seedPriceBook(cachedContext, persistent);
  return cachedContext;
}

async function seedPriceBook(context: ControlApiContext, persistent: PersistentRepositories): Promise<void> {
  const now = context.now();
  const priceBook = defaultPriceBook(now);
  await persistent.priceBooks.put(priceBook);
  await persistent.appSettings.put({
    settingKey: "ACTIVE_PRICE_BOOK_VERSION",
    settingValue: priceBook.priceBookVersion,
    updatedAt: now
  });
}

function routeRequest(event: ApiGatewayV2Event): ApiRequest {
  const method = parseMethod(event.requestContext?.http?.method);
  return {
    method,
    path: event.rawPath ?? event.requestContext?.http?.path ?? "/",
    headers: normalizedHeaders(event.headers),
    ...(event.queryStringParameters === undefined || event.queryStringParameters === null
      ? {}
      : { query: event.queryStringParameters }),
    body: parseBody(event)
  };
}

function toLambdaResponse(response: ApiResponse, requestId: string | undefined): {
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
} {
  return {
    statusCode: response.statusCode,
    headers: {
      ...response.headers,
      "x-control-api-stage": optionalEnv("STAGE") ?? "dev",
      "x-control-api-workspace": optionalEnv("WORKSPACE_ID") ?? "unknown",
      ...(requestId === undefined ? {} : { "x-control-api-request-id": requestId }),
      ...(optionalEnv("BUILD_SHA") === undefined ? {} : { "x-control-api-build-sha": env("BUILD_SHA") })
    },
    body: JSON.stringify(response.body)
  };
}

export async function handler(event: ApiGatewayV2Event): Promise<{
  readonly statusCode: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}> {
  const startedAt = Date.now();
  const requestId = event.requestContext?.requestId;
  let response: ApiResponse;
  try {
    await authorize(event.headers);
    const context = await createContext();
    response = await dispatch(context, routeRequest(event));
  } catch (error) {
    response = error instanceof ControlApiError
      ? errorResponse(error)
      : errorResponse(new ControlApiError("INTERNAL_ERROR", "Internal server error"));
  }

  console.log(
    JSON.stringify({
      route: `${event.requestContext?.http?.method ?? "UNKNOWN"} ${event.rawPath ?? "UNKNOWN"}`,
      statusCode: response.statusCode,
      requestId,
      stage: optionalEnv("STAGE") ?? "dev",
      workspaceId: optionalEnv("WORKSPACE_ID") ?? "unknown",
      buildSha: optionalEnv("BUILD_SHA") ?? null,
      durationMs: Date.now() - startedAt,
      errorCode:
        typeof response.body === "object" &&
        response.body !== null &&
        "error" in response.body &&
        typeof response.body.error === "object" &&
        response.body.error !== null &&
        "code" in response.body.error
          ? response.body.error.code
          : null
    })
  );

  return toLambdaResponse(response, requestId);
}
