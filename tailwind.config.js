/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './Public/**/*.{html,js}',
  ],
  theme: {
    extend: {
      colors: {
        // Legacy custom colors
        'custom-text': '#0c2340',
        'custom-outline': '#da291c',
        'custom-button': '#da291c',
        'custom-button-hover': '#b82317',

        // Glassmorphic Navy Palette
        'navy': {
          deep: '#0c2340',
          mid: '#143052',
          light: '#1d4168',
          pale: '#2a5580',
        },

        // Glassmorphic Accent Colors
        'accent-red': {
          DEFAULT: '#da291c',
          hover: '#b82317',
        },

        // Glassmorphic Success Colors
        'glass-success': {
          DEFAULT: '#50AF7B',
          light: '#6BC492',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },

      // Glassmorphic Backdrop Blur
      backdropBlur: {
        'xs': '4px',
        'glass-sm': '8px',
        'glass': '12px',
        'glass-lg': '16px',
        'glass-xl': '20px',
        'glass-2xl': '32px',
      },

      // Glassmorphic Border Radius
      borderRadius: {
        'glass-sm': '8px',
        'glass': '12px',
        'glass-lg': '16px',
        'glass-xl': '24px',
        'glass-2xl': '32px',
      },

      // Glassmorphic Box Shadows
      boxShadow: {
        'glass-1': '0 4px 16px rgba(12, 35, 64, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        'glass-2': '0 8px 32px rgba(12, 35, 64, 0.20), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
        'glass-3': '0 12px 48px rgba(12, 35, 64, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
        'glass-4': '0 24px 64px rgba(12, 35, 64, 0.30), inset 0 2px 0 rgba(255, 255, 255, 0.15)',
      },

      // Glassmorphic Background Colors (for bg-glass-* utilities)
      backgroundColor: {
        'glass-5': 'rgba(255, 255, 255, 0.05)',
        'glass-8': 'rgba(255, 255, 255, 0.08)',
        'glass-10': 'rgba(255, 255, 255, 0.10)',
        'glass-15': 'rgba(255, 255, 255, 0.15)',
        'glass-20': 'rgba(255, 255, 255, 0.20)',
      },

      // Glassmorphic Border Colors
      borderColor: {
        'glass': 'rgba(255, 255, 255, 0.15)',
        'glass-strong': 'rgba(255, 255, 255, 0.25)',
        'glass-active': 'rgba(255, 255, 255, 0.40)',
      },
    },
  },
  plugins: [],
}
