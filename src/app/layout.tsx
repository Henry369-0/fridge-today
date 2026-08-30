import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "冰箱食堂 · 今晚吃什么？",
  description: "拍一张冰箱内部，AI 认出食材，给你三个今晚就能做的菜谱。fridge.today · 手工测量",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f2ead9",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
