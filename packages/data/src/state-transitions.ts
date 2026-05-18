import type {
  DocumentStatus,
  JobStatus,
  RunStatus
} from "@agentcore-pdf-translator/schemas";

export class InvalidStateTransitionError extends Error {
  public constructor(entityName: string, from: string, to: string) {
    super(`Invalid ${entityName} transition from ${from} to ${to}`);
    this.name = "InvalidStateTransitionError";
  }
}

const documentTransitions = {
  UPLOADED: ["INSPECTING"],
  INSPECTING: ["READY", "UNSUPPORTED", "FAILED_INSPECTION"],
  READY: ["INSPECTING"],
  UNSUPPORTED: [],
  FAILED_INSPECTION: []
} as const satisfies Record<DocumentStatus, ReadonlyArray<DocumentStatus>>;

const jobTransitions = {
  CREATED: ["RUNNING"],
  RUNNING: ["AWAITING_REVIEW", "FAILED"],
  AWAITING_REVIEW: ["ACCEPTED", "REJECTED", "ESCALATED"],
  ACCEPTED: [],
  REJECTED: [],
  ESCALATED: [],
  FAILED: []
} as const satisfies Record<JobStatus, ReadonlyArray<JobStatus>>;

const runTransitions = {
  CREATED: ["QUEUED"],
  QUEUED: ["RUNNING", "FAILED"],
  RUNNING: ["EVALUATING", "FAILED"],
  EVALUATING: ["AWAITING_REVIEW", "FAILED"],
  AWAITING_REVIEW: ["ACCEPTED", "REJECTED", "ESCALATED"],
  ACCEPTED: [],
  REJECTED: [],
  ESCALATED: [],
  FAILED: []
} as const satisfies Record<RunStatus, ReadonlyArray<RunStatus>>;

function canTransition<TStatus extends string>(
  transitions: Readonly<Record<TStatus, ReadonlyArray<TStatus>>>,
  from: TStatus,
  to: TStatus
): boolean {
  return transitions[from].includes(to);
}

export function canTransitionDocument(from: DocumentStatus, to: DocumentStatus): boolean {
  return canTransition(documentTransitions, from, to);
}

export function canTransitionJob(from: JobStatus, to: JobStatus): boolean {
  return canTransition(jobTransitions, from, to);
}

export function canTransitionRun(from: RunStatus, to: RunStatus): boolean {
  return canTransition(runTransitions, from, to);
}

export function assertDocumentTransition(from: DocumentStatus, to: DocumentStatus): void {
  if (!canTransitionDocument(from, to)) {
    throw new InvalidStateTransitionError("Document", from, to);
  }
}

export function assertJobTransition(from: JobStatus, to: JobStatus): void {
  if (!canTransitionJob(from, to)) {
    throw new InvalidStateTransitionError("TranslationJob", from, to);
  }
}

export function assertRunTransition(from: RunStatus, to: RunStatus): void {
  if (!canTransitionRun(from, to)) {
    throw new InvalidStateTransitionError("Run", from, to);
  }
}

export function canCreateJobForDocumentStatus(status: DocumentStatus): boolean {
  return status === "READY";
}
