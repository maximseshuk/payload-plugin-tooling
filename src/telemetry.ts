import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { Payload } from 'payload'

export type TelemetryOption = boolean | { endpoint?: string }

export type ProjectIdSource = 'cwd' | 'git' | 'packageJSON' | 'serverURL'

export type TelemetryReport = {
  features: Record<string, boolean>
  os: string
  payloadVersion: string
  product: string
  productVersion: string
  projectId: string
  projectIdSource: ProjectIdSource
  runtime: 'node'
  runtimeVersion: string
  schema: number
}

export type TelemetryState = {
  lastSentDay?: string
  noticeShown?: boolean
}

export type ReportTelemetryOptions = {
  disableEnv: string
  docsUrl: string
  features: Record<string, boolean>
  option: TelemetryOption | undefined
  packageName: string
  payload: Payload
  product: string
}

export type ReportTelemetryDeps = {
  env?: Record<string, string | undefined>
  now?: Date
  readState?: (projectId: string) => TelemetryState
  send?: (report: TelemetryReport, endpoint: string) => Promise<void>
  writeState?: (projectId: string, state: TelemetryState) => void
}

const TELEMETRY_ENDPOINT = 'https://telemetry.seshuk.im/v1/collect'

const isTruthyEnv = (value: string | undefined): boolean =>
  value !== undefined && value !== '' && value !== '0' && value.toLowerCase() !== 'false'

export const isTelemetryDisabled = ({
  disableEnv,
  env,
  option,
  payloadTelemetry,
}: {
  disableEnv: string
  env: Record<string, string | undefined>
  option: TelemetryOption | undefined
  payloadTelemetry?: boolean
}): boolean => {
  if (payloadTelemetry === false || option === false) {
    return true
  }

  if (isTruthyEnv(env[disableEnv]) || isTruthyEnv(env.DO_NOT_TRACK) || isTruthyEnv(env.CI)) {
    return true
  }

  return env.NODE_ENV === 'test'
}

export const hashProjectId = (secret: string, rawSource: string): string =>
  createHash('sha256')
    .update(secret + rawSource)
    .digest('hex')

export const resolveRawSource = (candidates: {
  cwd: string
  git?: string
  packageJSON?: string
  serverURL?: string
}): { source: ProjectIdSource; value: string } => {
  if (candidates.git) {
    return { source: 'git', value: candidates.git }
  }

  if (candidates.packageJSON) {
    return { source: 'packageJSON', value: candidates.packageJSON }
  }

  if (candidates.serverURL) {
    return { source: 'serverURL', value: candidates.serverURL }
  }

  return { source: 'cwd', value: candidates.cwd }
}

const readGitRemote = (): string | undefined => {
  try {
    const url = execSync('git config --local --get remote.origin.url', {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 1000,
    })
      .toString()
      .trim()

    return url || undefined
  } catch {
    return undefined
  }
}

const readJson = (file: string): { name?: unknown; version?: unknown } | undefined => {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as { name?: unknown; version?: unknown }
  } catch {
    return undefined
  }
}

const readAppPackageName = (cwd: string): string | undefined => {
  const name = readJson(join(cwd, 'package.json'))?.name
  return typeof name === 'string' && name ? name : undefined
}

export const deriveProjectId = ({
  cwd = process.cwd(),
  git,
  packageJSON,
  secret,
  serverURL,
}: {
  cwd?: string
  git?: string
  packageJSON?: string
  secret: string
  serverURL?: string
}): { projectId: string; projectIdSource: ProjectIdSource } => {
  const raw = resolveRawSource({
    cwd,
    git: git ?? readGitRemote(),
    packageJSON: packageJSON ?? readAppPackageName(cwd),
    serverURL,
  })

  return { projectId: hashProjectId(secret, raw.value), projectIdSource: raw.source }
}

export const utcDay = (now: Date = new Date()): string => now.toISOString().slice(0, 10)

const stateFile = (product: string, projectId: string): string =>
  join(tmpdir(), `${product}-telemetry-${projectId}.json`)

export const readState = (product: string, projectId: string): TelemetryState => {
  try {
    return JSON.parse(readFileSync(stateFile(product, projectId), 'utf8')) as TelemetryState
  } catch {
    return {}
  }
}

export const writeState = (product: string, projectId: string, state: TelemetryState): void => {
  try {
    writeFileSync(stateFile(product, projectId), JSON.stringify(state))
  } catch {}
}

const findPackageVersion = (name: string, from: string): string | undefined => {
  let dir = from
  while (true) {
    const pkg = readJson(join(dir, 'package.json'))
    if (pkg?.name === name && typeof pkg.version === 'string' && pkg.version) {
      return pkg.version
    }
    const parent = dirname(dir)
    if (parent === dir) {
      return undefined
    }
    dir = parent
  }
}

export const readPackageVersion = (
  packageName: string,
  from: string = dirname(fileURLToPath(import.meta.url)),
): string => findPackageVersion(packageName, from) ?? '0.0.0'

export const readPayloadVersion = (): string => {
  try {
    return findPackageVersion('payload', dirname(createRequire(import.meta.url).resolve('payload'))) ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export const buildReport = ({
  features,
  payloadVersion,
  product,
  productVersion,
  projectId,
  projectIdSource,
}: {
  features: Record<string, boolean>
  payloadVersion: string
  product: string
  productVersion: string
  projectId: string
  projectIdSource: ProjectIdSource
}): TelemetryReport => ({
  features,
  os: process.platform.toLowerCase().slice(0, 16),
  payloadVersion,
  product,
  productVersion,
  projectId,
  projectIdSource,
  runtime: 'node',
  runtimeVersion: process.versions.node.split('.')[0],
  schema: 1,
})

export const postReport = async (report: TelemetryReport, endpoint: string): Promise<void> => {
  try {
    await fetch(endpoint, {
      body: JSON.stringify(report),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      signal: AbortSignal.timeout(2000),
    })
  } catch {}
}

export const reportTelemetry = async (
  { disableEnv, docsUrl, features, option, packageName, payload, product }: ReportTelemetryOptions,
  deps: ReportTelemetryDeps = {},
): Promise<void> => {
  const env = deps.env ?? process.env
  const readStateImpl = deps.readState ?? ((projectId: string) => readState(product, projectId))
  const writeStateImpl =
    deps.writeState ?? ((projectId: string, state: TelemetryState) => writeState(product, projectId, state))
  const send = deps.send ?? postReport

  try {
    if (isTelemetryDisabled({ disableEnv, env, option, payloadTelemetry: payload.config.telemetry })) {
      return
    }

    const { projectId, projectIdSource } = deriveProjectId({
      secret: payload.secret,
      serverURL: payload.config.serverURL,
    })

    const state = readStateImpl(projectId)
    const today = utcDay(deps.now)

    if (!state.noticeShown) {
      payload.logger.info(
        `[${product}] Anonymous usage telemetry is on: plugin, Payload and Node versions and the features you use. It never sends secrets, IPs, keys or names. Opt out with telemetry: false, DO_NOT_TRACK=1 or ${disableEnv}=1. What is sent: ${docsUrl}`,
      )
    }

    if (state.lastSentDay === today) {
      if (!state.noticeShown) {
        writeStateImpl(projectId, { ...state, noticeShown: true })
      }
      return
    }

    const report = buildReport({
      features,
      payloadVersion: readPayloadVersion(),
      product,
      productVersion: readPackageVersion(packageName),
      projectId,
      projectIdSource,
    })

    writeStateImpl(projectId, { lastSentDay: today, noticeShown: true })

    await send(report, typeof option === 'object' && option.endpoint ? option.endpoint : TELEMETRY_ENDPOINT)
  } catch {}
}
