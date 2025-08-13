/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tg: {
          accent: 'var(--tg-theme-accent-text-color)',
          bg: 'var(--tg-theme-bg-color)',
          button: 'var(--tg-theme-button-color)',
          buttonText: 'var(--tg-theme-button-text-color)',
          destructive: 'var(--tg-theme-destructive-text-color)',
          headerBg: 'var(--tg-theme-header-bg-color)',
          hint: 'var(--tg-theme-hint-color)',
          link: 'var(--tg-theme-link-color)',
          secondaryBg: 'var(--tg-theme-secondary-bg-color)',
          sectionBg: 'var(--tg-theme-section-bg-color)',
          sectionHeaderText: 'var(--tg-theme-section-header-text-color)',
          subtitle: 'var(--tg-theme-subtitle-text-color)',
          text: 'var(--tg-theme-text-color)',
        },
      },
    },
  },
  plugins: [],
}
