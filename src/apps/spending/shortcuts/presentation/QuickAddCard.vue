<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { addEntryFromShortcut } from '../application/shortcutWrites'
import { shortcutAmount, shortcutsShown } from '../domain/shortcuts'
import type { ShortcutWithParts } from '../domain/shortcuts'
import { words } from './words'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import { SPENDING_QUICK_ADD_LINK } from '../../overview/presentation/spendingLinks'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { words as spendingWords } from '../../words'
import { today } from '../../../../shared/calendar/civilDate'
import { EURO } from '../../../../shared/money/currencyCode'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppCard from '../../../../shared/ui/AppCard.vue'
import MenuButton from '../../../../shared/ui/MenuButton.vue'

/** A button per quick add at the top of Entries, four on a phone and six in two rows on a wider screen with the rest in a menu, each adding its entry for today in one tap. */
const store = useSpendingBooks()
const writes = useRecordWrites(store)
const phone = usePhoneLayout()

const shown = computed(() => {
  const book = store.state.workbook
  if (book === null) return []
  const currencyOf = new Map(book.accounts.map((account) => [account.id, account.currency]))
  return shortcutsShown(book).map((held) => {
    const currency = currencyOf.get(held.shortcut.account) ?? EURO
    const amount = shortcutAmount(held.parts)
    const name = held.shortcut.name === '' ? held.shortcut.payee : held.shortcut.name
    return { held, name, amount, currency, money: formatAccountMoney(amount, currency, 'always') }
  })
})
const room = computed(() => (phone.value ? 4 : 6))
/** The buttons that fit, and the rest behind More, so the menu always holds at least two. */
const buttons = computed(() => (shown.value.length <= room.value ? shown.value : shown.value.slice(0, room.value - 1)))
const rest = computed(() => shown.value.slice(buttons.value.length))

async function add(held: ShortcutWithParts, name: string): Promise<void> {
  const records = store.state.records
  if (records === null) return
  await writes.write(words.added(name), (unit) => addEntryFromShortcut(unit, records, held, today()), { key: `shortcut-${held.shortcut.id}`, failedTitle: spendingWords.form.notAdded })
}

function addFromMenu(id: string): void {
  const picked = rest.value.find(({ held }) => held.shortcut.id === id)
  if (picked !== undefined) void add(picked.held, picked.name)
}
</script>

<template>
  <AppCard v-if="shown.length > 0" :title="words.title" data-testid="spending-quick-add">
    <template #actions>
      <UButton :label="words.change" icon="i-lucide-settings-2" color="neutral" variant="ghost" size="sm" :to="SPENDING_QUICK_ADD_LINK" data-testid="spending-quick-add-change" />
    </template>
    <div class="@container px-4 pt-3 pb-4 sm:px-5">
      <div class="grid grid-cols-2 gap-2 @md:grid-cols-3">
        <UButton
          v-for="{ held, name, amount, currency, money } in buttons"
          :key="held.shortcut.id"
          color="neutral"
          variant="outline"
          class="min-w-0 flex-col items-start gap-0.5 text-start"
          :aria-label="words.addThis(name, money)"
          :loading="writes.saving(`shortcut-${held.shortcut.id}`)"
          :disabled="writes.refused.value"
          data-testid="spending-quick-add-button"
          @click="add(held, name)"
        >
          <span class="w-full break-words">{{ name }}</span>
          <AccountMoneyText :cents="amount" :currency="currency" tone="flow" />
        </UButton>
        <MenuButton
          v-if="rest.length > 0"
          :label="words.more(rest.length)"
          icon="i-lucide-ellipsis"
          :choices="rest.map(({ held, name, money }) => ({ value: held.shortcut.id, label: name, description: money }))"
          class="justify-center"
          data-testid="spending-quick-add-more"
          @pick="addFromMenu"
        />
      </div>
    </div>
  </AppCard>
</template>
