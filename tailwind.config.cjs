/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        'brand-primary': '#003366',
        'brand-secondary': '#0055A4',
        'brand-accent': '#FDB813',
        'status-success': '#10B981',
        'status-warning': '#F59E0B',
        'status-danger': '#EF4444'
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up-fade': 'slideUpFade 0.3s ease-in-out forwards'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        'slide-up-fade': {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' }
        }
      }
    }
  },
  plugins: []
};
