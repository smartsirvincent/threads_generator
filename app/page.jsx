import Link from 'next/link';

export default function Landing() {
  return (
    <main className="space-y-10">
      <section className="text-center">
        <h1 className="text-3xl font-semibold text-stone-900 sm:text-4xl">
          Threads 貼文產生器
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-stone-500">
          兩個獨立功能 — 先生文字、再決定要不要花錢補圖
        </p>
      </section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Link
          href="/text"
          className="group block rounded-2xl border border-stone-200 bg-white p-8 transition hover:border-brand-300 hover:shadow-lg"
        >
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-brand-100 text-2xl">
            📝
          </div>
          <h2 className="text-xl font-semibold text-stone-900 group-hover:text-brand-700">
            文字生成
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            輸入品牌 + 多 SKU 產品特色 → AI 推薦 5–8 個客製化主題 → 整月文案批次生成 → 純文字 xlsx
          </p>
          <ul className="mt-4 space-y-1 text-xs text-stone-500">
            <li>• 8 種 universal post type（語錄/教學/測驗/引戰…）</li>
            <li>• 每 SKU 對應自己的特色 + 圖 + 連結</li>
            <li>• 文字版 xlsx 可直接餵 make.com 排程</li>
            <li>• ~$1 USD / 100 篇</li>
          </ul>
          <div className="mt-5 text-sm font-medium text-brand-600 group-hover:underline">
            開始生成 →
          </div>
        </Link>

        <Link
          href="/images"
          className="group block rounded-2xl border border-stone-200 bg-white p-8 transition hover:border-purple-300 hover:shadow-lg"
        >
          <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-purple-100 text-2xl">
            🎨
          </div>
          <h2 className="text-xl font-semibold text-stone-900 group-hover:text-purple-700">
            補圖工坊
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            上傳已生成的 xlsx → 自動找出可補圖的行 → KIE GPT Image 2 並行生圖 → 補回 xlsx
          </p>
          <ul className="mt-4 space-y-1 text-xs text-stone-500">
            <li>• 自動讀「Prompt核心關鍵字」+「產品圖」當參考</li>
            <li>• 一鍵生所有可生的行,並行 4 個</li>
            <li>• 即時縮圖牆,看到每張冒出來</li>
            <li>• ~$0.04 / 張</li>
          </ul>
          <div className="mt-5 text-sm font-medium text-purple-600 group-hover:underline">
            上傳 xlsx →
          </div>
        </Link>
      </section>

      <section className="rounded-xl border border-stone-200 bg-stone-50 p-5 text-sm text-stone-600">
        <p>
          <strong>建議流程</strong>：先用文字生成跑一輪 → 看品質滿意了 → 把 xlsx 拿到補圖工坊
          一鍵補圖。這樣每張圖都看得到才會花錢，比一條龍流程省。
        </p>
      </section>
    </main>
  );
}
