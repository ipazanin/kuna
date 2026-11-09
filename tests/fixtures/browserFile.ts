import type { BrowserFile } from '../../src/shared/app/browserFileCards'

/** A browser file for a desk whose app already has its file open, so a file card is refused. */
export const FILE_OPEN: BrowserFile = {
  appName: 'App',
  hasNoFile: () => false,
  madeHere: () => false,
  make: () => Promise.resolve(null),
  remove: () => Promise.resolve(false),
}
