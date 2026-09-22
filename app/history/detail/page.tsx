import { StudentRecordDetail } from "@/components/shared/StudentRecordDetail";

export default async function StudentHistoryDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) {
    return (
      <main className="p-4">
        <p className="text-sm text-[var(--crit)]">缺少记录编号</p>
      </main>
    );
  }
  return (
    <main>
      <StudentRecordDetail sessionId={id} />
    </main>
  );
}
