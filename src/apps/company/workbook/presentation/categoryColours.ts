import { computed } from 'vue'
import type { ComputedRef } from 'vue'

import { bucketTone } from '../../../../shared/charts/chartTokens'
import { useWorkbook } from '../application/workbookStore'
import type { Bucket } from '../domain/bucket'
import { swatchToken } from '../../../../shared/charts/swatches'

/**
 * The colour each category of the workbook on screen is drawn in, as CSS, by its name and the
 * bucket its row carries: the swatch it was given, else its bucket's colour.
 */
export function useCategoryColours(): ComputedRef<(slug: string, bucket: Bucket) => string> {
  const { state } = useWorkbook()
  return computed(() => {
    const swatches = new Map((state.workbook?.categories ?? []).flatMap((category) => (category.colour.swatch === null ? [] : [[category.slug, category.colour.swatch] as const])))
    return (slug, bucket) => {
      const swatch = swatches.get(slug)
      return `var(${swatch === undefined ? `--bucket-${bucketTone(bucket)}` : swatchToken(swatch)})`
    }
  })
}
