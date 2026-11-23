<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { words } from './words'
import { countsUnderChoices } from '../domain/countsUnderChoices'
import { knownPayees } from '../domain/knownPayees'
import { payeeDirectory } from '../domain/payeeDirectory'
import { samePayee } from '../domain/payeeKey'
import { useSpendingBooks } from '../../workbook/application/spendingStore'

/**
 * Who an entry or one of its parts counts under, blank for the entry's payee. While blank it folds to a quiet "Counts under
 * Harbour bistro". Open, it picks from the payees, people first, or takes a typed name, and picking the entry's payee folds it.
 * Compact, it is small without its heading, as under a line of the entry dialog, where its name says whose it is. A form whose
 * record the payee names, such as a shared cost, binds `open` to true and keeps it open.
 */
const payee = defineModel<string>({ required: true })
const unfolded = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  entryPayee: string
  /** What a screen reader calls the picker, such as the part it belongs to. */
  name: string
  compact?: boolean
}>()

const store = useSpendingBooks()
const listOpen = ref(false)
const size = computed(() => (props.compact ? 'sm' : 'md'))

const folded = computed(() => !unfolded.value && payee.value.trim() === '')
const picked = computed({
  get: () => (payee.value.trim() === '' ? props.entryPayee.trim() : payee.value),
  set: (name: string) => {
    payee.value = samePayee(name, props.entryPayee) ? '' : name.trim()
    if (payee.value === '') unfolded.value = false
  },
})

const offered = computed(() => {
  const book = store.state.workbook
  return book === null ? [] : countsUnderChoices(payeeDirectory(book.payees, book.readings.settings.facts), knownPayees(book.transactions))
})
/** The entry's payee first, then the payees as `countsUnderChoices` orders them, with a name typed here kept on the list. */
const items = computed(() => [props.entryPayee.trim(), picked.value, ...offered.value].filter((name, place, all) => name !== '' && all.findIndex((other) => samePayee(other, name)) === place))

async function unfold(): Promise<void> {
  unfolded.value = true
  await nextTick()
  listOpen.value = true
}
</script>

<template>
  <div class="flex flex-col" data-testid="counts-under" :data-folded="folded">
    <UButton
      v-if="folded"
      :label="entryPayee.trim() === '' ? words.countsUnder.noPayee : words.countsUnder.folded(entryPayee.trim())"
      icon="i-lucide-user-round"
      color="neutral"
      variant="link"
      size="sm"
      class="inline-target quiet-link px-0"
      data-testid="counts-under-unfold"
      @click="unfold"
    />
    <UFormField v-else v-bind="compact ? {} : { label: words.countsUnder.label }">
      <USelectMenu
        v-model="picked"
        v-model:open="listOpen"
        :items="items"
        create-item
        icon="i-lucide-user-round"
        :placeholder="words.countsUnder.placeholder"
        :search-input="{ placeholder: words.countsUnder.search }"
        :aria-label="name"
        :size="size"
        class="w-full"
        data-testid="counts-under-pick"
        @create="picked = $event"
      >
        <template #create-item-label="{ item }">{{ words.newPayee(String(item)) }}</template>
      </USelectMenu>
    </UFormField>
  </div>
</template>
