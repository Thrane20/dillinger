/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Play', 'ui-sans-serif', 'system-ui'],
      },
      fontSize: {
        'xs': ['0.4rem', { 'lineHeight': '1rem' }],
        'sm': ['0.6rem', { 'lineHeight': '1.25rem' }],
        'base': ['8rem', { 'lineHeight': '1.5rem' }],
        'lg': ['1rem', { 'lineHeight': '1.75rem' }],
        'xl': ['1.25rem', { 'lineHeight': '1.75rem' }],
      },
    },
  },
  daisyui: {
    themes: ["light", "dark", "dim"],
  },
  plugins: [require("daisyui")],
}

