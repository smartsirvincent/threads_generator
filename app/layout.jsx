import './globals.css';
import Logo from '@/components/Logo';

export const metadata = {
  title: 'FUN AI 社群規劃器',
  description: '輸入產品特色 → AI 推薦客製化主題 → 整月文案 + 圖片批次生成 → 輸出 xlsx',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <body className="min-h-screen bg-gradient-to-br from-stone-50 via-white to-stone-50">
        <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
            <a href="/" className="flex items-center gap-2 hover:opacity-80">
              <Logo className="h-9 w-auto sm:h-10" />
              <span className="hidden text-base font-semibold text-stone-800 sm:inline">FUN AI 社群規劃器</span>
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
