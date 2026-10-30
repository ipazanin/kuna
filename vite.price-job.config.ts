import { defineConfig } from 'vite'

// The daily price job as one script for Apps Script, which loads every file of a project into one global scope, so the
// IIFE's global is what price-job/Triggers.js calls. ES2019 keeps the syntax within what Apps Script's V8 runtime documents.
export default defineConfig({
  publicDir: false,
  build: {
    lib: {
      entry: 'src/apps/investments/prices/job/priceJob.ts',
      formats: ['iife'],
      name: 'KunaPriceJob',
      fileName: () => 'PriceJob.js',
    },
    outDir: 'price-job/build',
    emptyOutDir: true,
    minify: false,
    target: 'es2019',
  },
})
