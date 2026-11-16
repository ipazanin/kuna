<script setup lang="ts" generic="Value extends string">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UDropdownMenu from '@nuxt/ui/components/DropdownMenu.vue'
import UTooltip from '@nuxt/ui/components/Tooltip.vue'

import { useMediaQuery } from '../layout/viewport'

type Choice = { readonly value: Value; readonly label: string; readonly icon?: string; readonly description?: string }

/** A button that opens a short menu of ways to do one thing, or of settings with one in force, and says which one was picked. */
const props = withDefaults(
  defineProps<{
    label: string
    icon?: string
    choices?: readonly Choice[]
    /** The setting in force, which the menu checks, so exactly one is checked. Left out, the menu lists ways to do something once. */
    picked?: Value
    /** Several settings in one menu, in place of `choices`, each under its label and optional note with its own one checked. A value names one choice across every group. */
    groups?: readonly { readonly label: string; readonly note?: string; readonly choices: readonly Choice[]; readonly picked: Value }[]
    /** The label with a chevron, or the icon alone, with the label as its name and its tooltip. */
    look?: 'labelled' | 'icon'
    /** Where the icon look's tooltip shows, beside a column of buttons or below a row, so it covers no other button. */
    tooltipSide?: 'right' | 'bottom'
  }>(),
  { choices: () => [], look: 'labelled', tooltipSide: 'right' },
)

const emit = defineEmits<{ pick: [value: Value] }>()

// The menu renders no element of its own, so the caller's class and attributes go on the button.
defineOptions({ inheritAttrs: false })

const open = ref(false)
// Without hover a tooltip only shows when the menu hands focus back to the button, where it covers the drawer it sits in.
const hovers = useMediaQuery('(hover: hover)')

function itemsOf(choices: readonly Choice[], picked: Value | undefined) {
  return choices.map(({ value, ...shown }) => ({
    ...shown,
    ...(picked === undefined ? {} : { type: 'checkbox' as const, checked: value === picked }),
    onSelect: () => emit('pick', value),
  }))
}

const items = computed(() =>
  props.groups === undefined
    ? itemsOf(props.choices, props.picked)
    : props.groups.map((group) => [
        { type: 'label' as const, label: group.label, ...(group.note === undefined ? {} : { description: group.note, ui: { itemDescription: 'font-normal' } }) },
        ...itemsOf(group.choices, group.picked),
      ]),
)
</script>

<template>
  <UDropdownMenu v-model:open="open" :items="items" :content="{ align: look === 'icon' ? 'start' : 'end' }">
    <UTooltip v-if="look === 'icon'" :text="label" :disabled="open || !hovers" :content="{ side: tooltipSide }">
      <UButton :icon="icon" :aria-label="label" color="neutral" variant="ghost" class="justify-center" v-bind="$attrs" />
    </UTooltip>
    <UButton v-else :label="label" :icon="icon" trailing-icon="i-lucide-chevron-down" color="neutral" variant="outline" v-bind="$attrs" />
  </UDropdownMenu>
</template>
