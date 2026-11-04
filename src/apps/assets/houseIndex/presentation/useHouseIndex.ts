import { shallowRef, watch } from 'vue'
import type { Ref } from 'vue'

import type { HouseIndex } from '../domain/houseIndex'
import { dzsHouseIndex } from '../infrastructure/dzsHouseIndex'
import { needsHouseIndex } from '../../values/domain/assetValue'
import { useAssetsBooks } from '../../workbook/application/assetsStore'

/** The house price index while it loads, once it is in hand, or once its request failed. */
export type HouseIndexState = 'loading' | HouseIndex | 'failed'

const store = useAssetsBooks()
const index = shallowRef<HouseIndexState>('loading')
let asked = false

async function fetchedIndex(): Promise<HouseIndex> {
  // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeHouseIndex } = await import('../infrastructure/fake/fakeHouseIndex')
    return fakeHouseIndex(new URLSearchParams(window.location.search).get('index'))
  }
  return dzsHouseIndex()
}

/** The page's one house price index, kept in memory only. */
export function useHouseIndex(): Readonly<Ref<HouseIndexState>> {
  return index
}

/** Asks for the index once per page load, as soon as the Assets file on screen holds a home with a region. Returns the function that stops waiting for one. */
export function startHouseIndex(): () => void {
  return watch(
    () => store.state.workbook !== null && needsHouseIndex(store.state.workbook),
    (needed) => {
      if (!needed || asked) return
      asked = true
      fetchedIndex().then(
        (fetched) => {
          index.value = fetched
        },
        () => {
          index.value = 'failed'
        },
      )
    },
    { immediate: true },
  )
}
