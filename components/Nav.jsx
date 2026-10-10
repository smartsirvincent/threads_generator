'use client';

// 雙層導覽(仿群益期貨 Threads AI 發文):上層=區塊,下層=區塊內的分頁
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

export const SECTIONS = [
  {
    key: 'content',
    name: '內容製作',
    tabs: [
      { href: '/brand', label: '品牌與療程' },
      { href: '/post', label: '建立主題' },
      { href: '/post?tab=produce', label: '主題產文' },
      { href: '/post?tab=weather', label: '預約發文' },
      { href: '/material', label: '廣告圖片' },
    ],
  },
  {
    key: 'publish',
    name: '發文排程',
    tabs: [
      { href: '/schedule', label: '週排程' },
      { href: '/schedule?view=month', label: '當月月曆' },
      { href: '/settings', label: '連線設定' },
    ],
  },
  {
    key: 'perf',
    name: '成效分析',
    tabs: [
      { href: '/analytics', label: '成效總覽' },
    ],
  },
];

const pathOf = (href) => href.split('?')[0];
const queryOf = (href) => href.split('?')[1] || '';

function sectionOf(path) {
  for (const s of SECTIONS) if (s.tabs.some((t) => path === pathOf(t.href))) return s;
  return SECTIONS[0];
}

export default function Nav() {
  const path = usePathname() || '';
  const sp = useSearchParams();
  const query = sp.toString();
  const cur = sectionOf(path);
  return (
    <div>
      {/* 上層:區塊 */}
      <nav className="flex flex-wrap gap-0.5 border-b-2 border-sand-200">
        {SECTIONS.map((s) => {
          const on = s.key === cur.key;
          return (
            <Link
              key={s.key}
              href={s.tabs[0].href}
              aria-current={on ? 'page' : undefined}
              className={`-mb-0.5 border-b-[3px] px-4 py-3 text-base font-semibold transition-colors ${
                on ? 'border-gold-600 text-brand-600' : 'border-transparent text-sand-500 hover:text-brand-600'
              }`}
            >
              {s.name}
            </Link>
          );
        })}
      </nav>
      {/* 下層:該區塊的分頁 */}
      <nav className="flex flex-wrap gap-0.5 border-b border-sand-200">
        {cur.tabs.map((t) => {
          const on = path === pathOf(t.href) && query === queryOf(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? 'page' : undefined}
              className={`-mb-px border-b-[3px] px-3 py-2 text-[13.5px] font-semibold transition-colors ${
                on ? 'border-gold-600 text-brand-600' : 'border-transparent text-sand-500 hover:text-brand-600'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
