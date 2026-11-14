import { createRequire } from 'node:module'
import { dirname } from 'node:path'

import { defineConfig, searchForWorkspaceRoot } from 'vite'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'
import { devContentSecurityPolicy } from './scripts/devContentSecurityPolicy.ts'
import { devRealBooks } from './scripts/devRealBooks.ts'
import { offlineApp } from './scripts/pwa.ts'

// The row of a list that Enter picks or a pointer is over, on the accented surface, so it shows on a card and in a popover in both themes.
const highlightedRow = 'data-highlighted:not-data-disabled:before:bg-accented'

// The folder the packages come from. A worktree under .claude/worktrees has none of its own and reads the main checkout's,
// which the dev server refuses to serve, fonts included, unless it is allowed.
const packagesFolder = dirname(dirname(dirname(createRequire(import.meta.url).resolve('@fontsource/inter/package.json'))))

// Project site: https://ipazanin.github.io/kuna/
// The leading and trailing slashes are both required, or every asset 404s once deployed.
export default defineConfig({
  base: '/kuna/',
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), packagesFolder] } },
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
        select: { slots: { item: highlightedRow } },
        selectMenu: { slots: { item: highlightedRow } },
        inputMenu: { slots: { item: highlightedRow } },
        commandPalette: { variants: { active: { false: { item: highlightedRow } } } },
        dropdownMenu: { variants: { active: { false: { item: 'data-highlighted:before:bg-accented data-[state=open]:before:bg-accented' } } } },
        // An unchecked box or radio draws its edge in a colour that passes 3:1, where Nuxt's border-strong does not.
        checkbox: { slots: { base: 'ring-control-edge' } },
        radioGroup: { slots: { base: 'ring-control-edge' } },
        switch: {
          // Nuxt's off track and thumb nearly vanish on a dark card, so an off switch draws its edge and thumb in a colour that passes 3:1.
          slots: { base: 'data-[state=unchecked]:border-control-edge', thumb: 'data-[state=unchecked]:bg-control-edge' },
          // Nuxt only dims an amber track, which still reads as on. The thumb keeps showing the value.
          compoundVariants: [{ loading: true, class: { base: 'data-[state=checked]:bg-accented', icon: 'group-data-[state=checked]:text-muted' } }],
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
    devRealBooks(),
    offlineApp(),
  ],
})
