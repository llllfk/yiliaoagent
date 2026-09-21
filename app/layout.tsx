import type { Metadata } from "next";
import { Noto_Sans_SC, Noto_Serif_SC, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const display = Noto_Serif_SC({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-display",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

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
      <body className={`${sans.variable} ${display.variable} ${mono.variable}`}>
        {children}
      </body>
    </html>
  );
}
