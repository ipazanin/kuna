<script setup lang="ts" generic="Value extends string">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UDropdownMenu from '@nuxt/ui/components/DropdownMenu.vue'

/** A button that opens a short menu of ways to do one thing, and says which one was picked. */
const props = defineProps<{
  label: string
  icon?: string
  choices: readonly { readonly value: Value; readonly label: string; readonly icon?: string; readonly description?: string }[]
}>()

const emit = defineEmits<{ pick: [value: Value] }>()

// The menu renders no element of its own, so the caller's class and attributes go on the button.
defineOptions({ inheritAttrs: false })

const items = computed(() => props.choices.map(({ value, ...shown }) => ({ ...shown, onSelect: () => emit('pick', value) })))
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'end' }">
    <UButton :label="label" :icon="icon" trailing-icon="i-lucide-chevron-down" color="neutral" variant="outline" v-bind="$attrs" />
  </UDropdownMenu>
</template>
