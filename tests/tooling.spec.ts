import { resolve } from 'node:path'

import type { Rolldown } from 'tsdown'
import { describe, expect, it } from 'vitest'

import { pluginBuild } from '@/tsdown.ts'
import { vitestBase } from '@/vitest.ts'

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
    expect(['./index.js', '@/shared/http.js', '@/client/Panel/Panel.css'].map(neverBundle)).toEqual([
      false,
      false,
      false,
    ])
  })

  it('keeps an aliased CSS import external, relative to the importer', () => {
    const [plugin] = pluginBuild().plugins as unknown as [{ resolveId: (id: string, importer?: string) => unknown }]
    const importer = resolve('src/client/Fields.tsx')
    expect(plugin.resolveId('@/client/Panel/Panel.css', importer)).toEqual({
      external: true,
      id: './Panel/Panel.css',
    })
    expect(plugin.resolveId('@/rsc/Widget.css', importer)).toEqual({ external: true, id: '../rsc/Widget.css' })
    expect(plugin.resolveId('@/client/Panel/Panel.js', importer)).toBeNull()
    expect(plugin.resolveId('./Panel.css', importer)).toBeNull()
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

describe('vitestBase', () => {
  it('maps @/ to src/ and leaves scoped packages alone', () => {
    const [{ find, replacement }] = vitestBase.resolve.alias
    expect(replacement).toBe(`${resolve('src')}/`)
    expect(['@/shared/http.js', '@payloadcms/ui', '@seshuk/x'].map((id) => find.test(id))).toEqual([true, false, false])
  })
})
