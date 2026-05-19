import { JobDetailPageContent } from "../../../components/views";

type JobDetailPageProps = {
  readonly params: Promise<{
    readonly jobId: string;
  }>;
};

export default async function JobDetailPage({ params }: JobDetailPageProps) {
  const { jobId } = await params;

  return <JobDetailPageContent jobId={jobId} />;
}
