'use client';

export default function Step4Done({ input, themes, result, onReset }) {
  if (!result) return null;

  const totalGenerated = result.themes_summary?.reduce((s, t) => s + t.count, 0) || 0;
  const totalTarget = themes.reduce((s, t) => s + Number(t.monthly_count || 0), 0);
  const totalFailures = result.themes_summary?.reduce((s, t) => s + (t.failures || 0), 0) || 0;

  return (
    <div className="space-y-5">
      <div className="card text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-brand-100">
          <span className="text-3xl">🎉</span>
        </div>
        <h2 className="text-xl font-semibold text-stone-900">
          產出完成
        </h2>
        <p className="mt-1 text-sm text-stone-500">
          {input.brand} · {input.product}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat label="主題" value={result.themes_summary?.length || 0} />
          <Stat
            label="貼文"
            value={`${totalGenerated}/${totalTarget}`}
            sub={totalFailures > 0 ? `${totalFailures} 批失敗` : '100% 達成'}
            warn={totalFailures > 0}
          />
          <Stat label="檔案" value={`${Math.round((result.file_size || 0) / 1024)} KB`} />
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <a
            href={result.download_url || `/api/download/${result.id}`}
            download
            target={result.download_url ? '_blank' : undefined}
            rel="noreferrer"
            className="btn-primary"
          >
            ⬇ 下載 xlsx
          </a>
          <button onClick={onReset} className="btn-secondary">
            重新開始
          </button>
        </div>
        {result.download_url && (
          <p className="mt-2 text-xs text-stone-500">
            ☁️ 雲端永久有效
          </p>
        )}
      </div>

      {result.themes_summary && (
        <div className="card">
          <h3 className="mb-3 text-sm font-medium text-stone-600">主題明細</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs text-stone-500">
                <th className="pb-2 font-medium">主題</th>
                <th className="pb-2 font-medium">類型</th>
                <th className="pb-2 text-right font-medium">篇數</th>
                <th className="pb-2 text-right font-medium">狀態</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {result.themes_summary.map((t, i) => (
                <tr key={i}>
                  <td className="py-2 font-medium text-stone-800">{t.name}</td>
                  <td className="py-2 text-stone-600">{t.type_label}</td>
                  <td className="py-2 text-right text-stone-800">
                    {t.count}/{t.target}
                  </td>
                  <td className="py-2 text-right">
                    {t.failures > 0 ? (
                      <span className="text-red-600">⚠ {t.failures} 批失敗</span>
                    ) : (
                      <span className="text-green-600">✓</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, warn }) {
  return (
    <div className="rounded-xl bg-stone-50 p-4">
      <div className="text-xs text-stone-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-stone-900">{value}</div>
      {sub && (
        <div className={`text-xs ${warn ? 'text-amber-600' : 'text-green-600'}`}>
          {sub}
        </div>
      )}
    </div>
  );
}
