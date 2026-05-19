import { ComparisonPageContent } from "../../../components/views";

type ComparisonPageProps = {
  readonly params: Promise<{
    readonly comparisonGroupId: string;
  }>;
};

export default async function ComparisonPage({ params }: ComparisonPageProps) {
  const { comparisonGroupId } = await params;

  return <ComparisonPageContent comparisonGroupId={comparisonGroupId} />;
}
