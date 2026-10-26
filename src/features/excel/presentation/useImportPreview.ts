import { ref, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'

import { previewImport } from '../../workbook/presentation/workbookFiles'
import type { ImportPreview } from '../../workbook/presentation/workbookFiles'

export interface ImportPreviewState {
  /** The file read and checked, or null while it is read or when it could not be. */
  readonly preview: Readonly<Ref<ImportPreview | null>>
  /** Why the file could not be read, or null. */
  readonly failure: Readonly<Ref<string | null>>
  /** The underlying error of a file that could not be read, shown under the message. Empty shows nothing. */
  readonly failureDetail: Readonly<Ref<string>>
}

/** Reads each file put in the ref into what it would keep, nothing stored yet, the way Open a file and onboarding show it. */
export function useImportPreview(file: Readonly<Ref<File | null>>): ImportPreviewState {
  // Shallow, so the tabs stay plain objects. IndexedDB cannot store a reactive proxy.
  const preview = shallowRef<ImportPreview | null>(null)
  const failure = ref<string | null>(null)
  const failureDetail = ref('')

  watch(
    file,
    async (chosen) => {
      preview.value = null
      failure.value = null
      failureDetail.value = ''
      if (chosen === null) return
      try {
        const read = await previewImport(chosen)
        if (file.value === chosen) preview.value = read
      } catch (problem) {
        if (file.value !== chosen) return
        failure.value = problem instanceof Error ? problem.message : String(problem)
        const cause = problem instanceof Error ? problem.cause : undefined
        failureDetail.value = cause instanceof Error ? `${cause.name}: ${cause.message}` : cause === undefined ? '' : String(cause)
      }
    },
    { immediate: true },
  )

  return { preview, failure, failureDetail }
}
