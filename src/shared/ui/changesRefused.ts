import type { InjectionKey, Ref } from 'vue'

/** What a dialog that saves changes says, with the reload that lifts it, while the app on screen takes none. */
export interface ChangesRefusal {
  readonly title: string
  readonly description: string
  readonly reloadLabel: string
  reload(): void
}

/** The refusal of the app on screen, or null while it takes changes. The shell provides it, and a dialog that saves changes opens with it as an alert at the top of its body. */
export const CHANGES_REFUSED: InjectionKey<Readonly<Ref<ChangesRefusal | null>>> = Symbol('changesRefused')
