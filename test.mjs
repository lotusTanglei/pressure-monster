import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import * as plugin from './index.js'

const require = createRequire(import.meta.url)
const fromDsh = id => require(require.resolve(id, { paths: [process.env.DSH_INSTALL_DIR] }))
const { resolveConfig } = fromDsh('@deepseek-ai/cordis')
const { updateVolatile } = fromDsh('@deepseek-ai/cosmokit')
const config = resolveConfig(plugin, { enabled: true, level: 3, text: plugin.LEVEL_TEXT[3] })
assert.equal(config.level.get(), 3)
assert.equal(plugin.Config.dict.level.meta.volatile, true)
assert.equal(plugin.Config.dict.enabled.meta.volatile, true)
assert.throws(() => resolveConfig(plugin, { enabled: true, level: 6 }))
let hook
plugin.apply({ on(event, fn) { assert.equal(event, 'agent/pre-step'); hook = fn } }, config)
const user = { id: 'user', role: 'user', source: { kind: 'user' }, content: [] }
const base = { kind: 'enter', messages: [user], startsRequestSeries: true }
const payload = { messages: [user], signal: { aborted: false } }
const enter = () => hook(payload, async () => base)
const set = (field, value) => {
  const next = resolveConfig(plugin, { enabled: true, level: 3, [field]: value })
  updateVolatile(config[field], next[field])
}
const texts = new Set()
for (let level = 1; level <= 5; level++) {
  set('level', level)
  const decision = await enter()
  assert.equal(decision.messages[0].content[0].text, plugin.LEVEL_TEXT[level])
  assert.equal(decision.messages[1], user)
  assert.equal(decision.startsRequestSeries, true)
  texts.add(decision.messages[0].content[0].text)
}
assert.equal(texts.size, 5, 'levels must produce five distinct prompts even with legacy text')
set('level', 0)
assert.equal(await enter(), base)
set('level', 3)
assert.equal((await enter()).messages.length, 2, 'turning back on must not require a plugin remount')
set('enabled', false)
assert.equal(await enter(), base)
set('enabled', true)
assert.equal(await hook({ ...payload, messages: [] }, async () => base), base)
assert.equal(await hook({ ...payload, signal: { aborted: true } }, async () => base), base)
const reject = { kind: 'reject' }
assert.equal(await hook(payload, async () => reject), reject)
const existing = { ...base, messages: [{ source: { kind: 'pressure-check' } }, user] }
assert.equal(await hook(payload, async () => existing), existing)
// Every level has its own four-item cycle, including legacy text compatibility.
assert.equal(plugin.PROMPT_POOLS[0].length, 0)
const mounted = options => {
  const state = resolveConfig(plugin, { enabled: true, level: 3, ...options })
  let run
  plugin.apply({ on(event, fn) { assert.equal(event, 'agent/pre-step'); run = fn } }, state)
  const update = (key, value) => {
    const next = resolveConfig(plugin, { enabled: true, level: 3, [key]: value })
    updateVolatile(state[key], next[key])
  }
  return { run, update, enter: () => run(payload, async () => base) }
}
const promptText = decision => decision.messages[0].content[0].text
for (let level = 1; level <= 5; level++) {
  const pool = plugin.PROMPT_POOLS[level]
  assert.equal(pool.length, 4)
  assert.equal(new Set(pool).size, 4)
  assert.equal(Object.isFrozen(pool), true)
  assert.equal(pool[0], plugin.LEVEL_TEXT[level], 'first item must preserve the original prompt')
  const instance = mounted({ level, text: plugin.LEVEL_TEXT[3] })
  for (let i = 0; i < 8; i++) {
    const decision = await instance.enter()
    assert.equal(promptText(decision), pool[i % 4])
    assert.equal(decision.messages[1], user)
    assert.equal(decision.startsRequestSeries, true)
  }
}
assert.equal(new Set(Object.values(plugin.PROMPT_POOLS).flat()).size, 20)
const cycle = mounted()
assert.equal(promptText(await cycle.enter()), plugin.PROMPT_POOLS[3][0])
assert.equal(await cycle.run({ ...payload, messages: [] }, async () => base), base)
assert.equal(await cycle.run({ ...payload, signal: { aborted: true } }, async () => base), base)
assert.equal(await cycle.run(payload, async () => reject), reject)
for (const kind of ['skip', 'abort']) {
  const decision = { kind }
  assert.equal(await cycle.run(payload, async () => decision), decision)
}
const missingMessages = { kind: 'enter' }
assert.equal(await cycle.run(payload, async () => missingMessages), missingMessages)
assert.equal(await cycle.run(payload, async () => existing), existing)
cycle.update('level', 0)
assert.equal(await cycle.enter(), base)
cycle.update('level', 3)
cycle.update('enabled', false)
assert.equal(await cycle.enter(), base)
cycle.update('enabled', true)
assert.equal(promptText(await cycle.enter()), plugin.PROMPT_POOLS[3][1], 'skips must not advance the cycle')
cycle.update('text', 'Use my exact custom checklist.')
assert.equal(promptText(await cycle.enter()), 'Use my exact custom checklist.')
assert.equal(promptText(await cycle.enter()), 'Use my exact custom checklist.')
cycle.update('text', '')
assert.equal(promptText(await cycle.enter()), plugin.PROMPT_POOLS[3][2], 'custom text must not consume a pool slot')
cycle.update('level', 1)
assert.equal(promptText(await cycle.enter()), plugin.PROMPT_POOLS[1][0])
cycle.update('level', 3)
assert.equal(promptText(await cycle.enter()), plugin.PROMPT_POOLS[3][3], 'each level keeps its own position')
assert.equal(promptText(await mounted().enter()), plugin.PROMPT_POOLS[3][0], 'reload starts a fresh cycle')
const concurrent = mounted()
const decisions = await Promise.all(Array.from({ length: 8 }, () => concurrent.enter()))
const actualCounts = new Map()
for (const decision of decisions) actualCounts.set(promptText(decision), (actualCounts.get(promptText(decision)) ?? 0) + 1)
assert.equal(actualCounts.size, 4)
for (const count of actualCounts.values()) assert.equal(count, 2, 'concurrent requests must not lose cursor increments')
console.log('PASS: Host config, 20 prompts, per-level rotation, custom/legacy text, skips, concurrency and reload')

// Isolate the client controller and slot contracts; no React/DOM rendering is simulated.
let bundle
vm.runInNewContext(await readFile(new URL('./client.js', import.meta.url), 'utf8'), {
  window: { __ModuleLoader__: { load(value) { bundle = value } } },
})
const registrations = []
let accepted = { ns: 'pressure-check', revision: 1, value: { enabled: true, level: 3 } }
let refuse = false
let failTransport = false
let calls = 0
let namespaceReady = false
const remoteEvents = new Map()
const flushReads = async () => { for (let i = 0; i < 4; i++) await Promise.resolve() }
const ctx = {
  locale: { register() { return () => {} }, bind() { return key => key } },
  effect(fn) { fn() }, on() {},
  slots: {
    inject(slot, fn) { fn() },
    register(options, component, ...rest) {
      assert.equal(rest.length, 0, 'do not pass injected props in register third argument')
      registrations.push({ options, component })
    },
  },
  remote: {
    $on(event, fn) { remoteEvents.set(event, fn); return () => remoteEvents.delete(event) },
    settings: {
      async describe() { return { ok: true, value: { namespaces: namespaceReady ? [accepted] : [] } } },
      async mutate(ns, ops, revision) {
        calls++
        if (failTransport) throw new Error('network unavailable')
        if (refuse) return { ok: false, error: { message: 'revision conflict' } }
        assert.equal(ns, 'pressure-check'); assert.equal(revision, accepted.revision)
        const value = { ...accepted.value }
        for (const op of ops) value[op.path[0]] = op.value
        accepted = { ...accepted, revision: revision + 1, value }
        return { ok: true, value: accepted }
      },
    },
  },
}
const client = bundle.factory(id => { assert.equal(id, 'react'); return {} })
client.apply(ctx)
await flushReads()
const panel = registrations.find(r => r.options.name === 'main')
assert.equal(panel.options.key, 'pressure-check')
assert.equal(typeof panel.options.inject, 'function')
const face = panel.options.inject()
assert.equal(face.hooks.pressure.getSnapshot().status, 'error', 'startup before Host registration must be recoverable')
namespaceReady = true
remoteEvents.get('plugin-manager/changed')()
await flushReads()
assert.equal(face.hooks.pressure.getSnapshot().status, 'ready', 'Host availability change must refresh missing namespace')
assert.equal(panel.options.inject().onRetry, face.onRetry, 'panel refresh action must be stable across renders')
await face.onRetry()
assert.equal(typeof face.hooks.pressure.subscribe, 'function')
assert.equal(face.hooks.pressure.getSnapshot().level, 3)
assert.equal(typeof face.onSave, 'function')
const firstSave = await face.onSave(5)
assert.equal(firstSave, true, face.hooks.pressure.getSnapshot().error)
assert.equal(face.hooks.pressure.getSnapshot().level, 5)
assert.equal(face.hooks.pressure.getSnapshot().saved, true)
assert.equal(await face.onSave(0), true)
assert.equal(face.hooks.pressure.getSnapshot().level, 0)
assert.equal(accepted.value.enabled, false)
refuse = true
assert.equal(await face.onSave(4), false)
assert.equal(face.hooks.pressure.getSnapshot().error, 'revision conflict')
assert.equal(face.hooks.pressure.getSnapshot().level, 0)
refuse = false; failTransport = true
assert.equal(await face.onSave(2), false)
assert.equal(face.hooks.pressure.getSnapshot().error, 'network unavailable')
assert.equal(face.hooks.pressure.getSnapshot().status, 'error')
failTransport = false
assert.equal(await face.onSave(2), true)
assert.equal(face.hooks.pressure.getSnapshot().level, 2)
assert.equal(registrations.some(r => r.options.name === 'sidebar.panellist'), true)
const before = calls
face.hooks.pressure.dispose()
assert.equal(await face.onSave(4), false)
assert.equal(calls, before)
console.log('PASS: Client slot injection, save/readback, off, error retention, retry, disposed controller')
