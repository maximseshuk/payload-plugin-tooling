import type { UserConfig } from 'tsdown'

export type PluginBuildOptions = {
  copy?: string[]
}

export const pluginBuild = ({ copy = [] }: PluginBuildOptions = {}): UserConfig => ({
  copy: ['src/**/*.css', ...copy].map((from) => ({ flatten: false, from, to: 'dist' })),
  deps: { neverBundle: (id) => id.endsWith('.css') || /^(?![./]|@\/|\0)/.test(id) },
  dts: true,
  entry: ['src/**/*.ts', 'src/**/*.tsx'],
  exports: false,
  fixedExtension: false,
  format: 'esm',
  hash: false,
  outDir: 'dist',
  platform: 'node',
  sourcemap: true,
  target: 'esnext',
  tsconfig: './tsconfig.build.json',
  unbundle: true,
})
