<script setup lang="ts">
import { useChatElement } from '../../shared/ai/presentation/chatDock'
import { assistKeyKept } from '../../shared/ai/presentation/aiProvider'
import AskChatButton from '../../shared/ai/presentation/AskChatButton.vue'
import { moneyFromCents } from '../../shared/money/money'
import { formatMoney } from '../../shared/money/moneyFormat'
import DashboardGrid from '../../shared/ui/DashboardGrid.vue'
import KpiTile from '../../shared/ui/KpiTile.vue'
import GallerySection from './GallerySection.vue'

const { ask: askAboutCash, marked: cashMarked } = useChatElement(
  {
    key: 'gallery.cash',
    label: 'Cash on hand',
    about: { kind: 'figure', app: 'company', report: 'overview', period: null, label: 'Cash on hand' },
  },
  'card',
)
const { ask: askAboutRent, marked: rentMarked } = useChatElement(
  {
    key: 'gallery.rent',
    label: 'Rent',
    about: { kind: 'record', app: 'spending', recordKind: 'transaction', id: 'gallery-rent' },
  },
  'row',
)
</script>

<template>
  <GallerySection
    id="chat-tag"
    title="Asking the chat about an element"
    description="A page calls useChatElement with a key, a label and what the element is. AskChatButton calls its ask, which opens the chat about it, and the element binds its marked, with the shape it draws on. While the open chat is about it, a card keeps its surface under the accent wash with its border in accent, and a row takes the selected sidebar row's wash and bar. A dense row takes the icon alone. A button that names a task, such as Set up with the chat, sends it by itself, at md size beside a step's buttons and spinning while its action runs. It shows with a key kept."
  >
    <div v-if="assistKeyKept" class="flex flex-col gap-4">
      <DashboardGrid layout="tiles">
        <KpiTile v-bind="cashMarked" label="Cash on hand" :value="formatMoney(moneyFromCents(1_248_000))" :to="null" data-testid="gallery-chat-element">
          <AskChatButton label="Cash on hand" class="mt-3" data-testid="gallery-chat-ask" @ask="askAboutCash" />
        </KpiTile>
      </DashboardGrid>
      <ul class="flex max-w-md flex-col">
        <li v-bind="rentMarked" class="flex items-center justify-between gap-2 rounded-control px-2 py-0.5 type-body" data-testid="gallery-chat-row">
          Rent
          <AskChatButton label="Rent" icon-only data-testid="gallery-chat-row-ask" @ask="askAboutRent" />
        </li>
        <li class="flex items-center justify-between gap-2 rounded-control px-2 py-0.5 type-body">
          Groceries
          <AskChatButton label="Groceries" icon-only />
        </li>
      </ul>
      <div class="flex flex-wrap items-center gap-2">
        <AskChatButton text="Set up with the chat" size="md" />
        <AskChatButton text="Set up with the chat" size="md" loading />
      </div>
    </div>
  </GallerySection>
</template>
