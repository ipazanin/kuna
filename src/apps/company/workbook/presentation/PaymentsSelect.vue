<script setup lang="ts">
import { computed } from 'vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

const props = defineProps<{
  /** The payments on offer, in the order the list shows them, each with its line. */
  payments: readonly { readonly label: string; readonly value: string }[]
  /** What the field says while no payment is ticked. */
  none: string
  search: string
}>()

const ticked = defineModel<string[]>({ required: true })

/** The ticked payments' labels, one line each, so a second payment is not cut off behind the first. */
const tickedLabels = computed(() => props.payments.filter((payment) => ticked.value.includes(payment.value)).map((payment) => payment.label))
</script>

<template>
  <USelectMenu v-model="ticked" :items="[...payments]" value-key="value" multiple :placeholder="none" :search-input="{ placeholder: search }" class="w-full">
    <template #default>
      <span v-if="tickedLabels.length === 0" class="text-muted">{{ none }}</span>
      <span v-else class="flex min-w-0 flex-col text-start">
        <span v-for="label in tickedLabels" :key="label" class="truncate">{{ label }}</span>
      </span>
    </template>
  </USelectMenu>
</template>
