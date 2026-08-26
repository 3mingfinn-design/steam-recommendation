import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Steam Recommendations",
  description: "A lightweight web tool for discovering Steam games.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
