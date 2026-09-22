import { TeacherSessionDetail } from "@/components/shared/TeacherSessionDetail";

export default async function TeacherSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) {
    return (
      <main className="p-4">
        <p className="text-sm text-[var(--crit)]">缺少会话编号</p>
      </main>
    );
  }
  return (
    <main className="p-4">
      <TeacherSessionDetail sessionId={id} />
    </main>
  );
}
