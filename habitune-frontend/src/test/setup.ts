import { vi } from 'vitest'

// Keep unit tests independent from developer and deployment environment files.
vi.stubEnv('VITE_API_BASE_URL', 'https://example.test/dev')
