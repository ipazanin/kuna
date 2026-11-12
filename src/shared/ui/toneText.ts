/** Nuxt UI's four tones and the text class of each. */
export const TONE_TEXT = { success: 'text-success', error: 'text-error', warning: 'text-warning', info: 'text-info' } as const

export type Tone = keyof typeof TONE_TEXT

/** The icon each tone shows before its words, such as on a note line or an alert. */
export const TONE_ICONS: Readonly<Record<Tone, string>> = { success: 'i-lucide-circle-check', error: 'i-lucide-circle-alert', warning: 'i-lucide-triangle-alert', info: 'i-lucide-info' }
