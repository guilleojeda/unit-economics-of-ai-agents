import { describe, expect, it } from "vitest";
import { handler } from "../src/lambda.js";

function event(headers: Record<string, string | undefined>) {
  return {
    rawPath: "/api/price-books/current",
    requestContext: {
      requestId: "request_01",
      http: {
        method: "GET",
        path: "/api/price-books/current"
      }
    },
    headers
  };
}

function body(response: Awaited<ReturnType<typeof handler>>) {
  return JSON.parse(response.body) as { readonly error: { readonly code: string } };
}

describe("Control API Lambda auth boundary", () => {
  it("rejects missing, duplicated, and padded dev access token headers before runtime setup", async () => {
    const missing = await handler(event({}));
    expect(missing.statusCode).toBe(401);
    expect(body(missing).error.code).toBe("AUTH_REQUIRED");

    const duplicated = await handler(
      event({
        "x-dev-access-token": "one",
        "X-Dev-Access-Token": "two"
      })
    );
    expect(duplicated.statusCode).toBe(403);
    expect(body(duplicated).error.code).toBe("AUTH_FORBIDDEN");

    const padded = await handler(event({ "x-dev-access-token": " token " }));
    expect(padded.statusCode).toBe(403);
    expect(body(padded).error.code).toBe("AUTH_FORBIDDEN");
  });
});
