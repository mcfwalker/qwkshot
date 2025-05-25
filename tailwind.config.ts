const defaultTheme = require('tailwindcss/defaultTheme')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/page.tsx',
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.stories.@(js|jsx|mjs|ts|tsx)'
  ],
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
        sans: ["var(--font-inter-tight)", ...defaultTheme.fontFamily.sans],
        mono: ["var(--font-jetbrains)"],
        // mamoth: ['MamothFont', 'Arial', 'sans-serif'], // Removed as we are using a direct CSS class
      },
      colors: {
        // ... existing colors ...
      },
      backdropBlur: {
        md: '12px',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
  corePlugins: {
    backdropFilter: true,
  },
} 