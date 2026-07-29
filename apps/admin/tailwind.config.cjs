/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          500: '#0ea5e9',
          700: '#0369a1',
        },
        primary: '#1153FF',
        danger: '#ff4d4f',
        regular: '#333333',
        secondary: '#666666',
        description: '#999999',
        bordered: '#d9d9d9',
      },
    },
  },
  plugins: [],
}
