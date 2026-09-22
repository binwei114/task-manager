/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        priority: { high: '#e74c3c', medium: '#f1c40f', low: '#2ecc71' },
        overdue: '#ff6b6b',
      },
    },
  },
  plugins: [],
}