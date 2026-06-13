import Link from 'next/link';

export default function Landing() {
  return (
    <main className="space-y-10">
      <section className="text-center">
        <h1 className="text-3xl font-semibold text-stone-900 sm:text-4xl">
          文案產生器
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-stone-500">
          兩個獨立功能 — 文案與圖片各自獨立規劃，自由組合
        </p>
      </section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <EntryCard
          href="/text"
          accent="brand"
          emoji="📝"
          title="文案生成"
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
          title="圖片規劃"
          desc="輸入品牌 + 多 SKU → AI 推薦 5–8 個圖片主題（特寫/情境/風格化/電商促銷…）→ KIE 批次生圖"
          bullets={[
            '推薦多元視覺風格（情境/人物/產品/電商促銷）',
            'KIE GPT Image 2 並行生圖 + Cloudinary 永久 URL',
            '輸出豐富設計計畫表（人物/環境/光影/排版…）',
            '~$0.04 / 張、並行 4',
          ]}
          cta="開始規劃 →"
        />
      </section>

      <section className="rounded-xl border border-stone-200 bg-stone-50 p-5 text-sm text-stone-600">
        <p className="mb-2 font-medium text-stone-700">💡 推薦組合</p>
        <ul className="space-y-1 text-xs">
          <li>• <strong>純文案</strong>：文案生成 → 套既有圖（外包設計、現有素材）</li>
          <li>• <strong>純素材庫</strong>：圖片規劃 → 拿到一批 AI 圖跑廣告 A/B</li>
          <li>• <strong>一條龍</strong>：文案生成 + 圖片規劃 各跑一輪、各自下載</li>
        </ul>
      </section>
    </main>
  );
}

function EntryCard({ href, accent, emoji, title, desc, bullets, cta }) {
  const accents = {
    brand: { ring: 'hover:border-brand-300', bg: 'bg-brand-100', text: 'group-hover:text-brand-700', cta: 'text-brand-600' },
    purple: { ring: 'hover:border-purple-300', bg: 'bg-purple-100', text: 'group-hover:text-purple-700', cta: 'text-purple-600' },
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
