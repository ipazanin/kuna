import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    setupFiles: ['tests/setup/installPack.ts'],
    // Node 25 and later define a global localStorage, and vitest 4's jsdom environment
    // then keeps Node's instead of installing jsdom's.
    execArgv: ['--no-experimental-webstorage'],
    // The specs that walk the whole source tree take seconds on a busy machine, which the 5 s default fails for no fault of the code.
    testTimeout: 30_000,
  },
})
