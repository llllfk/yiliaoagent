import { redirect } from "next/navigation";

/** P1–P8 决策页已下线，保留路由以免旧链接 404 */
export default async function TrainDecisionsPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  redirect(`/train/${sessionId}/exam`);
}
