import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    setupFiles: ['tests/setup/installPack.ts'],
    // Node 25 and later define a global localStorage, and vitest 4's jsdom environment
    // then keeps Node's instead of installing jsdom's.
    execArgv: ['--no-experimental-webstorage'],
  },
})
