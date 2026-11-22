<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { BankLink } from '../domain/bankLink'
import type { BankLinking } from './bankLinking'
import type { BankSyncHost } from './bankSyncHost'
import { words } from './words'
import { dayLabel } from '../../calendar/dayLabel'
import AppDialog from '../../ui/AppDialog.vue'
import ListRow from '../../ui/ListRow.vue'
import NoteLine from '../../ui/NoteLine.vue'

/** The banks Enable Banking lists for Croatia that take the app's login, each a row that starts its approval. It asks for the list each time it opens. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  links: readonly BankLink[]
  linking: BankLinking
  /** A link ends in a write to the book, so none starts while the book takes no changes. */
  host: BankSyncHost
}>()

/** Whether a bank was tapped since the dialog opened, so a failure the card already shows from an earlier sync stays out of the dialog. */
const tapped = ref(false)

watch(open, (opened) => {
  if (!opened) return
  tapped.value = false
  void props.linking.listBanks()
})

function link(bank: string): void {
  tapped.value = true
  void props.linking.link(bank)
}

const banks = computed(() =>
  (props.linking.listed.value ?? []).map((bank) => {
    const linked = props.links.find((link) => link.bank === bank.name) ?? null
    return { ...bank, caption: [linked === null ? '' : words.pick.linked(dayLabel(linked.endsOn)), bank.beta ? words.pick.betaCaption : ''].filter((part) => part !== '').join(' ') }
  }),
)
</script>

<template>
  <AppDialog v-model:open="open" :title="words.pick.title" :description="words.pick.description[linking.usage]" :dismissible="!linking.busy.value" changes>
    <NoteLine v-if="tapped && !linking.busy.value && linking.failure.value !== null" tone="error" size="body" data-testid="spending-bank-pick-link-failed">{{ linking.failure.value }}</NoteLine>
    <NoteLine v-if="linking.busy.value" tone="info" size="body" data-testid="spending-bank-pick-opening">{{ words.pick.opening }}</NoteLine>
    <NoteLine v-else-if="linking.listing.value" tone="info" size="body" data-testid="spending-bank-pick-loading">{{ words.pick.loading }}</NoteLine>
    <div v-else-if="linking.listFailure.value !== null" class="flex flex-col items-start gap-3">
      <NoteLine tone="error" size="body" data-testid="spending-bank-pick-failed">{{ words.pick.failed(linking.listFailure.value) }}</NoteLine>
      <UButton :label="words.pick.tryAgain" icon="i-lucide-refresh-cw" color="neutral" variant="outline" size="sm" data-testid="spending-bank-pick-retry" @click="linking.listBanks()" />
    </div>
    <p v-else-if="banks.length === 0" class="type-aside" data-testid="spending-bank-pick-none">{{ words.pick.none[linking.usage] }}</p>
    <ul v-else class="divide-y divide-default overflow-hidden rounded-control border border-default" data-testid="spending-bank-pick">
      <li v-for="bank in banks" :key="bank.name">
        <ListRow as="button" :title="bank.name" :caption="bank.caption" :disabled="host.writes.refused.value" data-testid="spending-bank-pick-bank" @click="link(bank.name)" />
      </li>
    </ul>
    <template #end>
      <UButton :label="words.pick.cancel" color="neutral" variant="ghost" data-testid="spending-bank-pick-cancel" @click="open = false" />
    </template>
  </AppDialog>
</template>
