import { resolve } from 'node:path'

import type { ViteUserConfig } from 'vitest/config'

export const vitestBase = {
  resolve: {
    alias: [{ find: /^@\//, replacement: `${resolve('src')}/` }],
  },
} satisfies ViteUserConfig
