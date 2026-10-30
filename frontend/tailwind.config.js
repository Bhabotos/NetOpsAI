/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        noc: {
          bg:      '#0a0e1a',
          panel:   '#0f1629',
          border:  '#1e2d4a',
          accent:  '#1a3a6a',
          blue:    '#3b82f6',
          cyan:    '#06b6d4',
        },
      },
    },
  },
  plugins: [],
};
