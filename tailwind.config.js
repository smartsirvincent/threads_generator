/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // 主色:藏青(仿群益期貨 Threads AI 發文)——沉穩、專業、資訊密度高也好讀
        brand: {
          50: '#F0F4FF',
          100: '#DCE6FB',
          200: '#BCCDF6',
          300: '#93ACEC',
          400: '#6886DC',
          500: '#2B4FB8',
          600: '#1E3A8A',
          700: '#172D6B',
          800: '#12224F',
          900: '#0E1A3C',
        },
        // 點綴:金(重點、現用分頁底線、強調數字)
        gold: {
          50: '#FEF9EC',
          100: '#FBEFCB',
          200: '#F6DC95',
          300: '#EEC258',
          400: '#E0A72F',
          500: '#C98B20',
          600: '#B7791F',
          700: '#92601A',
        },
        // 中性:冷灰(紙白底、格線、次要文字)
        sand: {
          50: '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8F0',
          300: '#CBD5E1',
          400: '#94A3B8',
          500: '#64748B',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
        // 漲跌/狀態(群益用色:跌綠漲橘)
        up: '#C2410C',
        down: '#15803D',
      },
      fontFamily: {
        sans: ['"Noto Sans TC"', '"Microsoft JhengHei"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Noto Serif TC"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15,23,42,0.04)',
        lift: '0 2px 6px rgba(15,23,42,0.08)',
      },
    },
  },
  plugins: [],
};
