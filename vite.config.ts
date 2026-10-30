import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'
import { devContentSecurityPolicy } from './scripts/devContentSecurityPolicy.ts'
import { offlineApp } from './scripts/pwa.ts'

// Project site: https://ipazanin.github.io/kuna/
// The leading and trailing slashes are both required, or every asset 404s once deployed.
export default defineConfig({
  base: '/kuna/',
  plugins: [
    vue(),
    ui({
      // Explicit imports instead of generated declaration files. Vite mode already turns off
      // Nuxt UI's font fetching, and the fonts are self-hosted through @fontsource.
      components: false,
      autoImport: false,
      // The theme is resolved by src/shared/theme before mount, which also honours ?theme=.
      colorMode: false,
      // Every i-lucide-* name in src is bundled from @iconify-json/lucide. Iconify would otherwise
      // fetch a missing icon from api.iconify.design, which the Content Security Policy blocks.
      icon: { clientBundle: { scan: { globInclude: ['src/**/*.{vue,ts}'] } } },
      theme: { colors: ['primary', 'info', 'success', 'warning', 'error'] },
      ui: {
        // The colours themselves come from src/shared/styles/tokens.css, which overrides these.
        colors: {
          primary: 'amber',
          neutral: 'slate',
        },
        modal: {
          slots: {
            // Clear of the close button, and on a phone, where a dialog is full screen, of the gesture bar.
            header: 'pe-16 sm:pe-6',
            footer: 'pb-[max(1rem,env(safe-area-inset-bottom))]',
          },
        },
        table: {
          slots: {
            th: 'px-3 py-2.5 text-xs font-medium text-muted',
            // Grouped tables render an empty row under each expanded row. Without padding it collapses.
            td: 'px-3 py-2 text-sm text-default empty:p-0',
            tbody: '[&>tr]:transition-colors [&>tr]:hover:bg-elevated/60',
          },
        },
      },
    }),
    devContentSecurityPolicy(),
    offlineApp(),
  ],
})
