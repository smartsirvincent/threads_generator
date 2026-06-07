'use client';

import { useState } from 'react';

const TYPE_OPTIONS = [
  { key: 'product_with_image', label: '產品介紹（含圖）' },
  { key: 'product_with_url', label: '產品介紹（帶網址）' },
  { key: 'opinion_short', label: '觀點短文' },
  { key: 'brand_quote', label: '品牌語錄' },
  { key: 'tutorial', label: '教學小知識' },
  { key: 'quiz', label: '心理測驗' },
  { key: 'engagement', label: '高互動引戰' },
  { key: 'persona_narrative', label: '情境角色文' },
];

const SCHEDULE_PRESETS = [
  '每日上午8點半',
  '每日上午10點',
  '每日下午1點',
  '每日下午4點',
  '每日晚上7點',
  '每日晚上10點',
  '每週一、四晚上8點',
  '每週二、四晚上8點',
  '每週三晚上8點',
  '每週五下午5點',
  '每週六下午2點',
];

export default function Step2Themes({ input, themes, setThemes, onBack, onConfirm }) {
  const total = themes.reduce((s, t) => s + Number(t.monthly_count || 0), 0);

  function updateTheme(i, patch) {
    setThemes((arr) => arr.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function removeTheme(i) {
    setThemes((arr) => arr.filter((_, idx) => idx !== i));
  }
  function addTheme() {
    setThemes((arr) => [
      ...arr,
      {
        name: '新主題',
        type: 'opinion_short',
        schedule: '每日上午10點',
        monthly_count: 20,
        platforms: input.platforms,
        rationale: '(手動新增)',
      },
    ]);
  }

  return (
    <div className="card space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-900">
          AI 推薦了 {themes.length} 個主題
        </h2>
        <span className="text-sm text-stone-500">合計 {total} 篇/月</span>
      </div>

      <div className="space-y-3">
        {themes.map((t, i) => (
          <ThemeRow
            key={i}
            theme={t}
            onChange={(patch) => updateTheme(i, patch)}
            onRemove={() => removeTheme(i)}
            allPlatforms={input.platforms}
          />
        ))}
        <button
          type="button"
          onClick={addTheme}
          className="w-full rounded-lg border-2 border-dashed border-stone-300 py-3 text-sm text-stone-500 hover:bg-stone-50"
        >
          + 新增主題
        </button>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={onBack} className="btn-secondary">
          ← 上一步
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-stone-500">
            {input.dry_run ? '✓ Dry-run 模式' : `將呼叫 Claude API,預估約 ${Math.ceil(total / 8)} 批`}
          </span>
          <button
            type="button"
            onClick={onConfirm}
            disabled={themes.length === 0}
            className="btn-primary"
          >
            確認並生成 →
          </button>
        </div>
      </div>
    </div>
  );
}

function ThemeRow({ theme, onChange, onRemove, allPlatforms }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
        <div className="md:col-span-4">
          <label className="label text-xs">主題名</label>
          <input
            className="input"
            value={theme.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </div>
        <div className="md:col-span-3">
          <label className="label text-xs">類型</label>
          <select
            className="input"
            value={theme.type}
            onChange={(e) => onChange({ type: e.target.value })}
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3">
          <label className="label text-xs">排程</label>
          <input
            className="input"
            value={theme.schedule}
            onChange={(e) => onChange({ schedule: e.target.value })}
            list="schedule-presets"
          />
          <datalist id="schedule-presets">
            {SCHEDULE_PRESETS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div className="md:col-span-1">
          <label className="label text-xs">篇/月</label>
          <input
            type="number"
            className="input"
            min={1}
            max={60}
            value={theme.monthly_count}
            onChange={(e) => onChange({ monthly_count: Number(e.target.value) })}
          />
        </div>
        <div className="md:col-span-1 flex justify-end">
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
            title="刪除"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-stone-200 pt-3">
        <div className="flex gap-2">
          {allPlatforms.map((p) => (
            <label key={p} className="inline-flex items-center gap-1 text-xs text-stone-600">
              <input
                type="checkbox"
                checked={theme.platforms?.includes(p) ?? false}
                onChange={(e) =>
                  onChange({
                    platforms: e.target.checked
                      ? [...(theme.platforms || []), p]
                      : (theme.platforms || []).filter((x) => x !== p),
                  })
                }
                className="size-3.5 rounded border-stone-300 text-brand-600 focus:ring-brand-500"
              />
              {p}
            </label>
          ))}
        </div>
        <span className="line-clamp-1 text-xs italic text-stone-500">
          {theme.rationale}
        </span>
      </div>
    </div>
  );
}
