<script setup lang="ts" generic="Choice extends { label: string; value?: string }">
import { computed, inject, useAttrs, useId } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'
import { formFieldInjectionKey } from '@nuxt/ui/composables/useFormField'

import { words } from './words'

/**
 * A pick for a field that may stay empty, bound to a string that is blank while nothing is picked. The cross beside the
 * chevron empties it by mouse or touch, and the words for empty as the list's first row do so by keyboard, screen reader and search.
 */
const picked = defineModel<Picked | ''>({ required: true })

const props = withDefaults(
  defineProps<{
    /** The choices, flat or in groups, where a heading of a group has no value. None may have a blank value. */
    items: readonly Choice[] | readonly (readonly Choice[])[]
    /** The words for empty, such as Not set, shown in the field while it is empty and, while clearable, as the list's first row. */
    none: string
    /** The search field's placeholder, or false for a short list with no search. */
    search: string | false
    /** False hides the cross and the row for empty while the field must keep its value, such as a linked entry's category. */
    clearable?: boolean
    disabled?: boolean
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  }>(),
  { clearable: true, disabled: false, size: 'md' },
)

/** A value the items hold. */
type Picked = NonNullable<Choice['value']>

/** Stands in for empty in the list, since an item may not have a blank value. A value Kuna stores never starts with a space. */
const NOT_SET = ' not set'

const choices = computed((): { label: string; value?: string }[] | { label: string; value?: string }[][] => {
  const notSet = props.clearable ? [{ label: props.none, value: NOT_SET }] : []
  const items = props.items
  if (items.length > 0 && Array.isArray(items[0])) {
    const groups = (items as readonly (readonly Choice[])[]).map((group) => [...group])
    return notSet.length === 0 ? groups : [notSet, ...groups]
  }
  return [...notSet, ...(items as readonly Choice[])]
})

const shown = computed({
  get: () => (picked.value === '' ? null : picked.value),
  set: (value: string | null) => {
    // The menu hands back the value of one of the items, or the stand-in for empty.
    picked.value = value === null || value === undefined || value === NOT_SET ? '' : (value as Picked)
  },
})

const attrs = useAttrs()
const formField = inject(formFieldInjectionKey, undefined)
const crossId = useId()

/** The cross is named Clear and the field's name, from the field's label or else from the select's own aria-label. */
const crossName = computed(() => {
  const labelId = formField?.value?.labelId
  if (labelId !== undefined) return { id: crossId, 'aria-label': words.clearChoice, 'aria-labelledby': `${crossId} ${labelId}` }
  const fieldName = attrs['aria-label']
  return { 'aria-label': typeof fieldName === 'string' ? `${words.clearChoice} ${fieldName}` : words.clearChoice }
})
</script>

<template>
  <USelectMenu
    v-model="shown"
    :items="choices"
    value-key="value"
    :placeholder="none"
    :search-input="search === false ? false : { placeholder: search }"
    :clear="clearable"
    :disabled="disabled"
    :size="size"
  >
    <template v-for="(_, slot) in $slots" #[slot]="scope">
      <slot :name="slot" v-bind="scope ?? {}" />
    </template>
    <template #trailing="{ ui }">
      <UButton
        v-if="clearable && !disabled && picked !== ''"
        as="span"
        icon="i-lucide-x"
        :size="size"
        variant="link"
        color="neutral"
        tabindex="-1"
        v-bind="crossName"
        data-slot="trailingClear"
        :class="ui.trailingClear()"
        @click.stop="picked = ''"
      />
      <UIcon name="i-lucide-chevron-down" data-slot="trailingIcon" :class="ui.trailingIcon()" />
    </template>
  </USelectMenu>
</template>
