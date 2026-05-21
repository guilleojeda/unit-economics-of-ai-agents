import { Sha256 } from "@aws-crypto/sha256-js";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { HttpRequest } from "@smithy/protocol-http";
import { SignatureV4 } from "@smithy/signature-v4";
import {
  GatewayToolResponseSchema,
  type GatewayFileToolRequest,
  type GatewayToolResponse
} from "@agentcore-pdf-translator/schemas";

export type GatewayClient = {
  callTool(request: GatewayFileToolRequest, targetName: string, toolName: string): Promise<GatewayToolResponse>;
};

export type GatewayClientOptions = {
  readonly gatewayUrl: string;
  readonly region?: "us-east-1";
  readonly fetchImpl?: typeof fetch;
  readonly skipSigning?: boolean;
};

type JsonRpcSuccess = {
  readonly result?: unknown;
};

type JsonRpcFailure = {
  readonly error?: {
    readonly code?: unknown;
    readonly message?: unknown;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mcpToolName(targetName: string, toolName: string): string {
  return `${targetName}___${toolName}`;
}

function gatewayEndpoint(gatewayUrl: string): URL {
  const url = new URL(gatewayUrl);
  url.pathname = "/mcp";
  url.search = "";
  return url;
}

function stringHeaders(headers: Headers | Record<string, unknown>): Record<string, string> {
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  const output: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") {
      output[key] = value;
    }
  }
  return output;
}

async function signedHeaders(
  endpoint: URL,
  body: string,
  region: "us-east-1"
): Promise<Record<string, string>> {
  const signer = new SignatureV4({
    service: "bedrock-agentcore",
    region,
    credentials: defaultProvider(),
    sha256: Sha256
  });
  const request = new HttpRequest({
    protocol: endpoint.protocol,
    hostname: endpoint.hostname,
    path: endpoint.pathname,
    method: "POST",
    headers: {
      host: endpoint.hostname,
      "content-type": "application/json"
    },
    body
  });
  const signed = await signer.sign(request);
  return stringHeaders(signed.headers);
}

function parseJsonRpcResponse(value: unknown): GatewayToolResponse {
  if (isRecord(value) && isRecord((value as JsonRpcFailure).error)) {
    const message = (value as JsonRpcFailure).error?.message;
    throw new Error(typeof message === "string" ? message : "AgentCore Gateway tool call failed");
  }

  if (GatewayToolResponseSchema.safeParse(value).success) {
    return GatewayToolResponseSchema.parse(value);
  }

  const result = isRecord(value) ? (value as JsonRpcSuccess).result : undefined;
  if (GatewayToolResponseSchema.safeParse(result).success) {
    return GatewayToolResponseSchema.parse(result);
  }

  if (isRecord(result) && Array.isArray(result.content)) {
    for (const content of result.content) {
      if (!isRecord(content) || typeof content.text !== "string") {
        continue;
      }
      let parsedText: unknown;
      try {
        parsedText = JSON.parse(content.text) as unknown;
      } catch {
        continue;
      }
      if (GatewayToolResponseSchema.safeParse(parsedText).success) {
        return GatewayToolResponseSchema.parse(parsedText);
      }
    }
  }

  throw new Error("AgentCore Gateway returned an unsupported tool response envelope");
}

export function createGatewayClient(options: GatewayClientOptions): GatewayClient {
  const region = options.region ?? "us-east-1";
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async callTool(request: GatewayFileToolRequest, targetName: string, toolName: string): Promise<GatewayToolResponse> {
      const endpoint = gatewayEndpoint(options.gatewayUrl);
      const body = JSON.stringify({
        jsonrpc: "2.0",
        id: request.invocation.idempotencyKey,
        method: "tools/call",
        params: {
          name: mcpToolName(targetName, toolName),
          arguments: request
        }
      });
      const headers = options.skipSigning === true
        ? { "content-type": "application/json" }
        : await signedHeaders(endpoint, body, region);
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers,
        body
      });
      const responseText = await response.text();
      if (!response.ok) {
        throw new Error(`AgentCore Gateway returned HTTP ${response.status}`);
      }

      return parseJsonRpcResponse(JSON.parse(responseText) as unknown);
    }
  };
}
