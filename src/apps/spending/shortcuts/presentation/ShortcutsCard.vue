<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { moveShortcut } from '../application/shortcutWrites'
import { shortcutAmount, shortcutsShown, shortcutsWithParts } from '../domain/shortcuts'
import type { ShortcutWithParts } from '../domain/shortcuts'
import ShortcutDialog from './ShortcutDialog.vue'
import { words } from './words'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Shortcut } from '../../workbook/domain/shortcut'
import { words as spendingWords } from '../../words'
import { today } from '../../../../shared/calendar/civilDate'
import { EURO } from '../../../../shared/money/currencyCode'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppCard from '../../../../shared/ui/AppCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import ListRow from '../../../../shared/ui/ListRow.vue'
import MoveButtons from '../../../../shared/ui/MoveButtons.vue'

/** Settings' quick adds in the order their buttons show on Entries, each opening its dialog and moving up or down, with Add. */
const store = useSpendingBooks()
const writes = useRecordWrites(store)

const rows = computed(() => {
  const book = store.state.workbook
  if (book === null) return []
  const shown = new Set(shortcutsShown(book, today()).map(({ shortcut }) => shortcut.id))
  const accounts = new Map(book.accounts.map((account) => [account.id, account]))
  const categories = new Map(book.categories.map((category) => [category.id, category.name]))
  return shortcutsWithParts(book).map((held) => {
    const account = accounts.get(held.shortcut.account)
    return {
      held,
      name: held.shortcut.name === '' ? held.shortcut.payee : held.shortcut.name,
      caption: [account?.name ?? '', held.shortcut.name === '' ? '' : held.shortcut.payee, ...held.parts.map((part) => categories.get(part.category) ?? '')].filter((part) => part !== '').join(' · '),
      amount: shortcutAmount(held.parts),
      currency: account?.currency ?? EURO,
      hidden: !shown.has(held.shortcut.id),
    }
  })
})

const dialogOpen = ref(false)
const editing = ref<ShortcutWithParts | null>(null)

function openDialog(held: ShortcutWithParts | null): void {
  editing.value = held
  dialogOpen.value = true
}

/** The move of the quick add whose write runs, which its button shows. */
function movingOf(shortcut: Shortcut): 'up' | 'down' | null {
  return writes.saving(`up-${shortcut.id}`) ? 'up' : writes.saving(`down-${shortcut.id}`) ? 'down' : null
}

async function move(shortcut: Shortcut, step: -1 | 1): Promise<void> {
  const book = store.state.workbook
  if (book !== null)
    await writes.write(words.card.moved, (unit) => moveShortcut(unit, book.shortcuts, shortcut, step), {
      key: `${step === -1 ? 'up' : 'down'}-${shortcut.id}`,
      shownAtOnce: true,
      failedTitle: spendingWords.form.notSaved,
    })
}
</script>

<template>
  <EmptyState v-if="rows.length === 0" icon="i-lucide-zap" :title="words.card.empty" :description="words.card.emptyDescription" data-testid="spending-shortcuts-empty">
    <template #actions>
      <UButton :label="words.card.add" icon="i-lucide-plus" data-testid="spending-shortcuts-add" @click="openDialog(null)" />
    </template>
  </EmptyState>
  <AppCard v-else :title="words.title" :subtitle="words.card.subtitle" data-testid="spending-shortcuts">
    <template #actions>
      <UButton :label="words.card.add" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" data-testid="spending-shortcuts-add" @click="openDialog(null)" />
    </template>
    <ol class="flex flex-col pt-3 pb-2">
      <li
        v-for="({ held, name, caption, amount, currency, hidden }, index) in rows"
        :key="held.shortcut.id"
        class="flex items-start gap-2 border-b border-default px-4 last:border-b-0 sm:px-5"
        data-testid="spending-shortcut"
      >
        <ListRow as="div" flush :title="name" :caption="caption" class="min-w-0 flex-1">
          <template #amount>
            <AccountMoneyText :cents="amount" :currency="currency" tone="flow" />
          </template>
          <template v-if="hidden" #details>
            <span class="break-words type-caption" data-testid="spending-shortcut-hidden">{{ words.card.hidden }}</span>
          </template>
        </ListRow>
        <div class="flex shrink-0 items-center">
          <MoveButtons
            :up-label="words.card.up(name)"
            :down-label="words.card.down(name)"
            :first="index === 0"
            :last="index === rows.length - 1"
            :disabled="writes.refused.value"
            :saving="movingOf(held.shortcut)"
            test-id="spending-shortcut"
            @up="move(held.shortcut, -1)"
            @down="move(held.shortcut, 1)"
          />
          <UButton
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            class="size-11 justify-center"
            :aria-label="words.card.edit(name)"
            data-testid="spending-shortcut-edit"
            @click="openDialog(held)"
          />
        </div>
      </li>
    </ol>
  </AppCard>
  <ShortcutDialog v-model:open="dialogOpen" :held="editing" />
</template>
