import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { LEVEL_TEXT, PROMPT_POOLS } from './prompts.js'

// Resolve DSH's bundled schema runtime from the running installation. A local
// linked bundle does not inherit profile node_modules peer links automatically.
const require = createRequire(import.meta.url)
const schemaModule = require(require.resolve('@deepseek-ai/schemastery', {
  paths: [process.env.DSH_INSTALL_DIR, process.cwd()].filter(Boolean),
}))
const z = schemaModule.default ?? schemaModule

/** Stable loader row name. */
export const name = 'pressure-check'
export const inject = ['settings']

const DEFAULT_TEXT = LEVEL_TEXT[3]

/** Config schema consumed by the Host settings/config editor. */
export const Config = z.object({
  enabled: z.boolean().default(false).volatile(),
  onlyUserRequests: z.boolean().default(true).volatile(),
  level: z.number().step(1).min(0).max(5).default(3).volatile(),
  text: z.string().default('').volatile(),
})

function createPressureMessage(text) {
  return Object.freeze({
    id: randomUUID(),
    role: 'user',
    content: Object.freeze([{ type: 'text', text }]),
    source: Object.freeze({ kind: 'pressure-check' }),
  })
}

/** Add a model-visible self-check before an admitted user request. */
const live = value => value && typeof value.get === 'function' ? value.get() : value

export function apply(ctx, config = {}) {
  // Announce the configuration surface when this plugin is mounted/unmounted.
  // Otherwise an early browser describe can retain a missing namespace indefinitely.
  if (ctx.settings) ctx.effect(() => ctx.settings.configure({ auto: true }), 'pressure-check: settings availability')
  // Profile-wide, per-level round-robin. Off/skipped/custom-text requests do not consume a slot.
  // Cursors are deliberately in memory only; plugin reload/restart begins at the first wording.
  const cursors = new Map()
  // Keep this listener mounted at level 0 so a live settings edit can re-enable it.
  ctx.on('agent/pre-step', async ({ messages, signal }, next) => {
    const hasUserRequest = messages.some(message => message.source?.kind === 'user')
    const decision = await next()
    if (decision.kind !== 'enter' || signal.aborted || !Array.isArray(decision.messages)) return decision
    const level = Math.max(0, Math.min(5, Math.round(Number(live(config.level) ?? 3))))
    if (live(config.enabled) !== true || !Number.isFinite(level) || level === 0) return decision
    if (live(config.onlyUserRequests) !== false && !hasUserRequest) return decision
    if (decision.messages.some(message => message.source?.kind === 'pressure-check')) return decision
    const override = live(config.text)
    // Preserve genuine custom text. The old built-in default must not pin all levels to 3.
    let text
    if (typeof override === 'string' && override.trim() && override !== DEFAULT_TEXT) {
      text = override
    } else {
      const pool = PROMPT_POOLS[level]
      const cursor = cursors.get(level) ?? 0
      text = pool[cursor]
      cursors.set(level, (cursor + 1) % pool.length)
    }
    return { ...decision, messages: [createPressureMessage(text), ...decision.messages] }
  }, { prepend: true })
}

export { LEVEL_TEXT, PROMPT_POOLS }
