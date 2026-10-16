<script setup lang="ts">
import UAlert from '@nuxt/ui/components/Alert.vue'

import { useWorkbook } from '../../workbook/application/workbookStore'
import DataSourceChoices from './DataSourceChoices.vue'

/** The first run: no workbook yet, so the only question is where the ledger lives. */
const { state } = useWorkbook()

const privacyPage = `${import.meta.env.BASE_URL}privacy.html`
</script>

<template>
  <main class="welcome min-h-dvh">
    <div class="welcome-column mx-auto flex max-w-2xl flex-col gap-8 px-4 pt-14 pb-16 sm:px-6 sm:pt-24">
      <header class="flex flex-col gap-4">
        <div class="flex items-center gap-3">
          <svg viewBox="0 0 32 32" class="size-9 shrink-0" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="var(--accent)" />
            <path d="M8 22h16M10 18v-6M16 18V9M22 18v-4" stroke="var(--accent-ink)" stroke-width="2.5" stroke-linecap="round" />
          </svg>
          <h1 data-testid="screen-title" class="text-title font-semibold text-highlighted">Ledgerboard</h1>
        </div>
        <p class="max-w-[52ch] text-base text-toned">
          Company finances from your bank ledger: where the money goes, what a normal month looks like, and how long the cash lasts. Every
          figure is worked out in this browser.
        </p>
      </header>

      <section class="flex flex-col gap-3" aria-labelledby="welcome-question">
        <h2 id="welcome-question" class="text-sm font-medium text-highlighted">Where is your ledger?</h2>
        <UAlert
          v-if="state.status === 'error' && state.error"
          icon="i-lucide-triangle-alert"
          color="error"
          variant="subtle"
          title="That did not work"
          :description="state.error"
        />
        <DataSourceChoices :current="null" />
      </section>

      <footer class="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
        <span>No server. Your data stays in your Sheet, this browser and the files you export.</span>
        <a :href="privacyPage" class="welcome-link inline-target">Privacy</a>
      </footer>
    </div>
  </main>
</template>

<style scoped>
/* Faint ruled lines, as on a ledger page, fading out further down. */
.welcome {
  background-color: var(--surface-page);
  background-image:
    linear-gradient(to bottom, transparent 0, var(--surface-page) 42rem),
    repeating-linear-gradient(to bottom, transparent 0 31px, var(--border-default) 31px 32px);
}

/* The margin rule of a ledger book, in the brass accent, beside the column on wide screens. */
.welcome-column {
  position: relative;
}

@media (min-width: 768px) {
  .welcome-column::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: -1.5rem;
    width: 1px;
    background: linear-gradient(to bottom, var(--accent) 0%, transparent 85%);
    opacity: 0.6;
  }
}

.welcome-link {
  color: var(--ink-secondary);
  text-decoration: underline;
  text-decoration-color: var(--border-strong);
  text-underline-offset: 3px;
}

.welcome-link:hover {
  color: var(--ink-strong);
  text-decoration-color: var(--accent);
}
</style>
