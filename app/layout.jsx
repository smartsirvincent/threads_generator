import './globals.css';

export const metadata = {
  title: 'Threads 貼文產生器',
  description: '輸入產品特色 → AI 推薦客製化主題 → 整月內容批次生成 → 輸出 xlsx',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <body className="min-h-screen">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
          <header className="mb-10 flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-stone-900">
              <span className="inline-block size-8 rounded-lg bg-brand-500" />
              Threads 貼文產生器
            </h1>
            <a
              href="https://github.com/anthropics/claude-code"
              className="text-sm text-stone-500 hover:text-stone-700"
              target="_blank"
              rel="noreferrer"
            >
              powered by Claude
            </a>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
