import { TeacherAppLayout } from "@/components/shared/TeacherAppLayout";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <TeacherAppLayout>{children}</TeacherAppLayout>;
}
