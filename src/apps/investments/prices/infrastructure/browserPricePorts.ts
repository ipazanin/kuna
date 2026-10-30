import type { VendorFetch } from '../application/priceVendor'

/** A plain GET with no headers of its own, so the browser sends it without a CORS preflight. */
export const browserFetch: VendorFetch = async (url) => {
  const response = await window.fetch(url)
  return { status: response.status, text: await response.text() }
}

export function browserPause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
}
