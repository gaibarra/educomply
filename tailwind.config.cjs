/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
  // Simplified: Inter primary, then platform-native fallbacks
  sans: ['Inter', 'system-ui', 'Arial', 'sans-serif']
      },
      colors: {
        'brand-primary': '#003366',
        'brand-secondary': '#0055A4',
        'brand-accent': '#FDB813',
        'status-success': '#10B981',
        'status-warning': '#F59E0B',
        'status-danger': '#EF4444',
        // CSS variable-driven palette
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: 'hsl(var(--primary))',
        secondary: 'hsl(var(--secondary))',
        muted: 'hsl(var(--muted))',
        destructive: 'hsl(var(--destructive))'
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up-fade': 'slideUpFade 0.3s ease-in-out forwards',
        floating: 'floating 4s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2.5s ease-in-out infinite',
        vibrate: 'vibrate 0.25s linear 2'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        'slide-up-fade': {
          '0%': { opacity: '0', transform: 'translateY(10px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' }
        },
        floating: {
          '0%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
          '100%': { transform: 'translateY(0)' }
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(59, 130, 246, 0.6)' },
          '50%': { boxShadow: '0 0 30px 6px rgba(139, 92, 246, 0.45)' }
        },
        vibrate: {
          '0%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-1px, 1px)' },
          '40%': { transform: 'translate(-1px, -1px)' },
          '60%': { transform: 'translate(1px, 1px)' },
          '80%': { transform: 'translate(1px, -1px)' },
          '100%': { transform: 'translate(0)' }
        }
      }
    }
  },
  plugins: []
};
