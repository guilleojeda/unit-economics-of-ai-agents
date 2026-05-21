import type { ReactNode } from "react";
import type {
  CostBasis,
  DocumentStatus,
  JobStatus,
  RunStatus,
  StageEventStatus,
  WorkflowVariant
} from "@agentcore-pdf-translator/schemas";
import {
  costBasisLabel,
  formatMoney,
  humanize,
  statusTone,
  workflowVariantLabel
} from "./format";

type PageHeaderProps = {
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly actions?: ReactNode | undefined;
};

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle === undefined ? null : <p>{subtitle}</p>}
      </div>
      {actions === undefined ? null : <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  action,
  children
}: {
  readonly title: string;
  readonly action?: ReactNode | undefined;
  readonly children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
        {action}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function StatusBadge({
  status
}: {
  readonly status: DocumentStatus | JobStatus | RunStatus | StageEventStatus;
}) {
  return <span className={`badge ${statusTone(status)}`}>{humanize(status)}</span>;
}

export function WorkflowVariantBadge({ variant }: { readonly variant: WorkflowVariant }) {
  const tone = variant === "V1_TEXT_ONLY" ? "blue" : variant === "V2_TEXT_AND_IMAGE_ANNOTATION" ? "purple" : "green";

  return <span className={`badge ${tone}`}>{workflowVariantLabel(variant)}</span>;
}

export function CostBasisBadge({ costBasis }: { readonly costBasis: CostBasis }) {
  return <span className="badge neutral">{costBasisLabel(costBasis)}</span>;
}

export function MoneyValue({ value }: { readonly value: number | null | undefined }) {
  return <span>{formatMoney(value)}</span>;
}

export function SummaryCard({
  label,
  value,
  detail
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly detail?: ReactNode;
}) {
  return (
    <div className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail === undefined ? null : <small>{detail}</small>}
    </div>
  );
}

export function Tabs({
  links
}: {
  readonly links: ReadonlyArray<{
    readonly href: string;
    readonly label: string;
  }>;
}) {
  return (
    <nav className="tabs" aria-label="Run views">
      {links.map((link) => (
        <a key={link.href} href={link.href} data-app-link="">
          {link.label}
        </a>
      ))}
    </nav>
  );
}

export function NotFoundPanel({ title }: { readonly title: string }) {
  return (
    <div className="page">
      <Panel title={title}>
        <div className="empty-state">No matching persisted record exists.</div>
      </Panel>
    </div>
  );
}
