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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
