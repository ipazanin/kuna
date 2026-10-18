<script setup lang="ts">
import ConfidenceBadge from './ConfidenceBadge.vue'
import RuleSources from './RuleSources.vue'
import RuleTable from './RuleTable.vue'
import type { RuleView } from './ruleWording'

/** One rule: its value per version, side by side on a wide screen and one version under another on a phone. */
defineProps<{
  rule: RuleView
  phone: boolean
  /** The rule a deep link points at. */
  linked: boolean
}>()
</script>

<template>
  <article
    :id="`rule-${rule.id}`"
    tabindex="-1"
    class="rule-card rounded-card border border-default bg-raised shadow-raised"
    :class="{ 'is-linked': linked }"
    :data-linked="linked ? 'true' : undefined"
    :aria-labelledby="`rule-${rule.id}-title`"
    data-testid="rule-card"
  >
    <header class="flex flex-col gap-1 px-4 pt-4 sm:px-5">
      <h3 :id="`rule-${rule.id}-title`" class="text-[0.9375rem] font-medium text-highlighted">{{ rule.title }}</h3>
      <p class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs text-muted">
        <span class="identifier text-toned" data-testid="rule-id">{{ rule.id }}</span>
        <span>{{ rule.appliesBy }}</span>
      </p>
    </header>

    <div class="rule-body px-4 pt-3 pb-4 sm:px-5">
      <div class="flex min-w-0 flex-col gap-4">
        <template v-if="phone">
          <section v-for="(column, columnIndex) in rule.columns" :key="column.period" class="flex flex-col gap-2" :aria-label="column.period">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h4 class="figure text-sm font-medium text-highlighted">{{ column.period }}</h4>
              <ConfidenceBadge :confidence="column.confidence" />
            </div>
            <dl v-if="rule.rows.length > 0" class="flex flex-col">
              <div v-for="row in rule.rows" :key="row.key" class="phone-term">
                <dt class="text-xs text-muted">{{ row.label }}</dt>
                <dd class="figure text-sm" :class="row.cells[columnIndex]?.changed ? 'is-changed' : 'text-default'">
                  {{ row.cells[columnIndex]?.wording }}<span v-if="row.cells[columnIndex]?.changed" class="sr-only">, changed</span>
                </dd>
              </div>
            </dl>
          </section>
        </template>
        <ul v-else-if="rule.rows.length === 0" class="flex flex-wrap gap-x-6 gap-y-2" aria-label="Versions">
          <li v-for="column in rule.columns" :key="column.period" class="flex items-center gap-2">
            <span class="figure text-sm font-medium text-highlighted">{{ column.period }}</span>
            <ConfidenceBadge :confidence="column.confidence" />
          </li>
        </ul>
        <div v-else class="overflow-x-auto">
          <table class="data-table value-table w-full text-sm" data-testid="rule-values">
            <thead>
              <tr>
                <th scope="col" class="text-start"><span class="sr-only">Term</span></th>
                <th v-for="column in rule.columns" :key="column.period" scope="col" class="text-start">
                  <span class="flex flex-wrap items-center gap-2">
                    <span class="figure text-sm font-medium text-highlighted">{{ column.period }}</span>
                    <ConfidenceBadge :confidence="column.confidence" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rule.rows" :key="row.key">
                <th scope="row" class="term-label text-start font-normal text-toned">{{ row.label }}</th>
                <td v-for="(cell, index) in row.cells" :key="index" class="figure" :class="cell.changed ? 'is-changed' : 'text-default'">
                  {{ cell.wording }}<span v-if="cell.changed" class="sr-only">, changed</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <RuleTable v-for="table in rule.tables" :key="table.key" :table="table" :phone="phone" />

        <div v-if="rule.notes.length > 0" class="flex flex-col gap-1.5">
          <p v-for="note in rule.notes" :key="note.period ?? 'all'" class="max-w-[75ch] text-xs leading-relaxed text-toned">
            <span v-if="note.period !== null" class="figure font-medium text-highlighted">{{ note.period }}. </span>{{ note.note }}
          </p>
        </div>
      </div>

      <RuleSources :sources="rule.sources" class="min-w-0" />
    </div>
  </article>
</template>

<style scoped>
.rule-card {
  outline: none;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.rule-card.is-linked {
  border-color: var(--accent);
  box-shadow:
    0 0 0 3px var(--accent-wash),
    var(--elevation-raised);
}

.rule-body {
  display: grid;
  gap: 1rem;
}

@media (min-width: 1024px) {
  .rule-body {
    grid-template-columns: minmax(0, 1.7fr) minmax(16rem, 1fr);
    gap: 1.5rem;
  }
}

.value-table th,
.value-table td {
  white-space: normal;
  vertical-align: top;
}

.value-table th:first-child,
.value-table td:first-child {
  padding-inline-start: 0;
}

.value-table .term-label {
  width: 40%;
  min-width: 10rem;
}

/* A value a newer version changed, so a reader scanning across the years finds it. */
.is-changed {
  color: var(--ink-strong);
  font-weight: 500;
}

td.is-changed {
  box-shadow: inset 2px 0 0 var(--accent);
}

.phone-term {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 0.75rem;
  padding-block: 0.375rem;
}

.phone-term + .phone-term {
  border-top: 1px solid var(--border-default);
}

.phone-term dd {
  max-width: 55%;
  text-align: end;
}
</style>
