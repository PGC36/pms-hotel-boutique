/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--color-text-primary)',
        surface: 'var(--color-surface)',
        background: 'var(--color-background)',
        accent: 'var(--color-brand-gold)',
        border: 'var(--color-border)',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        heading: ['Playfair Display', 'serif'],
      },
    },
  },
  plugins: [],
};
