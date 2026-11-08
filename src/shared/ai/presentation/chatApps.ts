import type { InjectionKey } from 'vue'

import type { AppContribution } from '../../app/appContribution'
import type { CatalogueScreen } from '../application/catalogue'

/** What a card needs of the app it belongs to: the app's id, and its assistant, which writes what the card shows. */
export type ChatApp = Pick<AppContribution, 'id' | 'assistant'>

/** Kuna itself as the chat reads it: its own screens, which belong to no one app, and what it tells the chat once a chat starts. */
export interface KunaChat extends ChatApp {
  readonly name: string
  readonly purpose: string
  readonly screens: readonly CatalogueScreen[]
}

/** The installed apps and Kuna itself, which the panel gives the cards under it, so a card reaches its own app and nothing on the way does. */
export const CHAT_APPS: InjectionKey<readonly ChatApp[]> = Symbol('chat apps')
