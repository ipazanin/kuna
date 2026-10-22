<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USlideover from '@nuxt/ui/components/Slideover.vue'

import { today } from '../../../../shared/calendar/civilDate'
import { useStickyBandPart } from '../../../../shared/layout/stickyBand'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { fold } from '../../../../shared/text/fold'
import AppCard from '../../../../shared/ui/AppCard.vue'
import InfoPopover from '../../../../shared/ui/InfoPopover.vue'
import { useSettings } from '../../../../features/settings/application/useSettings'
import { findLocalUnit } from '../localUnits'
import { RULES, RULESET_CHECKED_ON, watchItems } from '../ruleset'
import type { RuleId } from '../ruleset'
import type { GeneralRule, RuleArea } from '../schema'
import ConfidenceBadge from './ConfidenceBadge.vue'
import RuleDetail from './RuleDetail.vue'
import WatchList from './WatchList.vue'
import { AREA_WORDING, CONFIDENCE_ORDER, CONFIDENCE_WORDING, dayLabel, openItemView, ruleLink, ruleView, termFormat, watchedVersionView } from './ruleWording'
import type { TableFocus } from './ruleWording'

type AreaChoice = RuleArea | 'all'

const route = useRoute()
const router = useRouter()
const settings = useSettings()
const phone = usePhoneLayout()

const generalRules: readonly GeneralRule[] = RULES
const areas: readonly RuleArea[] = [...new Set(generalRules.map((rule) => rule.area))]
const checkedOn = dayLabel(RULESET_CHECKED_ON)

const rules = computed(() => {
  const format = termFormat(settings.value.numberLocale)
  const day = today()
  return generalRules.map((rule) => ruleView(rule, format, day))
})

/** The local rates open on the unit the owner lives in, found by its name and its county. */
const localRatesFocus = computed((): TableFocus => {
  const { unit } = findLocalUnit(settings.value.companyFacts.residenceCity)
  return unit === null
    ? { cells: null, hint: 'Search for a city or municipality, or show them all. Set where the owner lives on the General tab to open on that one.' }
    : { cells: [unit.unit, unit.county], hint: '' }
})

function tableFocusOf(ruleId: string): TableFocus | null {
  return ruleId === 'hr.pit.local-rates' ? localRatesFocus.value : null
}

const watched = watchItems().map((watchItem) => (watchItem.kind === 'version' ? watchedVersionView(watchItem.rule, watchItem.version) : openItemView(watchItem.item)))

const search = ref('')
const area = ref<AreaChoice>('all')
const searched = computed(() => fold(search.value))

const matchesSearch = (searchText: string): boolean => searched.value === '' || searched.value.split(' ').every((word) => searchText.includes(word))

const rulesFound = computed(() => rules.value.filter((rule) => matchesSearch(rule.searchText)))
const rulesShown = computed(() => rulesFound.value.filter((rule) => area.value === 'all' || rule.area === area.value))
const watchShown = computed(() => watched.filter((item) => (area.value === 'all' || item.area === area.value) && matchesSearch(item.searchText)))

const areaChoices = computed(() => [
  { area: 'all' as const, label: 'All areas', count: rulesFound.value.length },
  ...areas.map((choice) => ({ area: choice, label: AREA_WORDING[choice].label, count: rulesFound.value.filter((rule) => rule.area === choice).length })),
])

const sections = computed(() =>
  areas
    .map((choice) => ({ area: choice, ...AREA_WORDING[choice], rules: rulesShown.value.filter((rule) => rule.area === choice) }))
    .filter((section) => section.rules.length > 0),
)

const linkedRule = computed(() => (typeof route.query.rule === 'string' ? route.query.rule : null))
const opened = computed(() => rules.value.find((rule) => rule.id === linkedRule.value) ?? null)
const linkedMissing = computed(() => linkedRule.value !== null && opened.value === null)

const panelOpen = computed({
  get: () => opened.value !== null,
  set: (open: boolean) => {
    if (open) return
    const { rule: _closed, ...others } = route.query
    // A rule opened from the list goes back to that entry, so the next Back leaves the list rather than showing it again.
    if (window.history.state?.back === router.resolve({ query: others }).fullPath) router.back()
    else void router.replace({ query: others })
  },
})

const filterBar = ref<HTMLElement | null>(null)
useStickyBandPart(filterBar)

/**
 * A linked rule hidden by the search or the area clears them, and its line scrolls to just below
 * the search bar, so closing the panel leaves the reader on that rule. The router scrolls a newly
 * opened screen to its top after it renders, and the web fonts move every line once they swap in,
 * so the line is scrolled to after both.
 */
watch(
  opened,
  async (rule) => {
    if (rule === null) {
      return
    }
    if (!rulesShown.value.includes(rule)) {
      search.value = ''
      area.value = 'all'
    }
    await nextTick()
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    await document.fonts.ready
    document.getElementById(`rule-${rule.id}`)?.scrollIntoView({ block: 'start' })
  },
  { immediate: true },
)
</script>

<template>
  <div class="flex flex-col gap-6">
    <p class="max-w-[75ch] text-sm text-muted">
      The Croatian law behind the pack's figures: each rule's value per year, the article it comes from, and how sure that value is. Checked against the sources on
      {{ checkedOn }}.
    </p>

    <div ref="filterBar" role="search" class="ruleset-bar" data-testid="ruleset-bar">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        enterkeyhint="search"
        placeholder="Search by rule id, name, act or article"
        aria-label="Search the ruleset"
        class="ruleset-search"
        data-testid="ruleset-search"
      >
        <template v-if="search" #trailing>
          <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" aria-label="Clear the search" @click="search = ''" />
        </template>
      </UInput>
      <div role="group" aria-label="Area" class="areas flex rounded-control border border-default bg-raised p-0.5">
        <button
          v-for="choice in areaChoices"
          :key="choice.area"
          type="button"
          class="area"
          :aria-pressed="area === choice.area"
          :data-testid="`area-${choice.area}`"
          @click="area = choice.area"
        >
          {{ choice.label }} <span class="figure text-muted">{{ choice.count }}</span>
        </button>
      </div>
      <p class="figure text-xs text-muted" aria-live="polite" data-testid="ruleset-count">
        {{ rulesShown.length === rules.length ? `${rules.length} rules` : `${rulesShown.length} of ${rules.length} rules` }}
      </p>
    </div>

    <AppCard v-if="linkedMissing" as="div" class="px-4 py-3" role="status">
      <p class="text-sm text-toned">
        The link points at <span class="identifier">{{ linkedRule }}</span>, which is not in the ruleset. It may have been renamed, so search for it below.
      </p>
    </AppCard>

    <WatchList :items="watchShown" :total="watched.length" :checked-on="checkedOn" :searching="searched !== ''" />

    <p v-if="sections.length === 0" class="py-6 text-sm text-muted">
      No rule matches "{{ search }}"{{ area === 'all' ? '' : ` in ${AREA_WORDING[area].label}` }}.
      <UButton label="Clear the search" color="neutral" variant="link" size="sm" class="inline-target" @click="search = ''; area = 'all'" />
    </p>

    <AppCard v-else title="Rules by area" subtitle="This year's value of each rule and how sure it is. Open a rule for every year, its notes and its sources." class="overflow-clip">
      <template #actions>
        <InfoPopover subject="how sure each value is">
          <dl class="flex max-w-sm flex-col gap-2.5 p-3" data-testid="confidence-legend">
            <div v-for="confidence in CONFIDENCE_ORDER" :key="confidence" class="flex flex-col items-start gap-1">
              <dt><ConfidenceBadge :confidence="confidence" /></dt>
              <dd class="text-xs text-toned">{{ CONFIDENCE_WORDING[confidence].meaning }}</dd>
            </div>
            <p class="text-xs text-muted">The figures are for planning with the accountant, never filing advice.</p>
          </dl>
        </InfoPopover>
      </template>
      <section v-for="section in sections" :key="section.area" class="mt-3" :aria-labelledby="`area-${section.area}-title`">
        <h3 :id="`area-${section.area}-title`" class="area-heading text-sm font-semibold text-highlighted">
          {{ section.label }} <span class="figure font-normal text-muted">{{ section.rules.length }}</span>
        </h3>
        <p class="area-description text-xs text-muted">{{ section.description }}</p>
        <ul>
          <li v-for="rule in section.rules" :key="rule.id">
            <RouterLink
              :id="`rule-${rule.id}`"
              :to="ruleLink(rule.id as RuleId)"
              class="rule-row"
              :aria-current="rule.id === linkedRule ? 'true' : undefined"
              :data-rule="rule.id"
              data-testid="rule-row"
            >
              <span class="rule-name">
                <span class="text-sm text-highlighted">{{ rule.title }}</span>
                <span class="identifier block text-xs text-muted" data-testid="rule-id">{{ rule.id }}</span>
              </span>
              <span v-if="rule.inForce.headline" class="rule-value figure text-sm text-default">
                <span v-if="rule.inForce.headline.label" class="me-1.5 text-xs text-muted">{{ rule.inForce.headline.label }}</span>{{ rule.inForce.headline.wording }}
              </span>
              <ConfidenceBadge :confidence="rule.inForce.confidence" class="rule-mark" />
            </RouterLink>
          </li>
        </ul>
      </section>
    </AppCard>

    <USlideover
      v-model:open="panelOpen"
      side="right"
      :title="opened?.title ?? ''"
      :ui="{ content: phone ? 'max-w-none' : 'sm:max-w-2xl', header: 'pe-16' }"
    >
      <template #description>
        <span v-if="opened" class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span class="identifier text-toned">{{ opened.id }}</span>
          <span>{{ opened.appliesBy }}</span>
        </span>
      </template>
      <template #body>
        <RuleDetail v-if="opened" :rule="opened" :phone="phone" :table-focus="tableFocusOf(opened.id)" />
      </template>
    </USlideover>
  </div>
</template>

<style scoped>
/*
 * Search and areas stay in reach while the list scrolls, as the filter bar does on the ledger
 * screens: under the top bar on a tablet, at the very top beside the sidebar, and under the sticky
 * tab row on a phone.
 */
.ruleset-bar {
  position: sticky;
  top: 3.5rem;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  margin-inline: -0.5rem;
  padding: 0.5rem;
  background: color-mix(in srgb, var(--surface-page) 92%, transparent);
  backdrop-filter: blur(10px);
}

@media (max-width: 639px) {
  .ruleset-bar {
    top: calc(3.5rem + env(safe-area-inset-top) + var(--page-tab-row, 0px));
  }
}

@media (min-width: 1024px) {
  .ruleset-bar {
    top: 0;
  }
}

.ruleset-search {
  width: 100%;
}

@media (min-width: 640px) {
  .ruleset-search {
    width: 20rem;
  }
}

.areas {
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}

.area {
  flex-shrink: 0;
  padding: 0.3125rem 0.625rem;
  border-radius: 4px;
  font-size: 0.8125rem;
  line-height: 1.25rem;
  color: var(--ink-muted);
  white-space: nowrap;
  transition:
    background-color 120ms ease,
    color 120ms ease;
}

.area:hover {
  color: var(--ink-strong);
  background: var(--surface-elevated);
}

.area[aria-pressed='true'] {
  color: var(--accent-strong);
  background: var(--accent-wash);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent);
  font-weight: 500;
}

.area:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

/* An area's heading stays under the search bar while its rules scroll past. */
.area-heading {
  position: sticky;
  top: var(--sticky-band);
  z-index: 1;
  padding: 0.5rem 1rem;
  border-block: 1px solid var(--border-default);
  background: var(--surface-elevated);
}

/* A linked rule lands below the search bar and its area's heading. */
.area-description {
  padding: 0.5rem 1rem 0.25rem;
}

.rule-row {
  scroll-margin-top: calc(var(--sticky-band) + 3rem);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'name name'
    'value mark';
  align-items: center;
  gap: 0.25rem 0.75rem;
  min-height: 3.25rem;
  padding: 0.5rem 1rem;
  transition: background-color 120ms ease;
}

li + li > .rule-row {
  border-top: 1px solid var(--border-default);
}

.rule-name {
  grid-area: name;
  min-width: 0;
}

.rule-value {
  grid-area: value;
}

.rule-mark {
  grid-area: mark;
  justify-self: end;
}

.rule-row:hover {
  background: var(--surface-elevated);
}

.rule-row[aria-current='true'] {
  background: var(--accent-wash);
  box-shadow: inset 2px 0 0 var(--accent);
}

.rule-row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

@media (min-width: 640px) {
  .area-heading,
  .area-description,
  .rule-row {
    padding-inline: 1.25rem;
  }

  .rule-row {
    grid-template-columns: minmax(0, 1fr) minmax(0, 14rem) 12rem;
    grid-template-areas: 'name value mark';
  }

  .rule-value {
    text-align: end;
  }
}
</style>
