<script setup lang="ts">
import { computed } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { words } from './words'
import type { DraftLine } from '../domain/receiptDraft'
import { entryCategoryChoices } from '../../entries/presentation/categoryChoices'
import type { Category } from '../../workbook/domain/category'
import { sumAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import { EURO } from '../../../../shared/money/currencyCode'

/** The read lines grouped by category, so a long receipt is a few groups to confirm. Each line can change category, and a new category is accepted, renamed or mapped, never made silently. */
const props = defineProps<{
  lines: readonly DraftLine[]
  categories: readonly Category[]
  /** What the lines left of the row, zero when they add up. */
  difference: AccountMoney
}>()

/** Each line's choice in the lines' order: a category id, `new:` and the name suggested, or blank. */
const choices = defineModel<readonly string[]>('choices', { required: true })
/** The name each accepted suggestion is added under, by the name suggested. */
const accepted = defineModel<Readonly<Record<string, string>>>('accepted', { required: true })

const NEW_PREFIX = 'new:'
const baseItems = computed(() => entryCategoryChoices(props.categories, 'out', null))

function itemsOf(line: DraftLine) {
  return line.suggested === null ? baseItems.value : [[{ label: words.newOption(accepted.value[line.suggested] ?? line.suggested), value: `${NEW_PREFIX}${line.suggested}` }], ...baseItems.value]
}

function choose(place: number, value: string): void {
  choices.value = choices.value.map((held, index) => (index === place ? value : held))
}

const groups = computed(() => {
  const held = new Map<string, { key: string; lines: { line: DraftLine; place: number }[] }>()
  props.lines.forEach((line, place) => {
    const key = choices.value[place] ?? ''
    const group = held.get(key) ?? { key, lines: [] }
    group.lines.push({ line, place })
    held.set(key, group)
  })
  return [...held.values()].map((group) => {
    const suggested = group.key.startsWith(NEW_PREFIX) ? group.key.slice(NEW_PREFIX.length) : null
    return { ...group, suggested, name: props.categories.find((category) => category.id === group.key)?.name ?? '', sum: sumAccountMoney(group.lines.map(({ line }) => line.amount)) }
  })
})

function accept(suggested: string): void {
  accepted.value = { ...accepted.value, [suggested]: accepted.value[suggested] ?? suggested }
}

function rename(suggested: string, name: string): void {
  accepted.value = { ...accepted.value, [suggested]: name }
}
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="spending-receipt-review">
    <p class="type-caption">{{ words.review }}</p>
    <section v-for="group in groups" :key="group.key" class="rounded-md border border-default" data-testid="spending-receipt-group" :data-category="group.key">
      <header class="flex flex-col gap-2 border-b border-default px-3 py-2">
        <div class="flex items-center gap-2">
          <h3 class="min-w-0 flex-1 break-words text-sm text-highlighted">{{ group.suggested === null ? group.name || words.pickCategory : words.newSuggested(group.suggested) }}</h3>
          <AccountMoneyText :cents="group.sum" :currency="EURO" class="shrink-0 text-sm" />
        </div>
        <div v-if="group.suggested !== null" class="flex flex-col items-start gap-2">
          <UButton
            v-if="accepted[group.suggested] === undefined"
            :label="words.newAccept"
            icon="i-lucide-plus"
            color="neutral"
            variant="outline"
            size="sm"
            data-testid="spending-receipt-new-accept"
            @click="accept(group.suggested)"
          />
          <template v-else>
            <UFormField :label="words.newName" class="w-full">
              <UInput :model-value="accepted[group.suggested]" class="w-full" data-testid="spending-receipt-new-name" @update:model-value="rename(group.suggested!, String($event))" />
            </UFormField>
            <UBadge :label="words.newAccepted" color="neutral" variant="subtle" size="sm" />
          </template>
        </div>
      </header>
      <ul class="divide-y divide-default">
        <li v-for="{ line, place } in group.lines" :key="place" class="flex flex-col gap-1.5 px-3 py-2" data-testid="spending-receipt-line">
          <div class="flex items-start gap-2">
            <span class="flex min-w-0 flex-1 flex-col">
              <span class="break-words text-sm text-highlighted">{{ line.text || line.printed }}</span>
              <span v-if="line.text !== '' && line.printed !== ''" class="break-words type-caption">{{ line.printed }}</span>
            </span>
            <AccountMoneyText :cents="line.amount" :currency="EURO" class="shrink-0 text-sm" />
          </div>
          <USelectMenu
            :model-value="choices[place]"
            :items="itemsOf(line)"
            value-key="value"
            :placeholder="words.pickCategory"
            size="sm"
            class="w-full"
            :aria-label="words.category"
            data-testid="spending-receipt-line-category"
            @update:model-value="choose(place, String($event))"
          />
        </li>
      </ul>
    </section>
    <p v-if="difference !== 0" class="text-sm text-muted" data-testid="spending-receipt-difference">{{ words.willDifference(formatAccountMoney(difference, EURO, 'always')) }}</p>
  </div>
</template>
