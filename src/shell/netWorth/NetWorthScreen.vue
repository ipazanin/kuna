<script setup lang="ts">
import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { AppContribution, CountedHubPart, HubPart, HubState } from '../../shared/app/appContribution'
import { personalNet } from '../../shared/app/personalNet'
import { ratioOf, subtractMoney, sumMoney } from '../../shared/money/money'
import { DEFAULT_MONEY_FORMAT, formatMoney, formatShare } from '../../shared/money/moneyFormat'
import { ZERO_SHARE } from '../../shared/money/percent'
import AppCard from '../../shared/ui/AppCard.vue'
import DashboardGrid from '../../shared/ui/DashboardGrid.vue'
import MoneyText from '../../shared/ui/MoneyText.vue'
import NoteLine from '../../shared/ui/NoteLine.vue'
import PageHeader from '../../shared/ui/PageHeader.vue'
import ProgressMeter from '../../shared/ui/ProgressMeter.vue'
import { words as homeWords } from '../home/words'
import { entryPath, installedApps } from '../routing/appRegistry'
import OpeningPlaceholder from '../ui/OpeningPlaceholder.vue'
import { words as uiWords } from '../ui/words'
import NetWorthRow from './NetWorthRow.vue'
import { words } from './words'

interface HubApp<Part extends HubPart> {
  readonly app: AppContribution
  readonly name: string
  readonly notSetUp: boolean
  readonly currency: string
  readonly figures: HubState<Part>
}

/**
 * Net worth at `#/overview`: what you have less what you owe over the apps whose figures add up, each part
 * opening its app, and below it the money of an app kept apart, such as the company's. Each app's figures sit in a
 * computed of their own, so the company's forecast runs only while this screen is open and only when its books change.
 */
function hubApp<Part extends HubPart>(app: AppContribution, figures: () => HubState<Part>): ComputedRef<HubApp<Part>> {
  return computed(() => {
    const notSetUp = app.firstRun()
    return { app, name: app.name, notSetUp, currency: app.moneyFormat().currency, figures: notSetUp ? null : failedOnThrow(figures) }
  })
}

/** An app whose figures throw shows as failed, so the other apps' figures still show. */
function failedOnThrow<Part extends HubPart>(figures: () => HubState<Part>): HubState<Part> {
  try {
    return figures()
  } catch (failure) {
    console.error(failure)
    return 'failed'
  }
}

const countedApps = installedApps().flatMap((app) => {
  const { hub } = app
  return hub?.counts === true ? [hubApp(app, () => hub.figures())] : []
})
const apartApps = installedApps().flatMap((app) => {
  const { hub } = app
  return hub?.counts === false ? [hubApp(app, () => hub.figures())] : []
})

const personal = computed(() => personalNet(countedApps.map((entry) => entry.value)))
const apart = computed(() => apartApps.map((entry) => entry.value))

/** True while any app's books are still being read, which the screen's one status tells a screen reader. */
const opening = computed(() => personal.value.sum.state === 'opening' || apart.value.some((entry) => entry.figures === 'opening'))

/** The sum takes the format of the apps it adds up, which agree whenever it is shown. */
const sumFormat = computed(() => countedApps[0]?.value.app.moneyFormat() ?? DEFAULT_MONEY_FORMAT)

/** Why the sum is held back, in words, with the app that failed to open, or null while it shows or waits. */
const held = computed(() => {
  const { sum } = personal.value
  switch (sum.state) {
    case 'ready':
    case 'opening':
      return null
    case 'nothing':
      return { text: words.nothing, failed: null }
    case 'failed':
      return { text: words.failed(sum.apps.map((entry) => entry.name)), failed: sum.apps[0]?.app ?? null }
    case 'currencies':
      return { text: words.currencies, failed: null }
  }
})

interface ShownPart extends CountedHubPart {
  readonly app: AppContribution
  readonly value: string
}

const shownParts = computed((): ShownPart[] =>
  countedApps.flatMap(({ value: entry }) =>
    typeof entry.figures === 'object' && entry.figures !== null
      ? entry.figures.parts.map((part) => ({ ...part, app: entry.app, value: formatMoney(part.cents, 'negative', entry.app.moneyFormat()) }))
      : [],
  ),
)

/**
 * What you have, then what you owe, largest part first, each side with its total and its bar. Both bars share one scale, so the room left
 * on the shorter one is the sum. A screen reader hears the longer bar as its total and the shorter one as its share of it.
 */
const groups = computed(() => {
  const sides = (['has', 'owes'] as const).map((side) => {
    const parts = shownParts.value.filter((part) => part.side === side).sort((left, right) => right.cents - left.cents)
    return { side, title: side === 'has' ? words.has : words.owes, parts, total: sumMoney(parts.map((part) => part.cents)) }
  })
  const longer = sides[0]!.total >= sides[1]!.total ? sides[0]! : sides[1]!
  const shareWords = longer.side === 'has' ? words.shareOfHas : words.shareOfOwes
  return sides
    .filter((group) => group.parts.length > 0)
    .map((group) => {
      const totalText = formatMoney(group.total, 'negative', sumFormat.value)
      return {
        ...group,
        totalText,
        meter: [
          { value: group.total, colour: group.side === 'has' ? 'var(--net-has)' : 'var(--net-owes)' },
          { value: subtractMoney(longer.total, group.total), colour: 'var(--chart-ghost)' },
        ],
        meterLabel: `${group.title}: ${group === longer ? totalText : shareWords(formatShare(ratioOf(group.total, longer.total) ?? ZERO_SHARE))}`,
      }
    })
})

/** The bars show only while the sum does and both sides have a part, since one bar alone compares nothing. */
const balanced = computed(() => personal.value.sum.state === 'ready' && groups.value.length === 2)
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="words.title" />
    <p role="status" class="sr-only">{{ opening ? uiWords.opening : '' }}</p>

    <AppCard as="article" class="gap-6 p-4 sm:p-5" data-testid="overview-net-card">
      <div class="grid gap-5 @2xl:grid-cols-2 @2xl:gap-10">
        <div class="flex min-w-0 flex-col gap-2" :aria-busy="personal.sum.state === 'opening'" :data-state="personal.sum.state" data-testid="overview-net">
          <h2 class="type-label">{{ words.net }}</h2>
          <OpeningPlaceholder v-if="personal.sum.state === 'opening'" data-testid="overview-net-opening" />
          <template v-else-if="held !== null">
            <NoteLine v-if="held.failed !== null" tone="error" size="body" data-testid="overview-net-held">{{ held.text }}</NoteLine>
            <p v-else class="type-body" data-testid="overview-net-held">{{ held.text }}</p>
            <UButton
              v-if="held.failed !== null"
              :to="entryPath(held.failed)"
              :label="held.failed.name"
              trailing-icon="i-lucide-arrow-right"
              size="sm"
              color="neutral"
              variant="outline"
              class="self-start"
            />
          </template>
          <template v-else-if="personal.sum.state === 'ready'">
            <MoneyText :cents="personal.sum.cents" tone="outcome" :format="sumFormat" class="block text-figure-xl font-semibold" />
            <p v-if="personal.leavesOut.length > 0" class="type-caption">{{ words.leavesOut(personal.leavesOut) }}</p>
          </template>
        </div>

        <div v-if="balanced" class="flex min-w-0 flex-col justify-end gap-3" data-testid="overview-balance">
          <div v-for="group in groups" :key="group.side" class="flex flex-col gap-1.5">
            <p class="flex items-baseline justify-between gap-3">
              <span class="type-label">{{ group.title }}</span>
              <span class="type-body font-medium text-highlighted tabular-nums">{{ group.totalText }}</span>
            </p>
            <ProgressMeter :parts="group.meter" :label="group.meterLabel" :height="10" />
          </div>
        </div>
      </div>

      <div v-if="groups.length > 0 || personal.notSetUp.length > 0" class="grid gap-5 @2xl:grid-cols-2 @2xl:gap-10">
        <section v-for="group in groups" :key="group.side" class="flex min-w-0 flex-col" :aria-label="group.title" :data-side="group.side">
          <h3 class="border-b border-default py-2 type-label" :class="{ 'hidden @2xl:block': balanced }">{{ group.title }}</h3>
          <ul class="flex flex-col">
            <NetWorthRow
              v-for="part in group.parts"
              :key="part.label"
              :icon="part.app.homeCard.icon"
              :colour="part.app.colour"
              :label="part.label"
              :caption="part.caption"
              :figure="part.value"
              :to="part.to"
              data-testid="overview-part"
            />
          </ul>
        </section>

        <ul v-if="personal.notSetUp.length > 0" :class="{ '@2xl:col-span-2': balanced }" class="flex flex-col" data-testid="overview-not-set-up">
          <NetWorthRow
            v-for="entry in personal.notSetUp"
            :key="entry.app.id"
            :icon="entry.app.homeCard.icon"
            :colour="entry.app.colour"
            :label="words.notSetUp(entry.name)"
            :figure="null"
            :to="entry.app.startPath"
          />
        </ul>
      </div>
    </AppCard>

    <DashboardGrid v-if="apart.length > 0" layout="cards">
      <AppCard v-for="entry in apart" :key="entry.app.id" :title="words.apart" :data-app="entry.app.id" data-testid="overview-apart">
        <div class="px-4 pb-2 sm:px-5" :aria-busy="entry.figures === 'opening'">
          <OpeningPlaceholder v-if="entry.figures === 'opening'" class="mt-3 mb-2" data-testid="overview-apart-opening" />
          <div v-else-if="entry.figures === 'failed'" class="flex flex-col items-start gap-3 pt-3 pb-2 type-body">
            <span>{{ homeWords.failed }}</span>
            <UButton :to="entryPath(entry.app)" :label="entry.name" trailing-icon="i-lucide-arrow-right" size="sm" color="neutral" variant="outline" />
          </div>
          <ul v-else-if="entry.figures === null" class="flex flex-col">
            <NetWorthRow :icon="entry.app.homeCard.icon" :colour="entry.app.colour" :label="words.notSetUp(entry.name)" :figure="null" :to="entryPath(entry.app)" />
          </ul>
          <template v-else>
            <ul v-if="entry.figures.parts.length > 0" class="flex flex-col">
              <NetWorthRow
                v-for="part in entry.figures.parts"
                :key="part.label"
                :icon="entry.app.homeCard.icon"
                :colour="entry.app.colour"
                :label="part.label"
                :caption="part.caption"
                :figure="formatMoney(part.cents, 'negative', entry.app.moneyFormat())"
                :to="part.to"
                data-testid="overview-apart-part"
              />
            </ul>
            <p v-for="line in entry.figures.notes" :key="line" class="pt-3 pb-2 type-caption">{{ line }}</p>
          </template>
        </div>
      </AppCard>
    </DashboardGrid>
  </section>
</template>
