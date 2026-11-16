<script setup lang="ts">
import { ref } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { moneyFromCents } from '../../shared/money/money'
import AppCard from '../../shared/ui/AppCard.vue'
import DashboardGrid from '../../shared/ui/DashboardGrid.vue'
import MoneyText from '../../shared/ui/MoneyText.vue'
import NoteLine from '../../shared/ui/NoteLine.vue'
import ListRow from '../../shared/ui/ListRow.vue'
import SelectionBar from '../../shared/ui/SelectionBar.vue'
import GallerySection from './GallerySection.vue'

const picked = ref<ReadonlySet<string>>(new Set(['pharmacy']))

function pick(key: string): void {
  const current = new Set(picked.value)
  if (current.has(key)) current.delete(key)
  else current.add(key)
  picked.value = current
}
</script>

<template>
  <GallerySection
    id="list-row"
    title="ListRow"
    description="A row of a list: its title beside its amount and the lines under it running on under the amount. A row that asks something of a person has its actions underneath, and as a button it expands as a whole. With a link it opens a page and ends with an arrow on the title's line, and a caption-sized figure beside the title shares its baseline. A row that opens nothing among rows that do keeps their arrow's column empty, so the amounts end at one edge. It spans a card with the card's gutter, or sits flush inside padding of its own."
  >
    <DashboardGrid>
      <AppCard title="Spanning a card">
        <ul class="divide-y divide-default">
          <ListRow title="Corner Market" caption="3 Mar 2026 · Current account">
            <template #amount><MoneyText :cents="moneyFromCents(-4_530)" tone="flow" /></template>
            <UButton class="self-start" label="Not cash" color="neutral" variant="outline" size="sm" />
          </ListRow>
          <ListRow title="Advance" caption="Not found among the bank rows">
            <template #amount><MoneyText :cents="moneyFromCents(30_000)" sign="magnitude" class="text-muted" /></template>
          </ListRow>
          <ListRow title="Savings → Current account" caption="5 Mar 2026">
            <template #details>
              <UBadge label="Waits for the other row" color="neutral" variant="subtle" size="sm" class="self-start" />
              <NoteLine tone="warning">The other row is a day later than this one.</NoteLine>
            </template>
            <template #amount><MoneyText :cents="moneyFromCents(120_000)" tone="flow" /></template>
            <div class="flex flex-wrap gap-2">
              <UButton label="Link" icon="i-lucide-link" color="neutral" variant="outline" size="sm" />
              <UButton label="Not this one" color="neutral" variant="outline" size="sm" />
            </div>
          </ListRow>
        </ul>
      </AppCard>
      <AppCard title="Flush inside a card's body">
        <ul class="flex flex-col divide-y divide-default px-4 pb-1 sm:px-5">
          <ListRow title="Corner Market" caption="3 Mar 2026 · Groceries" flush>
            <template #amount>
              <MoneyText :cents="moneyFromCents(-4_530)" tone="flow" />
              <MoneyText :cents="moneyFromCents(1_204_470)" class="type-caption" />
            </template>
          </ListRow>
          <ListRow title="Rent" caption="1 Mar 2026 · Already in the books" quiet flush>
            <template #amount><MoneyText :cents="moneyFromCents(-65_000)" class="text-muted" /></template>
          </ListRow>
          <ListRow title="Row 14" caption="The type in column B is not one Kuna knows" flush />
        </ul>
      </AppCard>
      <AppCard title="A row that expands as a whole">
        <ul class="divide-y divide-default">
          <li>
            <ListRow as="button" title="SNACK KIOSK" :aria-expanded="false">
              <template #details>
                <span class="mt-1 flex flex-wrap gap-1.5"><UBadge label="No rule" color="info" variant="subtle" size="sm" /></span>
              </template>
              <template #amount>
                <MoneyText :cents="moneyFromCents(-640)" tone="flow" />
                <span class="figure type-caption">8 Oct 2026, Main</span>
              </template>
            </ListRow>
          </li>
          <li>
            <ListRow as="button" title="GADGET CORNER" class="bg-elevated" :aria-expanded="true">
              <template #details>
                <span class="mt-1 flex flex-wrap gap-1.5"><UBadge label="No rule" color="info" variant="subtle" size="sm" /></span>
              </template>
              <template #amount>
                <MoneyText :cents="moneyFromCents(-3_890)" tone="flow" />
                <span class="figure type-caption">8 Aug 2026, Main</span>
              </template>
            </ListRow>
            <p class="bg-elevated px-4 pb-4 type-body sm:px-5">What opens under it. Tab to a row to see its ring inside its edge.</p>
          </li>
        </ul>
      </AppCard>
      <AppCard title="Rows being picked">
        <ul class="divide-y divide-default">
          <ListRow title="City pharmacy" caption="3 Mar 2026 · Current account" :picked="picked.has('pharmacy')" @pick="pick('pharmacy')">
            <template #amount><MoneyText :cents="moneyFromCents(-1_280)" tone="flow" /></template>
            <UButton class="self-start" label="Hidden while picking" color="neutral" variant="outline" size="sm" />
          </ListRow>
          <ListRow title="Corner Market" caption="4 Mar 2026 · Current account" :picked="picked.has('market')" @pick="pick('market')">
            <template #amount><MoneyText :cents="moneyFromCents(-4_530)" tone="flow" /></template>
          </ListRow>
          <ListRow title="Hardware store" caption="Split into parts, so each part is filed on its own" :picked="false" unpickable>
            <template #amount><MoneyText :cents="moneyFromCents(-12_000)" tone="flow" /></template>
          </ListRow>
        </ul>
      </AppCard>
      <AppCard title="Rows that open a page">
        <ul class="row-list flex flex-col py-2">
          <li class="border-t border-default first:border-t-0">
            <ListRow to="/gallery" title="Current account" caption="Bank · Main Bank · EUR">
              <template #amount><MoneyText :cents="moneyFromCents(1_204_470)" class="text-highlighted" /></template>
            </ListRow>
          </li>
          <li class="border-t border-default first:border-t-0">
            <ListRow to="/gallery" title="Travel card" caption="Bank · Card Bank · USD">
              <template #amount>
                <span class="figure text-highlighted">$1,234.56</span>
                <span class="figure text-xs text-toned">€1,140.20</span>
              </template>
              <template #details><span class="text-end type-caption">At the ECB rate of 13 Nov</span></template>
            </ListRow>
          </li>
          <li class="border-t border-default first:border-t-0">
            <ListRow to="/gallery" title="Savings for the long summer holiday by the sea with the whole family" caption="Savings · Main Bank · EUR">
              <template #amount><MoneyText :cents="moneyFromCents(560_000)" class="text-highlighted" /></template>
            </ListRow>
          </li>
          <li class="border-t border-default first:border-t-0">
            <ListRow as="div" title="Cash at the broker" caption="Opens nothing, and its amount ends where the others do">
              <template #amount><MoneyText :cents="moneyFromCents(31_250)" class="text-highlighted" /></template>
            </ListRow>
          </li>
          <li class="border-t border-default first:border-t-0">
            <ListRow to="/gallery" title="Car loan">
              <template #caption>Bank loan · <span class="text-toned">Main Bank</span></template>
              <template #amount><span class="type-caption">Settled on 3 Mar 2026</span></template>
            </ListRow>
          </li>
        </ul>
      </AppCard>
    </DashboardGrid>
  </GallerySection>

  <GallerySection
    id="selection-bar"
    title="SelectionBar"
    description="The bar that stays in reach while rows are being picked: how many are picked, Pick all where the list offers it, the actions on the picked rows, and Cancel. It sticks under the top bar and the tab row, and on a phone Cancel is a cross so Pick all shares the count's line, while the other buttons wrap under it."
  >
    <AppCard as="div" class="flex flex-col">
      <SelectionBar :count="picked.size" :all-picked="picked.size === 2" @pick-all="picked = new Set(['pharmacy', 'market'])" @cancel="picked = new Set()">
        <UButton label="File under" color="neutral" variant="outline" trailing-icon="i-lucide-chevron-down" :disabled="picked.size === 0" />
      </SelectionBar>
      <p class="px-4 py-3 type-body sm:px-5">The rows above share these picks.</p>
    </AppCard>
    <AppCard as="div" class="flex flex-col">
      <SelectionBar :count="1" @cancel="() => {}">
        <UButton label="Label" color="neutral" variant="outline" />
      </SelectionBar>
      <p class="px-4 py-3 type-body sm:px-5">A list that offers no Pick all, as Entries.</p>
    </AppCard>
  </GallerySection>

  <GallerySection
    id="note-line"
    title="NoteLine"
    description="An icon and a short line of words in a tone that picks its icon. A caption takes the tone in its words too, and body size only in its icon. In inherit size it keeps the size and ink of where it sits, as a figure beside other figures. Inline, it flows on inside a sentence or a cell. A tone icon before words is always one."
  >
    <AppCard as="div" class="flex flex-col gap-2 p-4 sm:p-5">
      <NoteLine tone="warning">This settles in the next tax year.</NoteLine>
      <NoteLine tone="error">The file could not be read.</NoteLine>
      <NoteLine tone="success">Done.</NoteLine>
      <NoteLine tone="muted" icon="i-lucide-link">Linked to an instalment that Loans is still opening.</NoteLine>
      <NoteLine icon="i-lucide-arrow-right">The chat goes on once this is written.</NoteLine>
      <NoteLine tone="info">Kuna fills this in once the bank sends the next statement.</NoteLine>
      <NoteLine tone="warning"
        >A long note wraps under its own first word rather than under the icon, so a reason that runs over several lines on a phone still reads as one line with its mark.</NoteLine
      >
      <NoteLine size="body" tone="warning">The tax is an estimate until every rate of the year is known. In body size the words keep body ink and only the icon takes the tone.</NoteLine>
      <p class="flex gap-4 text-sm">
        <MoneyText :cents="moneyFromCents(412_000)" />
        <NoteLine as="span" size="inherit" inline tone="warning"><MoneyText :cents="moneyFromCents(-1_250)" sign="always" /></NoteLine>
      </p>
      <p class="type-caption">
        A sentence with a flag in it
        <NoteLine as="span" tone="warning" inline class="ms-1 font-medium">differs</NoteLine>
      </p>
    </AppCard>
  </GallerySection>
</template>
