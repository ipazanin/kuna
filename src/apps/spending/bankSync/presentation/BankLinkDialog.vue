<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { BankLink } from '../domain/bankLink'
import { useBankSync } from './useBankSync'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { words } from './words'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import ListRow from '../../../../shared/ui/ListRow.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'

/** The banks Enable Banking lists for Croatia that take a personal login, each a row that starts its approval. It asks for the list each time it opens. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{ links: readonly BankLink[] }>()

const sync = useBankSync()
/** A link ends in a write to the book, so none starts while the book takes no changes. */
const writes = useRecordWrites(useSpendingBooks())

/** Whether a bank was tapped since the dialog opened, so a failure the card already shows from an earlier sync stays out of the dialog. */
const tapped = ref(false)

watch(open, (opened) => {
  if (!opened) return
  tapped.value = false
  void sync.listBanks()
})

function link(bank: string): void {
  tapped.value = true
  void sync.link(bank)
}

const banks = computed(() =>
  (sync.listed.value ?? []).map((bank) => {
    const linked = props.links.find((link) => link.bank === bank.name) ?? null
    return { ...bank, caption: [linked === null ? '' : words.pick.linked(dayLabel(linked.endsOn)), bank.beta ? words.pick.betaCaption : ''].filter((part) => part !== '').join(' ') }
  }),
)
</script>

<template>
  <AppDialog v-model:open="open" :title="words.pick.title" :description="words.pick.description" :dismissible="!sync.busy.value" changes>
    <NoteLine v-if="tapped && !sync.busy.value && sync.failure.value !== null" tone="error" size="body" data-testid="spending-bank-pick-link-failed">{{ sync.failure.value }}</NoteLine>
    <NoteLine v-if="sync.busy.value" tone="info" size="body" data-testid="spending-bank-pick-opening">{{ words.pick.opening }}</NoteLine>
    <NoteLine v-else-if="sync.listing.value" tone="info" size="body" data-testid="spending-bank-pick-loading">{{ words.pick.loading }}</NoteLine>
    <div v-else-if="sync.listFailure.value !== null" class="flex flex-col items-start gap-3">
      <NoteLine tone="error" size="body" data-testid="spending-bank-pick-failed">{{ words.pick.failed(sync.listFailure.value) }}</NoteLine>
      <UButton :label="words.pick.tryAgain" icon="i-lucide-refresh-cw" color="neutral" variant="outline" size="sm" data-testid="spending-bank-pick-retry" @click="sync.listBanks()" />
    </div>
    <p v-else-if="banks.length === 0" class="type-aside" data-testid="spending-bank-pick-none">{{ words.pick.none }}</p>
    <ul v-else class="divide-y divide-default overflow-hidden rounded-control border border-default" data-testid="spending-bank-pick">
      <li v-for="bank in banks" :key="bank.name">
        <ListRow as="button" :title="bank.name" :caption="bank.caption" :disabled="writes.refused.value" data-testid="spending-bank-pick-bank" @click="link(bank.name)" />
      </li>
    </ul>
    <template #end>
      <UButton :label="words.pick.cancel" color="neutral" variant="ghost" data-testid="spending-bank-pick-cancel" @click="open = false" />
    </template>
  </AppDialog>
</template>
