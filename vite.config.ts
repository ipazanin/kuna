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

// A menu option's label and description are the whole choice a person reads, so a long one wraps instead of being cut.
const wholeOption = 'text-clip whitespace-normal break-words'

// The folder the packages come from. A worktree under .claude/worktrees has none of its own and reads the main checkout's,
// which the dev server refuses to serve, fonts included, unless it is allowed.
const packagesFolder = dirname(dirname(dirname(createRequire(import.meta.url).resolve('@fontsource/inter/package.json'))))

// Project site: https://ipazanin.github.io/kuna/
// The leading and trailing slashes are both required, or every asset 404s once deployed.
export default defineConfig(({ command, isPreview }) => ({
  base: '/kuna/',
  server: {
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), packagesFolder] },
    // The DZS refuses a page on localhost by CORS, so the dev server asks it for the house price index in the page's place.
    // A preview serves a production build, which asks the DZS itself.
    proxy: command === 'serve' && isPreview !== true ? { '/dzs': { target: 'https://web.dzs.hr', changeOrigin: true, rewrite: (path) => path.replace(/^\/dzs/, '') } } : {},
  },
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
        // Two actions with Croatian labels are wider than a toast on a phone, so the second one moves to its own line.
        toast: { slots: { actions: 'flex-wrap' } },
        select: { slots: { item: highlightedRow, itemLabel: wholeOption, itemDescription: wholeOption } },
        selectMenu: { slots: { item: highlightedRow, itemLabel: wholeOption, itemDescription: wholeOption } },
        inputMenu: { slots: { item: highlightedRow, itemLabel: wholeOption, itemDescription: wholeOption } },
        commandPalette: { slots: { itemLabel: wholeOption, itemDescription: wholeOption }, variants: { active: { false: { item: highlightedRow } } } },
        dropdownMenu: {
          slots: { itemLabel: wholeOption, itemDescription: wholeOption },
          variants: { active: { false: { item: 'data-highlighted:before:bg-accented data-[state=open]:before:bg-accented' } } },
        },
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
}))
