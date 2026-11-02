/** Nuxt UI's four tones and the text class of each. */
export const TONE_TEXT = { success: 'text-success', error: 'text-error', warning: 'text-warning', info: 'text-info' } as const

export type Tone = keyof typeof TONE_TEXT
