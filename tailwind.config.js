/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // 品牌主色:玫瑰陶土(rose-clay)——溫暖、療癒、非冷冰醫院也非螢光沙龍粉
        brand: {
          50: '#FBF2EF',
          100: '#F6E2DB',
          200: '#ECC6BA',
          300: '#DEA595',
          400: '#CE8676',
          500: '#C06B57',
          600: '#A85543',
          700: '#8A4335',
          800: '#6E362B',
          900: '#5A2D24',
        },
        // 點綴:香檳金(CTA / 精緻感)
        gold: {
          50: '#FBF6E9',
          100: '#F4E9C6',
          200: '#E9D394',
          300: '#DBBB62',
          400: '#CDA544',
          500: '#B98E2F',
          600: '#9A7325',
          700: '#79591E',
        },
        // 溫暖中性(取代冷灰,貼近膚色/木質/奶油)
        sand: {
          50: '#FBF7F2',
          100: '#F4ECE2',
          200: '#EADFD1',
          300: '#DBC9B6',
          400: '#B8A491',
          500: '#8C7A67',
          600: '#6B5C4D',
          700: '#4E4239',
          800: '#37302A',
          900: '#241F1B',
        },
      },
      fontFamily: {
        sans: ['Figtree', 'system-ui', '-apple-system', '"Noto Sans TC"', 'sans-serif'],
        display: ['Fraunces', 'Georgia', '"Noto Serif TC"', 'serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(58,47,42,0.04), 0 8px 24px -12px rgba(58,47,42,0.12)',
        lift: '0 2px 4px rgba(58,47,42,0.05), 0 18px 40px -16px rgba(58,47,42,0.18)',
      },
    },
  },
  plugins: [],
};
