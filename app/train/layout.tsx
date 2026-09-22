import { StudentAppLayout } from "@/components/shared/StudentAppLayout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <StudentAppLayout>{children}</StudentAppLayout>;
}
