import type { InjectionKey } from 'vue'

import type { AppContribution } from '../../app/appContribution'

/** The installed apps, which the panel gives the cards under it, so a card reaches its own app and nothing on the way does. */
export const CHAT_APPS: InjectionKey<readonly AppContribution[]> = Symbol('chat apps')
