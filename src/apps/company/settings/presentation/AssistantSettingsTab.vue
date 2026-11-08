<script setup lang="ts">
import AppAssistCard from '../../../../shared/ai/presentation/AppAssistCard.vue'
import { COMPANY_APP } from '../../workbook/domain/companyApp'
import { words as companyWords } from '../../words'
import { COMPANY_ASSIST } from './companyAssist'
</script>

<template>
  <AppAssistCard :app="COMPANY_APP" :tasks="COMPANY_ASSIST.tasks()" :chat-reads="companyWords.name" />
</template>
