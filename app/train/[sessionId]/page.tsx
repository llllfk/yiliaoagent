import { redirect } from "next/navigation";

export default async function TrainSessionIndex({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  redirect(`/train/${sessionId}/overview`);
}
