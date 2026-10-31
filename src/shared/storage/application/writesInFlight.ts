import { readonly, ref } from 'vue'

const count = ref(0)

/** How many writes to the books are under way on this page, across every app, so the shell can say the page is saving. */
export const writesInFlight = readonly(count)

/** Runs a write and counts it while it runs, whether it finishes or fails. */
export async function trackWrite<Result>(write: () => Promise<Result>): Promise<Result> {
  count.value += 1
  try {
    return await write()
  } finally {
    count.value -= 1
  }
}
