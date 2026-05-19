import { CreateJobPageContent } from "../../../../../components/views";

type CreateJobPageProps = {
  readonly params: Promise<{
    readonly documentId: string;
  }>;
};

export default async function CreateJobPage({ params }: CreateJobPageProps) {
  const { documentId } = await params;

  return <CreateJobPageContent documentId={documentId} />;
}
