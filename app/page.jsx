import Link from 'next/link';

const STAGES = [
  {
    href: '/brand', accent: 'emerald', emoji: '🏷', step: '①',
    title: '品牌與療程', desc: '唯一資料源',
    detail: '療程、價格、診所資訊、LOGO 都在這裡維護；改一次，全站同步（跨裝置）。',
    bullets: ['療程資料庫（納入生成勾選）', '批次貼價格 → AI 自動分配', '存雲端固定槽、跨裝置一致'],
    cta: '維護品牌／療程',
  },
  {
    href: '/post', accent: 'sky', emoji: '🧵', step: '②',
    title: '內容發文', desc: '主題 → 產文 → 排程',
    detail: '主題庫（純文字／長文／圖片）→ 依主題批次產文（≤100）→ 勾選送排程或立即發 Threads。',
    bullets: ['AI 推薦主題 + 可改提示詞 + 存檔', '批次產文、逐則勾選/編輯/刪除', '排程佇列、到點自動發'],
    cta: '開始產文發文',
  },
  {
    href: '/material', accent: 'rose', emoji: '🖼', step: '③',
    title: '廣告圖片生成', desc: '療程 → 廣告圖',
    detail: '勾療程（可複選）→ 每療程各生一組廣告圖：美麗東方女性 × 名稱／特點／價格，左上角自動蓋 LOGO。',
    bullets: ['1:1 / 9:16 / 1.91:1', '品牌形象型 / 促銷型', '不出現產品或儀器'],
    cta: '生成廣告圖',
  },
  {
    href: '/analytics', accent: 'indigo', emoji: '📊', step: '④',
    title: '成效分析', desc: '依期間 / 型態 / 主題',
    detail: '選期間（近 7 / 30 天可自訂）→ 依型態與主題看瀏覽、互動、互動率，並列出期間最佳 10 篇。',
    bullets: ['依型態（圖文/長文/純文字）', '依主題成效比較', '期間最佳 10 篇貼文'],
    cta: '看成效',
  },
];

const ACCENTS = {
  emerald: { ring: 'hover:border-emerald-300', bg: 'bg-emerald-100', tint: 'from-emerald-50/40', text: 'group-hover:text-emerald-700', cta: 'bg-emerald-600 hover:bg-emerald-700' },
  sky: { ring: 'hover:border-sky-300', bg: 'bg-sky-100', tint: 'from-sky-50/40', text: 'group-hover:text-sky-700', cta: 'bg-sky-600 hover:bg-sky-700' },
  rose: { ring: 'hover:border-rose-300', bg: 'bg-rose-100', tint: 'from-rose-50/40', text: 'group-hover:text-rose-700', cta: 'bg-rose-600 hover:bg-rose-700' },
  indigo: { ring: 'hover:border-indigo-300', bg: 'bg-indigo-100', tint: 'from-indigo-50/40', text: 'group-hover:text-indigo-700', cta: 'bg-indigo-600 hover:bg-indigo-700' },
};

export default function Landing() {
  return (
    <main className="space-y-10">
      <section className="text-center">
        <h1 className="flex items-baseline justify-center gap-2 text-4xl font-bold tracking-tight sm:text-5xl">
          <span className="text-stone-900">泰國醫美</span>
          <span className="bg-gradient-to-r from-rose-500 to-sky-500 bg-clip-text text-transparent">Best Friend</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-stone-500 sm:text-base">
          社群內容一條龍：<strong className="text-stone-700">品牌與療程 → 內容發文 → 廣告圖片 → 成效分析</strong>
        </p>
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {STAGES.map((s) => {
          const a = ACCENTS[s.accent];
          return (
            <Link key={s.href} href={s.href}
              className={`group relative flex flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-xl ${a.ring}`}>
              <div className={`absolute inset-x-0 top-0 h-32 bg-gradient-to-b ${a.tint} to-transparent`} />
              <div className="relative">
                <div className="mb-4 flex items-center gap-3">
                  <div className={`flex size-12 items-center justify-center rounded-xl text-2xl ${a.bg}`}>{s.emoji}</div>
                  <span className="text-2xl font-bold text-stone-300">{s.step}</span>
                </div>
                <h2 className={`text-xl font-semibold text-stone-900 ${a.text}`}>{s.title}</h2>
                <p className="mt-1 text-xs font-medium text-stone-500">{s.desc}</p>
                <p className="mt-3 text-xs leading-relaxed text-stone-600">{s.detail}</p>
                <ul className="mt-4 space-y-1 text-[11px] text-stone-500">
                  {s.bullets.map((b, i) => <li key={i} className="flex items-start gap-1.5"><span className="mt-0.5 text-stone-400">•</span><span>{b}</span></li>)}
                </ul>
                <div className={`mt-5 inline-flex items-center gap-1 self-start rounded-lg px-3 py-1.5 text-xs font-medium text-white shadow-sm transition ${a.cta}`}>{s.cta} →</div>
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
