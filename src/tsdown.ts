import { dirname, relative, resolve } from 'node:path'

import type { Rolldown, UserConfig } from 'tsdown'

export type PluginBuildOptions = {
  copy?: string[]
}

const aliasedCss: Rolldown.Plugin = {
  name: 'aliased-css',
  resolveId: (id, importer) => {
    if (!importer || !id.startsWith('@/') || !id.endsWith('.css')) return null
    const path = relative(dirname(importer), resolve('src', id.slice(2)))
    return { external: true, id: path.startsWith('.') ? path : `./${path}` }
  },
}

export const pluginBuild = ({ copy = [] }: PluginBuildOptions = {}): UserConfig => ({
  copy: ['src/**/*.css', ...copy].map((from) => ({ flatten: false, from, to: 'dist' })),
  deps: {
    neverBundle: (id) =>
      !id.startsWith('@/') && (id.endsWith('.css') || /^(?![./]|\0|@seshuk\/payload-plugin-tooling(?:\/|$))/.test(id)),
    onlyBundle: ['@seshuk/payload-plugin-tooling'],
  },
  dts: true,
  entry: ['src/**/*.ts', 'src/**/*.tsx'],
  exports: false,
  fixedExtension: false,
  format: 'esm',
  hash: false,
  outDir: 'dist',
  outputOptions: ({ entryFileNames = '[name].js', ...options }) => ({
    ...options,
    entryFileNames: (chunk) => {
      const fileName = typeof entryFileNames === 'function' ? entryFileNames(chunk) : entryFileNames
      return chunk.name.includes('node_modules/')
        ? fileName.replace('[name]', `_tooling/${chunk.name.slice(chunk.name.lastIndexOf('/') + 1)}`)
        : fileName
    },
  }),
  platform: 'node',
  plugins: [aliasedCss],
  sourcemap: true,
  target: 'esnext',
  tsconfig: './tsconfig.build.json',
  unbundle: true,
})
