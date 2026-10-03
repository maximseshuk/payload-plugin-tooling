import { afterEach, describe, expect, it, vi } from 'vitest'

import { testDatabase } from '../src/testDatabase.ts'
import { pluginBuild } from '../src/tsdown.ts'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('testDatabase', () => {
  it('returns the SQLite adapter by default', async () => {
    vi.stubEnv('TEST_DB', undefined)
    expect((await testDatabase()).name).toBe('sqlite')
  })

  it('returns the Postgres adapter on PGlite', async () => {
    vi.stubEnv('TEST_DB', 'postgres')
    expect((await testDatabase()).name).toBe('postgres')
  })

  it('throws when TEST_DB is unknown', async () => {
    vi.stubEnv('TEST_DB', 'mysql')
    await expect(testDatabase()).rejects.toThrow('Unknown TEST_DB "mysql"')
  })
})

describe('pluginBuild', () => {
  it('copies CSS and the extra globs without flattening', () => {
    expect(pluginBuild({ copy: ['src/**/*.edge.js'] }).copy).toEqual([
      { flatten: false, from: 'src/**/*.css', to: 'dist' },
      { flatten: false, from: 'src/**/*.edge.js', to: 'dist' },
    ])
  })

  it('keeps every bare import external and bundles relative and alias imports', () => {
    const neverBundle = pluginBuild().deps?.neverBundle as (id: string) => boolean
    expect(['payload', '@payloadcms/ui', 'node:fs', './styles.css'].map(neverBundle)).toEqual([true, true, true, true])
    expect(['./index.js', '@/shared/http.js'].map(neverBundle)).toEqual([false, false])
  })
})
