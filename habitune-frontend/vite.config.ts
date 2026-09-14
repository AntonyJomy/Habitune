import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // API clients require a base URL even when fetch is mocked by unit tests.
    setupFiles: ['./src/test/setup.ts'],
  },
})
