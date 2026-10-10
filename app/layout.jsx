import './globals.css';
import { Suspense } from 'react';
import Link from 'next/link';
import Nav from '@/components/Nav';

export const metadata = {
  title: '泰國醫美 Best Friend',
  description: '社群內容一條龍:品牌與療程 → 內容發文 → 廣告圖片 → 成效分析',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@700;900&family=Noto+Sans+TC:wght@400;500;700&family=JetBrains+Mono:wght@400;600&display=swap"
        />
      </head>
      <body className="min-h-screen pb-20">
        <div className="mx-auto max-w-[1240px] px-5 pt-6 sm:px-6">
          {/* 頁首:仿群益 hero(標題 + 說明 + 底部四色色帶) */}
          <header className="relative overflow-hidden rounded-lg border border-sand-200 bg-white px-6 py-5 sm:px-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <Link href="/" className="hover:opacity-90">
                  <h1 className="font-display text-2xl font-black tracking-tight text-brand-600 sm:text-3xl">
                    泰國醫美<em className="not-italic text-gold-600"> Best Friend</em>
                  </h1>
                </Link>
                <p className="mt-1 text-[13px] text-sand-500">
                  社群內容一條龍:品牌與療程 → 內容發文 → 廣告圖片 → 排程發送 → 成效分析。
                </p>
              </div>
            </div>
            <div className="ticker absolute inset-x-0 bottom-0 h-1" />
          </header>

          <div className="mt-5">
            <Suspense fallback={<div className="h-[88px]" />}>
              <Nav />
            </Suspense>
          </div>

          <main className="py-7">{children}</main>
        </div>
      </body>
    </html>
  );
}
