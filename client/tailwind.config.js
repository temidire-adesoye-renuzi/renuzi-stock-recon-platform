/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          DEFAULT: '#2E3192',
          75: '#6264AD',
          50: '#9798C9',
          25: '#CBCCE4',
          10: '#EAEAF4',
        },
        accent: {
          DEFAULT: '#E87724',
          75: '#EE995B',
          50: '#F4BB92',
          25: '#F9DDC8',
          10: '#FDF1E9',
        },
        success: {
          DEFAULT: '#00A651',
          50: '#80D3A8',
          25: '#BFE9D4',
          10: '#E5F6ED',
        },
        danger: {
          DEFAULT: '#FB4B4C',
          50: '#FDA5A6',
          25: '#FED2D2',
          10: '#FFEDED',
        },
        warn: {
          DEFAULT: '#DFA461',
          50: '#EFD2B0',
          25: '#F7E8D8',
          10: '#FCF5EE',
        },
        navy: '#12355B',
        ink: '#111111',
        canvas: '#EFEFEF',
      },
      fontSize: {
        '2xs': ['11px', '16px'],
      },
    },
  },
  plugins: [],
}
