<script setup lang="ts" generic="Value extends string">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UDropdownMenu from '@nuxt/ui/components/DropdownMenu.vue'
import UTooltip from '@nuxt/ui/components/Tooltip.vue'

/** A button that opens a short menu of ways to do one thing, or of settings with one in force, and says which one was picked. */
const props = withDefaults(
  defineProps<{
    label: string
    icon?: string
    choices: readonly { readonly value: Value; readonly label: string; readonly icon?: string; readonly description?: string }[]
    /** The setting in force, which the menu checks, so exactly one is checked. Left out, the menu lists ways to do something once. */
    picked?: Value
    /** The label with a chevron, or the icon alone, with the label as its name and its tooltip. */
    look?: 'labelled' | 'icon'
  }>(),
  { look: 'labelled' },
)

const emit = defineEmits<{ pick: [value: Value] }>()

// The menu renders no element of its own, so the caller's class and attributes go on the button.
defineOptions({ inheritAttrs: false })

const open = ref(false)

const items = computed(() =>
  props.choices.map(({ value, ...shown }) => ({
    ...shown,
    ...(props.picked === undefined ? {} : { type: 'checkbox' as const, checked: value === props.picked }),
    onSelect: () => emit('pick', value),
  })),
)
</script>

<template>
  <UDropdownMenu v-model:open="open" :items="items" :content="{ align: look === 'icon' ? 'start' : 'end' }">
    <UTooltip v-if="look === 'icon'" :text="label" :disabled="open" :content="{ side: 'right' }">
      <UButton :icon="icon" :aria-label="label" color="neutral" variant="ghost" class="justify-center" v-bind="$attrs" />
    </UTooltip>
    <UButton v-else :label="label" :icon="icon" trailing-icon="i-lucide-chevron-down" color="neutral" variant="outline" v-bind="$attrs" />
  </UDropdownMenu>
</template>
