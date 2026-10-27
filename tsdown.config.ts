import { defineConfig } from 'tsdown'

export default defineConfig({
  dts: true,
  entry: ['src/*.ts'],
  exports: false,
  fixedExtension: false,
  format: 'esm',
  outDir: 'dist',
  platform: 'node',
  target: 'node24',
  tsconfig: 'tsconfig.build.json',
  unbundle: true,
})
