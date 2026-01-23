/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './views/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    './index.html',
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
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(221, 83%, 45%)", // Darker primary for hover
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
        // Construction Industry Colors - UX Spec Compliant
        "safety-orange": {
          DEFAULT: "hsl(14, 91%, 54%)", // Safety Orange - CTAs only
          50: "hsl(14, 91%, 95%)",
          100: "hsl(14, 91%, 90%)",
          200: "hsl(14, 91%, 80%)",
          300: "hsl(14, 91%, 70%)",
          400: "hsl(14, 91%, 62%)",
          500: "hsl(14, 91%, 54%)",
          600: "hsl(14, 91%, 46%)",
          700: "hsl(14, 91%, 38%)",
        },
        "industrial-blue": {
          DEFAULT: "hsl(221, 83%, 53%)", // Industrial Blue - Primary
          50: "hsl(221, 83%, 95%)",
          100: "hsl(221, 83%, 90%)",
          500: "hsl(221, 83%, 53%)",
          600: "hsl(221, 83%, 45%)",
          700: "hsl(221, 83%, 37%)",
        },
        success: {
          DEFAULT: "hsl(142, 71%, 45%)", // Muted Green
          foreground: "hsl(0, 0%, 100%)",
        },
        danger: {
          DEFAULT: "hsl(0, 84%, 60%)", // High-contrast Red
          foreground: "hsl(0, 0%, 100%)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.8" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "gradient-shift": "gradient-shift 8s ease infinite",
        "float": "float 6s ease-in-out infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
      },
      backdropBlur: {
        xs: '2px',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'hero-gradient': 'linear-gradient(135deg, hsl(221, 83%, 10%) 0%, hsl(221, 83%, 5%) 50%, hsl(280, 40%, 10%) 100%)',
        'hero-gradient-light': 'linear-gradient(135deg, hsl(221, 83%, 95%) 0%, hsl(221, 83%, 98%) 50%, hsl(280, 40%, 98%) 100%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
        'glass-gradient-dark': 'linear-gradient(135deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.1) 100%)',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
