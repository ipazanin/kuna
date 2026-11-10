import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

import type { DocumentFontFiles } from '../../src/apps/company/documents/infrastructure/pdfFaces'

/** Inter as the app ships it, found wherever node resolves the package from, so a worktree without its own node_modules reads it too. */
export function documentFontFiles(): DocumentFontFiles {
  const files = join(dirname(createRequire(import.meta.url).resolve('@fontsource/inter')), 'files')
  const pair = (weight: number, style: string) => ({
    latin: readFileSync(join(files, `inter-latin-${weight}-${style}.woff`)),
    extended: readFileSync(join(files, `inter-latin-ext-${weight}-${style}.woff`)),
  })
  return { regular: pair(400, 'normal'), bold: pair(600, 'normal'), italic: pair(400, 'italic') }
}
