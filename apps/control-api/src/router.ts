import type { ApiResponse, ApiRequest, ControlApiContext, HttpMethod } from "./types.js";
import {
  DocumentIdParamSchema,
  JobIdParamSchema,
  RunIdParamSchema
} from "@agentcore-pdf-translator/schemas";
import {
  createJob,
  deferredCreateDocument,
  deferredInspectDocument,
  deferredPresign,
  getComparison,
  getCurrentPriceBook,
  getDocument,
  getDocumentJobs,
  getJob,
  getJobEconomics,
  getJobLedger,
  getJobRuns,
  getRun,
  getRunArtifacts,
  getRunEvaluation,
  getRunLedger,
  getRunTimeline,
  listDocuments,
  listJobs,
  putCurrentPriceBook,
  reviewRun,
  startRun
} from "./handlers.js";
import { unknownErrorResponse, validationError } from "./errors.js";

type RouteMatch = {
  readonly pattern: RegExp;
  readonly methods: ReadonlyArray<HttpMethod>;
  readonly handler: (
    context: ControlApiContext,
    request: ApiRequest,
    match: RegExpExecArray
  ) => Promise<ApiResponse> | ApiResponse;
};

const routes: ReadonlyArray<RouteMatch> = [
  {
    pattern: /^\/api\/documents$/u,
    methods: ["GET"],
    handler: (context) => listDocuments(context)
  },
  {
    pattern: /^\/api\/documents\/presign$/u,
    methods: ["POST"],
    handler: () => deferredPresign()
  },
  {
    pattern: /^\/api\/documents$/u,
    methods: ["POST"],
    handler: () => deferredCreateDocument()
  },
  {
    pattern: /^\/api\/documents\/([^/]+)$/u,
    methods: ["GET"],
    handler: (context, _request, match) => getDocument(context, documentIdParam(match))
  },
  {
    pattern: /^\/api\/documents\/([^/]+)\/inspect$/u,
    methods: ["POST"],
    handler: () => deferredInspectDocument()
  },
  {
    pattern: /^\/api\/documents\/([^/]+)\/jobs$/u,
    methods: ["GET"],
    handler: (context, _request, match) => getDocumentJobs(context, documentIdParam(match))
  },
  {
    pattern: /^\/api\/documents\/([^/]+)\/jobs$/u,
    methods: ["POST"],
    handler: (context, request, match) => createJob(context, documentIdParam(match), request.body)
  },
  {
    pattern: /^\/api\/jobs$/u,
    methods: ["GET"],
    handler: (context) => listJobs(context)
  },
  {
    pattern: /^\/api\/jobs\/([^/]+)$/u,
    methods: ["GET"],
    handler: (context, _request, match) => getJob(context, jobIdParam(match))
  },
  {
    pattern: /^\/api\/jobs\/([^/]+)\/runs$/u,
    methods: ["GET"],
    handler: (context, _request, match) => getJobRuns(context, jobIdParam(match))
  },
  {
    pattern: /^\/api\/jobs\/([^/]+)\/ledger$/u,
    methods: ["GET"],
    handler: (context, _request, match) => getJobLedger(context, jobIdParam(match))
  },
  {
    pattern: /^\/api\/jobs\/([^/]+)\/economics$/u,
    methods: ["GET"],
    handler: (context, _request, match) => getJobEconomics(context, jobIdParam(match))
  },
  {
    pattern: /^\/api\/jobs\/([^/]+)\/runs$/u,
    methods: ["POST"],
    handler: (context, request, match) => startRun(context, jobIdParam(match), request.body)
  },
  {
    pattern: /^\/api\/runs\/([^/]+)$/u,
    methods: ["GET"],
    handler: (context, _request, match) => getRun(context, runIdParam(match))
  },
  {
    pattern: /^\/api\/runs\/([^/]+)\/timeline$/u,
    methods: ["GET"],
    handler: (context, _request, match) => getRunTimeline(context, runIdParam(match))
  },
  {
    pattern: /^\/api\/runs\/([^/]+)\/artifacts$/u,
    methods: ["GET"],
    handler: (context, _request, match) => getRunArtifacts(context, runIdParam(match))
  },
  {
    pattern: /^\/api\/runs\/([^/]+)\/evaluation$/u,
    methods: ["GET"],
    handler: (context, _request, match) => getRunEvaluation(context, runIdParam(match))
  },
  {
    pattern: /^\/api\/runs\/([^/]+)\/ledger$/u,
    methods: ["GET"],
    handler: (context, _request, match) => getRunLedger(context, runIdParam(match))
  },
  {
    pattern: /^\/api\/runs\/([^/]+)\/review$/u,
    methods: ["POST"],
    handler: (context, request, match) => reviewRun(context, runIdParam(match), request.body)
  },
  {
    pattern: /^\/api\/compare$/u,
    methods: ["GET"],
    handler: (context, request) => getComparison(context, request.query ?? {})
  },
  {
    pattern: /^\/api\/price-books\/current$/u,
    methods: ["GET"],
    handler: (context) => getCurrentPriceBook(context)
  },
  {
    pattern: /^\/api\/price-books\/current$/u,
    methods: ["PUT"],
    handler: (context, request) => putCurrentPriceBook(context, request.body)
  }
];

function pathParam(match: RegExpExecArray, index: number): string {
  const value = match[index];
  if (value === undefined || value.length === 0) {
    throw validationError("Missing path parameter");
  }

  try {
    return decodeURIComponent(value);
  } catch {
    throw validationError("Invalid path parameter encoding", {
      value
    });
  }
}

function documentIdParam(match: RegExpExecArray): string {
  const parsed = DocumentIdParamSchema.safeParse({ documentId: pathParam(match, 1) });
  if (!parsed.success) {
    throw validationError("Invalid document id path parameter", { issues: parsed.error.issues });
  }

  return parsed.data.documentId;
}

function jobIdParam(match: RegExpExecArray): string {
  const parsed = JobIdParamSchema.safeParse({ jobId: pathParam(match, 1) });
  if (!parsed.success) {
    throw validationError("Invalid job id path parameter", { issues: parsed.error.issues });
  }

  return parsed.data.jobId;
}

function runIdParam(match: RegExpExecArray): string {
  const parsed = RunIdParamSchema.safeParse({ runId: pathParam(match, 1) });
  if (!parsed.success) {
    throw validationError("Invalid run id path parameter", { issues: parsed.error.issues });
  }

  return parsed.data.runId;
}

function normalizePath(path: string): string {
  return path.endsWith("/") && path !== "/" ? path.slice(0, -1) : path;
}

export async function dispatch(
  context: ControlApiContext,
  request: ApiRequest
): Promise<ApiResponse> {
  try {
    const path = normalizePath(request.path);
    const matches = routes
      .map((route) => ({ route, match: route.pattern.exec(path) }))
      .filter((candidate): candidate is { readonly route: RouteMatch; readonly match: RegExpExecArray } =>
        candidate.match !== null
      );
    if (matches.length === 0) {
      throw validationError("No route matched request", {
        method: request.method,
        path: request.path
      });
    }

    const match = matches.find((candidate) => candidate.route.methods.includes(request.method));
    if (match === undefined) {
      throw validationError("Unsupported method for route", {
        method: request.method,
        path: request.path
      });
    }

    const effectiveContext =
      request.workspaceId === undefined
        ? context
        : {
            ...context,
            workspaceId: request.workspaceId
          };

    return await match.route.handler(effectiveContext, request, match.match);
  } catch (error) {
    return unknownErrorResponse(error);
  }
}
