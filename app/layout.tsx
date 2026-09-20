import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ER-Think 急诊临床思维训练",
  description: "STEMI 急诊临床思维训练系统（学生端 / 教师端）",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
