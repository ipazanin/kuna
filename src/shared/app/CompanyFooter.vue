<script setup lang="ts">
import { companyFooter, words } from './words'

const privacyPage = `${import.meta.env.BASE_URL}privacy.html`
</script>

<template>
  <footer class="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-default pt-4 type-caption print:hidden" data-testid="company-footer">
    <span class="flex items-center gap-2">
      <span class="company-logo shrink-0" aria-hidden="true" data-testid="company-logo"></span>
      <span>{{ companyFooter.name }}</span>
    </span>
    <a :href="`mailto:${companyFooter.email}`" class="quiet-link">{{ companyFooter.email }}</a>
    <a :href="privacyPage" class="quiet-link">{{ words.privacy }}</a>
  </footer>
</template>
