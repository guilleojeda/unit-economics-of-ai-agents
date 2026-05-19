import { ResultPageContent } from "../../../../../../components/views";

type ResultPageProps = {
  readonly params: Promise<{
    readonly jobId: string;
    readonly runId: string;
  }>;
};

export default async function ResultPage({ params }: ResultPageProps) {
  const { jobId, runId } = await params;

  return <ResultPageContent jobId={jobId} runId={runId} />;
}
