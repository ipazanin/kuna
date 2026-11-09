import type { GoogleScope } from './googleScopes'
import { words } from './words'

/** The page holds no token for these scopes, and asking Google here would leave the page, which the ask was not told it may do. */
export class GoogleAccessNeeded extends Error {
  readonly scopes: readonly GoogleScope[]

  constructor(scopes: readonly GoogleScope[]) {
    super(words.staysOnPage)
    this.scopes = scopes
  }
}
