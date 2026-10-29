/** @type {import('tailwindcss').Config} */
const plugin = require("tailwindcss/plugin");

module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        serif: ["Playfair Display", "serif"],
        sans: ["Inter", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "shimmer": {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        }
      },
      animation: {
        "fade-in-up": "fade-in-up 0.8s ease-out forwards",
        "shimmer": "shimmer 3s linear infinite",
        "float": "float 4s ease-in-out infinite",
      },
      boxShadow: {
        'elegant': '0 10px 30px -15px rgba(230, 75, 135, 0.2)',
        'dramatic': '0 25px 50px -12px rgba(200, 50, 100, 0.35)',
        'soft': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    plugin(function ({ addUtilities }) {
      addUtilities({
        '.text-gradient-silk': {
          '@apply bg-gradient-to-r from-pink-500 via-red-500 to-purple-600 bg-clip-text text-transparent': {},
        },
        '.text-gradient-gold': {
          '@apply bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-300 bg-clip-text text-transparent': {},
        },
        '.bg-gradient-silk': {
          '@apply bg-gradient-to-br from-pink-500 to-purple-500': {},
        },
        '.bg-gradient-gold': {
          '@apply bg-gradient-to-br from-yellow-400 to-orange-400': {},
        },
        '.transition-bounce': {
          '@apply transition-transform duration-300 ease-in-out': {},
        },
        '.transition-smooth': {
          '@apply transition-all duration-300 ease-in-out': {},
        },
        // --- NEW SHINE EFFECT UTILITY ---
        '.shine-effect': {
          'position': 'relative',
          'overflow': 'hidden',
        },
        '.shine-effect::before': {
          'content': '""',
          'position': 'absolute',
          'top': '0',
          'left': '-100%',
          'width': '100%',
          'height': '100%',
          'background': 'linear-gradient(120deg, transparent, rgba(255, 255, 255, 0.4), transparent)',
          'transition': 'left 0.6s ease-in-out',
        },
        '.shine-effect:hover::before': {
          'left': '100%',
        },
      });
    }),
  ],
};