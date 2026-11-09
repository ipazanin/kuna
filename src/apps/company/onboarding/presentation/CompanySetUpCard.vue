<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import AskChatButton from '../../../../shared/ai/presentation/AskChatButton.vue'
import { askChat } from '../../../../shared/ai/presentation/chatDock'
import { words as chatWords } from '../../../../shared/ai/presentation/words'
import { stillNew } from '../../../../shared/app/setUpLines'
import { words as assistantWords } from '../../assistant/words'
import GettingSetUpCard from '../../../../shared/ui/GettingSetUpCard.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import StatementDeliveryDialog from './StatementDeliveryDialog.vue'
import { useCategoriesLookRight } from './useCategoriesLookRight'
import { useDeliveryOffer } from './useDeliveryOffer'
import { CATEGORIES_LINE, DELIVERY_LINE, gettingSetUp } from './gettingSetUp'
import { words } from './words'

/** What new books still lack, on Overview above everything else. The categories line can be settled where it stands, since agreeing with them changes nothing else that would clear it. */
const { state } = useWorkbook()
const { lookRight, agree } = useCategoriesLookRight()

const { offered, opened, open, byHand } = useDeliveryOffer()

const lines = computed(() => (state.workbook === null ? [] : gettingSetUp(state.workbook, lookRight.value, offered.value)))
</script>

<template>
  <GettingSetUpCard :lines="lines">
    <template v-if="stillNew(lines)" #actions>
      <AskChatButton :text="chatWords.ask.setUp" data-testid="set-up-chat" @ask="askChat(assistantWords.guides.setUp.title)" />
    </template>
    <template #action="{ line }">
      <UButton
        v-if="line.key === CATEGORIES_LINE"
        :label="words.setUp.categoriesLookRight"
        color="neutral"
        variant="outline"
        size="sm"
        class="shrink-0"
        data-testid="set-up-categories-look-right"
        @click="agree"
      />
      <template v-if="line.key === DELIVERY_LINE">
        <UButton :label="words.setUp.deliveryByHand" color="neutral" variant="ghost" size="sm" class="shrink-0" data-testid="set-up-delivery-by-hand" @click="byHand" />
        <UButton :label="words.setUp.deliverySetUp" color="neutral" variant="outline" size="sm" class="shrink-0" data-testid="set-up-delivery" @click="open" />
      </template>
    </template>
  </GettingSetUpCard>
  <StatementDeliveryDialog v-model:open="opened" />
</template>
