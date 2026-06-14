import Link from 'next/link';

export default function Landing() {
  return (
    <main className="space-y-10">
      <section className="text-center">
        <h1 className="text-3xl font-semibold text-stone-900 sm:text-4xl">
          FUN AI社群規劃器
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-stone-500">
          三個獨立功能 — 文字貼文 / 圖片貼文 / 素材產生，自由組合
        </p>
      </section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <EntryCard
          href="/text"
          accent="brand"
          emoji="📝"
          title="文字貼文"
          desc="輸入品牌 + 多 SKU → AI 推薦 5–8 個貼文主題 → 整月文案批次生成"
          bullets={[
            '8 種 universal post type（語錄/教學/測驗/引戰…）',
            '每 SKU 對應自己的特色 + 連結',
            '純文字 xlsx 可直接餵 make.com',
            '~$1 USD / 100 篇',
          ]}
          cta="開始生成 →"
        />
        <EntryCard
          href="/image-plan"
          accent="purple"
          emoji="🖼️"
          title="圖片貼文"
          desc="輸入品牌 + 多 SKU → AI 推薦 5–8 個圖片主題 → AI 批次生圖 + 文案"
          bullets={[
            '推薦多元視覺風格（情境/人物/產品/電商促銷）',
            'AI 並行生圖 + 永久 URL',
            '輸出豐富設計計畫表（人物/環境/光影/排版…）',
            '~$0.04 / 張、並行 4',
          ]}
          cta="開始規劃 →"
        />
        <EntryCard
          href="/material"
          accent="emerald"
          emoji="✨"
          title="素材產生器"
          desc="上傳 1 張參考圖 → AI 模仿風格 → 一次生成 3 種尺寸"
          bullets={[
            '同時輸出 1:1 / 9:16 / 1.91:1 三種比例',
            '適用 IG 動態 / Reels / Stories / FB 廣告',
            '單次生成 ~1.5 分鐘 ~$0.12 USD',
            '無需 SKU 設定，直接上傳即可',
          ]}
          cta="上傳圖片 →"
        />
      </section>

      <section className="rounded-xl border border-stone-200 bg-stone-50 p-5 text-sm text-stone-600">
        <p className="mb-2 font-medium text-stone-700">💡 推薦組合</p>
        <ul className="space-y-1 text-xs">
          <li>• <strong>純文案</strong>：文字貼文 → 套既有圖（外包設計、現有素材）</li>
          <li>• <strong>整月企劃</strong>：圖片貼文 → 拿到一批含 AI 圖的完整社群企劃</li>
          <li>• <strong>單張素材</strong>：素材產生器 → 模仿某張靈感圖快速產出多比例素材</li>
        </ul>
      </section>
    </main>
  );
}

function EntryCard({ href, accent, emoji, title, desc, bullets, cta }) {
  const accents = {
    brand: { ring: 'hover:border-brand-300', bg: 'bg-brand-100', text: 'group-hover:text-brand-700', cta: 'text-brand-600' },
    purple: { ring: 'hover:border-purple-300', bg: 'bg-purple-100', text: 'group-hover:text-purple-700', cta: 'text-purple-600' },
    emerald: { ring: 'hover:border-emerald-300', bg: 'bg-emerald-100', text: 'group-hover:text-emerald-700', cta: 'text-emerald-600' },
  }[accent];
  return (
    <Link
      href={href}
      className={`group block rounded-2xl border border-stone-200 bg-white p-6 transition hover:shadow-lg ${accents.ring}`}
    >
      <div className={`mb-3 flex size-11 items-center justify-center rounded-xl text-xl ${accents.bg}`}>
        {emoji}
      </div>
      <h2 className={`text-lg font-semibold text-stone-900 ${accents.text}`}>
        {title}
      </h2>
      <p className="mt-1.5 text-xs text-stone-600">
        {desc}
      </p>
      <ul className="mt-3 space-y-0.5 text-[11px] text-stone-500">
        {bullets.map((b, i) => <li key={i}>• {b}</li>)}
      </ul>
      <div className={`mt-4 text-sm font-medium ${accents.cta} group-hover:underline`}>
        {cta}
      </div>
    </Link>
  );
}
