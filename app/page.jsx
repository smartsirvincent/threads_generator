import Link from 'next/link';

const STAGES = [
  {
    href: '/brand', emoji: '🏷', step: '01', title: '品牌與療程', desc: '唯一資料源',
    detail: '療程、價格、診所資訊、LOGO 都在這維護；改一次，全站同步（跨裝置）。',
    bullets: ['療程資料庫（勾選納入生成）', '批次貼價格 → AI 自動分配', '存雲端固定槽、跨裝置一致'],
    cta: '維護品牌／療程',
  },
  {
    href: '/post', emoji: '🧵', step: '02', title: '內容發文', desc: '主題 → 產文 → 排程',
    detail: '主題庫（純文字／長文／圖片）→ 依主題批次產文（≤100）→ 勾選送排程或立即發 Threads。',
    bullets: ['AI 推薦主題＋可改提示詞＋存檔', '批次產文、逐則勾選/編輯/刪除', '排程佇列、到點自動發'],
    cta: '開始產文發文',
  },
  {
    href: '/material', emoji: '🖼', step: '03', title: '廣告圖片生成', desc: '療程 → 廣告圖',
    detail: '勾療程（可複選）→ 每療程各生一組：美麗東方女性 × 名稱／特點／價格，左上角自動蓋 LOGO。',
    bullets: ['1:1 / 9:16 / 1.91:1', '品牌形象型 / 促銷型', '不出現產品或儀器'],
    cta: '生成廣告圖',
  },
  {
    href: '/analytics', emoji: '📊', step: '04', title: '成效分析', desc: '依期間 / 型態 / 主題',
    detail: '選期間（近 7 / 30 天可自訂）→ 依型態與主題看瀏覽、互動、互動率，列出期間最佳 10 篇。',
    bullets: ['依型態（圖文/長文/純文字）', '依主題成效比較', '期間最佳 10 篇貼文'],
    cta: '看成效',
  },
];

export default function Landing() {
  return (
    <main className="space-y-12">
      {/* Hero — signature */}
      <section className="glow relative overflow-hidden rounded-3xl border border-sand-200 bg-white/60 px-6 py-14 text-center shadow-soft sm:px-10 sm:py-20">
        <p className="text-xs font-medium uppercase tracking-[0.28em] text-brand-600">曼谷 · 醫美 · 像好朋友一樣</p>
        <h1 className="mx-auto mt-5 max-w-2xl font-display text-4xl font-semibold leading-[1.12] tracking-tight text-sand-900 sm:text-6xl">
          把妳當自己人的<br className="hidden sm:block" />
          <span className="italic text-brand-600">變美</span>旅程
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-sand-600 sm:text-base">
          泰國醫美 Best Friend 的社群一條龍工作台——
          從療程資料、AI 產文、廣告圖到成效分析，一個流程走完。
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/post" className="btn-primary px-5 py-2.5 text-sm">開始產文發文 →</Link>
          <Link href="/brand" className="btn-secondary px-5 py-2.5 text-sm">先設定品牌與療程</Link>
        </div>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-display text-sm text-sand-400">
          {['品牌與療程', '內容發文', '廣告圖片', '成效分析'].map((s, i) => (
            <span key={s} className="flex items-center gap-2">
              {i > 0 && <span className="text-brand-300">→</span>}
              <span>{s}</span>
            </span>
          ))}
        </div>
      </section>

      {/* Stages */}
      <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {STAGES.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group relative flex flex-col rounded-2xl border border-sand-200 bg-white p-6 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-xl ring-1 ring-brand-100">{s.emoji}</div>
              <span className="font-display text-3xl font-medium italic text-sand-200 transition-colors group-hover:text-brand-200">{s.step}</span>
            </div>
            <h2 className="font-display text-xl font-semibold text-sand-900">{s.title}</h2>
            <p className="mt-0.5 text-xs font-medium text-brand-600">{s.desc}</p>
            <p className="mt-3 text-[13px] leading-relaxed text-sand-600">{s.detail}</p>
            <ul className="mt-4 space-y-1.5 text-xs text-sand-500">
              {s.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-[3px] size-1.5 shrink-0 rounded-full bg-gold-400" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
              {s.cta}
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
