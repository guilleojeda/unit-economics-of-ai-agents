import type {
  CostBasis,
  DocumentStatus,
  JobStatus,
  RunStatus,
  StageEventStatus,
  WorkflowVariant
} from "@agentcore-pdf-translator/schemas";

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency"
  }).format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "N/A";
  }

  return `${Math.round(value * 100)}%`;
}

export function formatDate(value: string | undefined): string {
  if (value === undefined) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function humanize(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function workflowVariantLabel(variant: WorkflowVariant): string {
  const labels = {
    V1_TEXT_ONLY: "V1 Text only",
    V2_TEXT_AND_IMAGE_ANNOTATION: "V2 Text + image annotation",
    V3_OPTIMIZED: "V3 Optimized"
  } as const satisfies Record<WorkflowVariant, string>;

  return labels[variant];
}

export function costBasisLabel(costBasis: CostBasis): string {
  const labels = {
    TELEMETRY_DERIVED_PRICE_BOOK_ESTIMATE: "Telemetry-derived price-book estimate",
    AWS_BILL_RECONCILED: "AWS-bill reconciled",
    MIXED: "Mixed estimate/reconciled"
  } as const satisfies Record<CostBasis, string>;

  return labels[costBasis];
}

export function statusTone(status: DocumentStatus | JobStatus | RunStatus | StageEventStatus): string {
  if (status === "ACCEPTED" || status === "READY" || status === "SUCCEEDED") {
    return "green";
  }

  if (status === "REJECTED" || status === "FAILED" || status === "FAILED_INSPECTION") {
    return "red";
  }

  if (status === "AWAITING_REVIEW" || status === "ESCALATED" || status === "UNSUPPORTED") {
    return "amber";
  }

  if (status === "RUNNING" || status === "EVALUATING" || status === "INSPECTING") {
    return "blue";
  }

  return "neutral";
}
