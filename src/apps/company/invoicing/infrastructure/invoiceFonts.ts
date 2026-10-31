import boldExtendedUrl from '@fontsource/inter/files/inter-latin-ext-600-normal.woff?url'
import boldLatinUrl from '@fontsource/inter/files/inter-latin-600-normal.woff?url'
import italicExtendedUrl from '@fontsource/inter/files/inter-latin-ext-400-italic.woff?url'
import italicLatinUrl from '@fontsource/inter/files/inter-latin-400-italic.woff?url'
import regularExtendedUrl from '@fontsource/inter/files/inter-latin-ext-400-normal.woff?url'
import regularLatinUrl from '@fontsource/inter/files/inter-latin-400-normal.woff?url'

import type { FontPair, InvoiceFontFiles } from './invoicePdf'
import { words } from './words'

async function bytesOf(url: string): Promise<Uint8Array> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(words.fontFailed(url, response.status))
  }
  return new Uint8Array(await response.arrayBuffer())
}

async function pairOf(latinUrl: string, extendedUrl: string): Promise<FontPair> {
  const [latin, extended] = await Promise.all([bytesOf(latinUrl), bytesOf(extendedUrl)])
  return { latin, extended }
}

let loaded: Promise<InvoiceFontFiles> | null = null

/** Inter as the app ships it, the WOFF files beside the WOFF2 ones the screens use. Loaded once, on the first invoice. */
export function invoiceFonts(): Promise<InvoiceFontFiles> {
  loaded ??= Promise.all([pairOf(regularLatinUrl, regularExtendedUrl), pairOf(boldLatinUrl, boldExtendedUrl), pairOf(italicLatinUrl, italicExtendedUrl)]).then(([regular, bold, italic]) => ({
    regular,
    bold,
    italic,
  }))
  loaded.catch(() => {
    loaded = null
  })
  return loaded
}
