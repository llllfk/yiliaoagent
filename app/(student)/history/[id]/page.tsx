import { StudentRecordDetail } from "@/components/shared/StudentRecordDetail";

export default async function StudentHistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main>
      <StudentRecordDetail sessionId={id} />
    </main>
  );
}
