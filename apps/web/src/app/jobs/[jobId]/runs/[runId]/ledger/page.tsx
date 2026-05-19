import { LedgerPageContent } from "../../../../../../components/views";

type LedgerPageProps = {
  readonly params: Promise<{
    readonly jobId: string;
    readonly runId: string;
  }>;
};

export default async function LedgerPage({ params }: LedgerPageProps) {
  const { jobId, runId } = await params;

  return <LedgerPageContent jobId={jobId} runId={runId} />;
}
