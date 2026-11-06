<script setup lang="ts">
import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import type { AppContribution, HubPart, HubState } from '../../shared/app/appContribution'
import { personalNet } from '../../shared/app/personalNet'
import { DEFAULT_MONEY_FORMAT, formatMoney } from '../../shared/money/moneyFormat'
import DashboardGrid from '../../shared/ui/DashboardGrid.vue'
import KpiTile from '../../shared/ui/KpiTile.vue'
import PageHeader from '../../shared/ui/PageHeader.vue'
import { words as homeWords } from '../home/words'
import { entryPath, installedApps } from '../routing/appRegistry'
import OpeningPlaceholder from '../ui/OpeningPlaceholder.vue'
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

/** The sum takes the format of the apps it adds up, which agree whenever it is shown. */
const sumFormat = computed(() => countedApps[0]?.value.app.moneyFormat() ?? DEFAULT_MONEY_FORMAT)

const lead = computed(() => {
  const { sum } = personal.value
  switch (sum.state) {
    case 'ready':
      return { text: formatMoney(sum.cents, 'negative', sumFormat.value), held: false, to: null }
    case 'opening':
      return { text: '', held: false, to: null }
    case 'nothing':
      return { text: words.nothing(countedApps.map((entry) => entry.value.name)), held: true, to: null }
    case 'failed': {
      const [first] = sum.apps
      return { text: words.failed(sum.apps.map((entry) => entry.name)), held: true, to: first === undefined ? null : entryPath(first.app) }
    }
    case 'currencies':
      return { text: words.currencies, held: true, to: null }
  }
})

/** What you have before what you owe, each in its own app's format. */
const parts = computed(() => {
  const shown = countedApps.flatMap(({ value: entry }) =>
    typeof entry.figures === 'object' && entry.figures !== null ? entry.figures.parts.map((part) => ({ ...part, value: formatMoney(part.cents, 'negative', entry.app.moneyFormat()) })) : [],
  )
  return [...shown.filter((part) => part.side === 'has'), ...shown.filter((part) => part.side === 'owes')]
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="words.title" :description="words.description" />

    <DashboardGrid layout="tiles" data-testid="overview-tiles">
      <KpiTile
        :label="words.net"
        :value="lead.text"
        :caption="personal.sum.state === 'ready' ? words.leavesOut(personal.leavesOut) : ''"
        :to="lead.to"
        :data-state="personal.sum.state"
        data-testid="overview-net"
      >
        <template v-if="personal.sum.state === 'opening'" #value>
          <OpeningPlaceholder data-testid="overview-net-opening" />
        </template>
        <template v-else-if="lead.held" #value>
          <span class="block type-body font-normal" data-testid="overview-net-held">{{ lead.text }}</span>
        </template>
      </KpiTile>
      <KpiTile v-for="part in parts" :key="part.label" :label="part.label" :value="part.value" :caption="part.caption ?? ''" :to="part.to" data-testid="overview-part" />
    </DashboardGrid>

    <ul v-if="personal.notSetUp.length > 0" class="flex flex-col gap-2" data-testid="overview-not-set-up">
      <li v-for="entry in personal.notSetUp" :key="entry.app.id" class="flex flex-wrap items-center gap-3 type-body">
        <span>{{ words.notSetUp(entry.name) }}</span>
        <UButton :to="entry.app.startPath" :label="homeWords.setUp" trailing-icon="i-lucide-arrow-right" size="sm" color="neutral" variant="outline" />
      </li>
    </ul>

    <section v-for="entry in apart" :key="entry.app.id" class="flex flex-col gap-3" :aria-label="words.apart" :data-app="entry.app.id" data-testid="overview-apart">
      <h2 class="type-card-title">{{ words.apart }}</h2>
      <OpeningPlaceholder v-if="entry.figures === 'opening'" data-testid="overview-apart-opening" />
      <p v-else-if="entry.figures === 'failed'" class="flex flex-wrap items-center gap-3 type-body">
        <span>{{ homeWords.failed }}</span>
        <UButton :to="entryPath(entry.app)" :label="entry.name" trailing-icon="i-lucide-arrow-right" size="sm" color="neutral" variant="outline" />
      </p>
      <p v-else-if="entry.figures === null" class="flex flex-wrap items-center gap-3 type-body">
        <span>{{ words.notSetUp(entry.name) }}</span>
        <UButton :to="entryPath(entry.app)" :label="homeWords.setUp" trailing-icon="i-lucide-arrow-right" size="sm" color="neutral" variant="outline" />
      </p>
      <template v-else>
        <DashboardGrid v-if="entry.figures.parts.length > 0" layout="tiles">
          <KpiTile
            v-for="part in entry.figures.parts"
            :key="part.label"
            :label="part.label"
            :value="formatMoney(part.cents, 'negative', entry.app.moneyFormat())"
            :caption="part.caption ?? ''"
            :to="part.to"
            data-testid="overview-apart-part"
          />
        </DashboardGrid>
        <p v-for="line in entry.figures.notes" :key="line" class="type-caption">{{ line }}</p>
      </template>
    </section>
  </section>
</template>
