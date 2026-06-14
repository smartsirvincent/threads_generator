import './globals.css';

export const metadata = {
  title: 'FUN AI系統',
  description: '輸入產品特色 → AI 推薦客製化主題 → 整月文案 + 圖片批次生成 → 輸出 xlsx',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <body className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-stone-50">
        <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
            <a href="/" className="flex items-baseline gap-1 font-bold hover:opacity-80">
              <span className="text-xl tracking-tight text-stone-900">FUN</span>
              <span className="bg-gradient-to-r from-brand-500 to-purple-500 bg-clip-text text-xl tracking-tight text-transparent">AI</span>
              <span className="hidden text-sm font-medium text-stone-500 sm:inline">系統</span>
            </a>
            <nav className="flex items-center gap-1 text-sm sm:gap-2">
              <NavLink href="/text" icon="📝" label="文字貼文" />
              <NavLink href="/image-plan" icon="🖼️" label="圖片貼文" />
              <NavLink href="/material" icon="✨" label="素材產生" />
            </nav>
          </div>
        </header>
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
          {children}
        </div>
      </body>
    </html>
  );
}

function NavLink({ href, icon, label }) {
  return (
    <a
      href={href}
      className="rounded-lg px-2 py-1.5 text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 sm:px-3"
    >
      <span className="sm:mr-1">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </a>
  );
}
