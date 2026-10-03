import type { Rolldown } from 'tsdown'
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

  it('bundles the tooling package and its subpaths', () => {
    const neverBundle = pluginBuild().deps?.neverBundle as (id: string) => boolean
    expect(
      [
        '@seshuk/payload-plugin-tooling',
        '@seshuk/payload-plugin-tooling/telemetry',
        '@seshuk/payload-plugin-tooling-extra',
      ].map(neverBundle),
    ).toEqual([false, false, true])
    expect(pluginBuild().deps?.onlyBundle).toEqual(['@seshuk/payload-plugin-tooling'])
  })

  it('writes bundled tooling modules to dist/_tooling and keeps the default name for the rest', () => {
    const outputOptions = pluginBuild().outputOptions as (options: Rolldown.OutputOptions) => Rolldown.OutputOptions
    const toolingName =
      'node_modules/.pnpm/@seshuk+payload-plugin-tooling@0.1.0/node_modules/@seshuk/payload-plugin-tooling/dist/telemetry'
    const fileName = (options: Rolldown.OutputOptions, name: string): string =>
      (outputOptions(options).entryFileNames as (chunk: Rolldown.PreRenderedChunk) => string)({
        name,
      } as Rolldown.PreRenderedChunk)

    expect(fileName({}, toolingName)).toBe('_tooling/telemetry.js')
    expect(fileName({}, `${toolingName}.d`)).toBe('_tooling/telemetry.d.js')
    expect(fileName({ entryFileNames: '[name].mjs' }, toolingName)).toBe('_tooling/telemetry.mjs')
    expect(fileName({ entryFileNames: '[name].mjs' }, 'server/index')).toBe('[name].mjs')
    expect(fileName({ entryFileNames: () => '[name].cjs' }, 'index')).toBe('[name].cjs')
    expect(outputOptions({ entryFileNames: '[name].js', sourcemap: true }).sourcemap).toBe(true)
  })
})
