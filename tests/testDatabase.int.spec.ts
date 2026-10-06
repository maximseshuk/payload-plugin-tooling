import { afterEach, describe, expect, it, vi } from 'vitest'

import { testDatabase } from '@/testDatabase.ts'

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
