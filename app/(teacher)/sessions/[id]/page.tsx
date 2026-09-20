import { TeacherSessionDetail } from "@/components/shared/TeacherSessionDetail";

export default async function TeacherSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="p-4">
      <TeacherSessionDetail sessionId={id} />
    </main>
  );
}
