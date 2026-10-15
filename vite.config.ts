import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'
import { devContentSecurityPolicy } from './scripts/devContentSecurityPolicy.ts'

// Project site: https://ipazanin.github.io/ledgerboard/
// The leading and trailing slashes are both required, or every asset 404s once deployed.
export default defineConfig({
  base: '/ledgerboard/',
  plugins: [
    vue(),
    ui({
      // Explicit imports instead of generated declaration files. Vite mode already turns off
      // Nuxt UI's font fetching, and the fonts are self-hosted through @fontsource.
      components: false,
      autoImport: false,
      // The theme is resolved by src/shared/theme before mount, which also honours ?theme=.
      colorMode: false,
      ui: {
        colors: {
          primary: 'teal',
          neutral: 'zinc',
        },
      },
    }),
    devContentSecurityPolicy(),
  ],
})
