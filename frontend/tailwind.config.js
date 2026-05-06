/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        logeo: {
          50:  '#FFF7ED',
          100: '#FFEDD5',
          200: '#FED7AA',
          300: '#FDBA74',
          400: '#FB923C',
          500: '#EA580C',
          600: '#EA580C',
          700: '#C2410C',
          800: '#9A3412',
          900: '#1A1A1A',
          950: '#0F0F0F',
        },
        brand: {
          DEFAULT: '#EA580C',
          dark: '#C2410C',
          tint: '#FFEDD5',
          ink: '#1A1A1A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
