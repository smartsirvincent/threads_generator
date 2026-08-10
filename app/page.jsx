import Link from 'next/link';

export default function Landing() {
  return (
    <main className="space-y-12">
      {/* ===== Hero ===== */}
      <section className="text-center">
        <h1 className="flex items-baseline justify-center gap-2 text-5xl font-bold tracking-tight sm:text-6xl">
          <span className="text-stone-900">FUN</span>
          <span className="bg-gradient-to-r from-brand-500 to-purple-500 bg-clip-text text-transparent">AI</span>
          <span className="text-2xl font-medium text-stone-500 sm:text-3xl">系統</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-stone-500 sm:text-base">
          三個獨立功能 — 文字貼文 / 圖片貼文 / 素材產生，自由組合
        </p>
      </section>

      {/* ===== 品牌資訊入口 ===== */}
      <section className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 p-6">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-emerald-800">
              🏷 品牌資訊輸入
            </h2>
            <p className="mt-1 text-xs text-emerald-700">
              共用品牌與 SKU 資料庫 — 編輯一次，所有流程都能載入。同名儲存會覆蓋不會多筆。
            </p>
          </div>
          <Link
            href="/brand"
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
          >
            進入編輯 →
          </Link>
        </div>
      </section>

      {/* ===== 廣告圖片生成入口 ===== */}
      <section className="rounded-2xl border-2 border-dashed border-rose-300 bg-rose-50/40 p-6">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-rose-800">
              🖼 廣告圖片生成
            </h2>
            <p className="mt-1 text-xs text-rose-700">
              從療程資料庫勾療程（可複選）→ 每療程各生一組廣告圖：美麗東方女性 × 療程名稱／特點／價格，左上角自動蓋 LOGO，不出現產品或儀器。
            </p>
          </div>
          <Link
            href="/material"
            className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-700"
          >
            進入廣告圖片生成 →
          </Link>
        </div>
      </section>

      {/* ===== 快速發文入口 ===== */}
      <section className="rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50/40 p-6">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-sky-800">
              🧵 快速發文
            </h2>
            <p className="mt-1 text-xs text-sky-700">
              主題發想 → AI 產文（療程／景點介紹／促銷／衛教／閨蜜觀點）→ 一鍵發到 Threads。療程與診所資訊自動帶入。
            </p>
          </div>
          <Link
            href="/post"
            className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700"
          >
            開始發文 →
          </Link>
        </div>
      </section>

      {/* ===== 三大功能卡片 ===== */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <EntryCard
          href="/text"
          accent="brand"
          emoji="📝"
          title="文字貼文"
          desc="整月文案批次生成"
          detail="輸入品牌 + 多 SKU → AI 推薦 5-8 個貼文主題 → 整月文案"
          bullets={[
            '8 種貼文類型（語錄/教學/測驗/引戰…）',
            '每 SKU 對應自己的特色 + 連結',
            'xlsx 可直接餵 make.com',
          ]}
          tag="~$1 / 100 篇"
          cta="開始生成"
        />
        <EntryCard
          href="/image-plan"
          accent="purple"
          emoji="🖼️"
          title="圖片貼文"
          desc="整月含圖批次規劃"
          detail="輸入品牌 + SKU → AI 推薦圖片主題 → 批次生圖 + 文案"
          bullets={[
            '多元視覺風格（情境/人物/產品/電商促銷）',
            'AI 並行生圖 + 永久 URL',
            '豐富設計計畫表（人物/環境/光影/排版）',
          ]}
          tag="~$0.04 / 張"
          cta="開始規劃"
        />
      </section>

      {/* ===== 推薦組合 ===== */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-700">
          💡 推薦使用組合
        </h2>
        <div className="grid grid-cols-1 gap-3 text-sm text-stone-600 md:grid-cols-3">
          <Combo title="純文案" desc="文字貼文 → 套既有圖（外包設計、現有素材）" />
          <Combo title="整月企劃" desc="圖片貼文 → 拿到一批含 AI 圖的完整社群企劃" />
          <Combo title="單張素材" desc="素材產生 → 模仿靈感圖快速產出多比例素材" />
        </div>
      </section>
    </main>
  );
}

function Combo({ title, desc }) {
  return (
    <div className="rounded-xl bg-stone-50 p-3">
      <div className="text-xs font-semibold text-stone-700">{title}</div>
      <div className="mt-1 text-[11px] text-stone-500">{desc}</div>
    </div>
  );
}

function EntryCard({ href, accent, emoji, title, desc, detail, bullets, tag, cta }) {
  const accents = {
    brand: {
      ring: 'hover:border-brand-300 hover:shadow-brand-100/50',
      bg: 'bg-brand-100',
      tint: 'from-brand-50/40',
      text: 'group-hover:text-brand-700',
      cta: 'bg-brand-600 hover:bg-brand-700',
      tag: 'bg-brand-50 text-brand-700',
    },
    purple: {
      ring: 'hover:border-purple-300 hover:shadow-purple-100/50',
      bg: 'bg-purple-100',
      tint: 'from-purple-50/40',
      text: 'group-hover:text-purple-700',
      cta: 'bg-purple-600 hover:bg-purple-700',
      tag: 'bg-purple-50 text-purple-700',
    },
    emerald: {
      ring: 'hover:border-emerald-300 hover:shadow-emerald-100/50',
      bg: 'bg-emerald-100',
      tint: 'from-emerald-50/40',
      text: 'group-hover:text-emerald-700',
      cta: 'bg-emerald-600 hover:bg-emerald-700',
      tag: 'bg-emerald-50 text-emerald-700',
    },
  }[accent];

  return (
    <Link
      href={href}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl ${accents.ring}`}
    >
      <div className={`absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${accents.tint} to-transparent`} />
      <div className="relative">
        <div className="mb-4 flex items-start justify-between">
          <div className={`flex size-12 items-center justify-center rounded-xl text-2xl ${accents.bg}`}>
            {emoji}
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${accents.tag}`}>
            {tag}
          </span>
        </div>
        <h2 className={`text-xl font-semibold text-stone-900 ${accents.text}`}>{title}</h2>
        <p className="mt-1 text-xs font-medium text-stone-500">{desc}</p>
        <p className="mt-3 text-xs leading-relaxed text-stone-600">{detail}</p>
        <ul className="mt-4 space-y-1 text-[11px] text-stone-500">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="mt-0.5 text-stone-400">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <div className={`mt-5 inline-flex items-center gap-1 self-start rounded-lg px-3 py-1.5 text-xs font-medium text-white shadow-sm transition ${accents.cta}`}>
          {cta} →
        </div>
      </div>
    </Link>
  );
}
