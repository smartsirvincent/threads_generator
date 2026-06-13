import './globals.css';

export const metadata = {
  title: 'FUN AI社群規劃器',
  description: '輸入產品特色 → AI 推薦客製化主題 → 整月文案 + 圖片批次生成 → 輸出 xlsx',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <body className="min-h-screen">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
          <header className="mb-10 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 text-2xl font-semibold text-stone-900 hover:opacity-80">
              <span className="inline-block size-8 rounded-lg bg-brand-500" />
              FUN AI社群規劃器
            </a>
            <nav className="flex items-center gap-3 text-sm sm:gap-4">
              <a href="/text" className="text-stone-500 hover:text-stone-900">📝 文案</a>
              <a href="/image-plan" className="text-stone-500 hover:text-stone-900">🖼️ 圖片</a>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
