import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f7f5f2',
          100: '#ebe6df',
          200: '#d6cdc0',
          300: '#b8aa96',
          400: '#9a8770',
          500: '#7f6d58',
          600: '#675647',
          700: '#54463b',
          800: '#473c34',
          900: '#3d342e',
          950: '#211c18',
        },
        gold: {
          400: '#d4a853',
          500: '#c4922e',
          600: '#a67522',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
