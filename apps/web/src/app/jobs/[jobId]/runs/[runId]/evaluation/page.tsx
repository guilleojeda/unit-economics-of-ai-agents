import { EvaluationPageContent } from "../../../../../../components/views";

type EvaluationPageProps = {
  readonly params: Promise<{
    readonly jobId: string;
    readonly runId: string;
  }>;
};

export default async function EvaluationPage({ params }: EvaluationPageProps) {
  const { jobId, runId } = await params;

  return <EvaluationPageContent jobId={jobId} runId={runId} />;
}
