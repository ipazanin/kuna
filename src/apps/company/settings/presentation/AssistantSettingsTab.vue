<script setup lang="ts">
import AppAssistCard from '../../../../shared/ai/presentation/AppAssistCard.vue'
import { COMPANY_APP } from '../../workbook/domain/companyApp'
import { words as companyWords } from '../../words'
</script>

<template>
  <AppAssistCard :app="COMPANY_APP" :app-name="companyWords.name" />
</template>
