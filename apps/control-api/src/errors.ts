import { InvalidStateTransitionError } from "@agentcore-pdf-translator/data";
import type { ApiError, ApiErrorCode } from "@agentcore-pdf-translator/schemas";
import type { ApiFailureResponse, ApiResponse } from "./types.js";

export class ControlApiError extends Error {
  public constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = "ControlApiError";
  }
}

export function statusForErrorCode(code: ApiErrorCode): number {
  switch (code) {
    case "VALIDATION_ERROR":
    case "DOCUMENT_UNSUPPORTED":
      return 400;
    case "DOCUMENT_NOT_FOUND":
    case "JOB_NOT_FOUND":
    case "RUN_NOT_FOUND":
    case "ARTIFACT_NOT_FOUND":
    case "PRICE_BOOK_NOT_FOUND":
      return 404;
    case "RUN_NOT_REVIEWABLE":
    case "JOB_ALREADY_RUNNING":
    case "INVALID_STATE_TRANSITION":
      return 409;
    case "NOT_IMPLEMENTED":
      return 501;
    case "AGENT_INVOCATION_FAILED":
      return 502;
    case "INTERNAL_ERROR":
      return 500;
  }
}

export function jsonResponse<TBody>(statusCode: number, body: TBody): ApiResponse<TBody> {
  return {
    statusCode,
    headers: {
      "content-type": "application/json"
    },
    body
  };
}

export function apiErrorBody(error: ControlApiError): ApiError {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details })
    }
  };
}

export function errorResponse(error: ControlApiError): ApiFailureResponse {
  return jsonResponse(statusForErrorCode(error.code), apiErrorBody(error));
}

export function unknownErrorResponse(error: unknown): ApiFailureResponse {
  if (error instanceof ControlApiError) {
    return errorResponse(error);
  }

  if (error instanceof InvalidStateTransitionError) {
    return errorResponse(
      new ControlApiError("INVALID_STATE_TRANSITION", error.message)
    );
  }

  return errorResponse(new ControlApiError("INTERNAL_ERROR", "Internal server error"));
}

export function validationError(message: string, details?: Readonly<Record<string, unknown>>): ControlApiError {
  return new ControlApiError("VALIDATION_ERROR", message, details);
}
