const STEPS = [
  { n: 1, label: '產品設定' },
  { n: 2, label: '主題確認' },
  { n: 3, label: '生成中' },
  { n: 4, label: '完成' },
];

export default function Stepper({ current }) {
  return (
    <ol className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const active = current === s.n;
        const done = current > s.n;
        return (
          <li key={s.n} className="flex flex-1 items-center gap-2">
            <div
              className={`flex size-7 items-center justify-center rounded-full text-xs font-semibold ${
                done
                  ? 'bg-brand-500 text-white'
                  : active
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-200 text-stone-500'
              }`}
            >
              {done ? '✓' : s.n}
            </div>
            <span
              className={`text-sm ${
                active ? 'font-medium text-stone-900' : 'text-stone-500'
              }`}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                className={`mx-2 h-px flex-1 ${
                  done ? 'bg-brand-500' : 'bg-stone-200'
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
