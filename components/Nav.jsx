'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/brand', icon: '🏷', label: '品牌與療程' },
  { href: '/post', icon: '🧵', label: '內容發文' },
  { href: '/material', icon: '🖼', label: '廣告圖片' },
  { href: '/schedule', icon: '🗓', label: '排程' },
  { href: '/analytics', icon: '📊', label: '成效分析' },
  { href: '/settings', icon: '⚙️', label: '連線設定' },
];

export default function Nav() {
  const path = usePathname() || '';
  return (
    <nav className="flex items-center gap-0.5 text-sm sm:gap-1">
      {LINKS.map((l) => {
        const active = path === l.href || (l.href !== '/' && path.startsWith(l.href));
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-full px-2.5 py-1.5 transition-colors sm:px-3.5 ${
              active
                ? 'bg-brand-600 text-white shadow-soft'
                : 'text-sand-600 hover:bg-brand-50 hover:text-brand-700'
            }`}
          >
            <span className="sm:mr-1.5">{l.icon}</span>
            <span className="hidden sm:inline">{l.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
