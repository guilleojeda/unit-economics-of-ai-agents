import { DocumentDetailPageContent } from "../../../components/views";

type DocumentDetailPageProps = {
  readonly params: Promise<{
    readonly documentId: string;
  }>;
};

export default async function DocumentDetailPage({ params }: DocumentDetailPageProps) {
  const { documentId } = await params;

  return <DocumentDetailPageContent documentId={documentId} />;
}
