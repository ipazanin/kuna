import type { Component, InjectionKey, Ref } from 'vue'

/** A tab of the company's Settings, core's or the pack's, before Books file. */
export interface SettingsTab {
  readonly value: string
  readonly label: string
  readonly icon: string
  readonly component: Component
}

/** The Settings tab a link from another screen opened, until another tab is picked, so its cards open even where this device keeps them collapsed. */
export const LINKED_SETTINGS_TAB: InjectionKey<Readonly<Ref<string | null>>> = Symbol('linked settings tab')
