/** The shapes of Google's and the AI providers' keys, all starting `sk-` but Google's, each with a long tail so a sentence that names a prefix passes. */
export const KEY_SHAPE = /(?<![A-Za-z0-9])(?:(?:sk-|ya29\.)[A-Za-z0-9_-]{20,}|AIza[A-Za-z0-9_-]{35})/
