import { resolve } from 'node:path'

import type { ViteUserConfig } from 'vitest/config'

export const vitestBase: {
  resolve: {
    alias: {
      find: RegExp
      replacement: string
    }[]
  }
} = {
  resolve: {
    alias: [{ find: /^@\//, replacement: `${resolve('src')}/` }],
  },
} satisfies ViteUserConfig
