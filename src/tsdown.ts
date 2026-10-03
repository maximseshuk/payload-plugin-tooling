import type { UserConfig } from 'tsdown'

export type PluginBuildOptions = {
  copy?: string[]
}

export const pluginBuild = ({ copy = [] }: PluginBuildOptions = {}): UserConfig => ({
  copy: ['src/**/*.css', ...copy].map((from) => ({ flatten: false, from, to: 'dist' })),
  deps: {
    neverBundle: (id) => id.endsWith('.css') || /^(?![./]|@\/|\0|@seshuk\/payload-plugin-tooling(?:\/|$))/.test(id),
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
  sourcemap: true,
  target: 'esnext',
  tsconfig: './tsconfig.build.json',
  unbundle: true,
})
