import { RunDetailPageContent } from "../../../../../components/views";

type RunDetailPageProps = {
  readonly params: Promise<{
    readonly jobId: string;
    readonly runId: string;
  }>;
};

export default async function RunDetailPage({ params }: RunDetailPageProps) {
  const { jobId, runId } = await params;

  return <RunDetailPageContent jobId={jobId} runId={runId} />;
}
