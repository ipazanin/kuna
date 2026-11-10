import type { Component, InjectionKey, Ref } from 'vue'

/** The Books file tab's value in `?tab=` on Settings, the tab of the card where the books are kept. */
export const BOOKS_FILE_TAB = 'books'

/** The Books file tab of Settings. */
export const BOOKS_FILE_LINK = `/company/settings?tab=${BOOKS_FILE_TAB}`

/** The Assistant tab's value in `?tab=` on Settings. */
export const ASSISTANT_TAB = 'assistant'

/** The Assistant tab of Settings, which the chat can link to. */
export const ASSISTANT_SETTINGS_LINK = `/company/settings?tab=${ASSISTANT_TAB}`

/** A tab of the company's Settings, core's or the pack's, before Books file. */
export interface SettingsTab {
  readonly value: string
  readonly label: string
  readonly icon: string
  readonly component: Component
}

/** The Settings tab a link from another screen opened, until another tab is picked, so its cards open even where this device keeps them collapsed. */
export const LINKED_SETTINGS_TAB: InjectionKey<Readonly<Ref<string | null>>> = Symbol('linked settings tab')
