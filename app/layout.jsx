import './globals.css';
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
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&family=Figtree:wght@300..700&display=swap"
        />
      </head>
      <body className="min-h-screen">
        <header className="sticky top-0 z-30 border-b border-sand-200/70 bg-[#FBF7F2]/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link href="/" className="group flex items-center gap-2 hover:opacity-90">
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white shadow-soft">B</span>
              <span className="hidden font-display text-lg font-semibold tracking-tight text-sand-800 sm:inline">
                Best Friend<span className="text-brand-600">.</span>
              </span>
            </Link>
            <Nav />
          </div>
        </header>
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
          {children}
        </div>
      </body>
    </html>
  );
}
