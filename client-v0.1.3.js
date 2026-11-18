// Pressure monster client build 0.1.3
window.__ModuleLoader__.load({
  id: 'dsh-pressure-check',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useState, useId } = React
    const NS = 'pressureCheck'
    const dictionaries = {
      zh: {
        title: '压力怪', description: '一个专门给第一反应挑刺的小搭档。让答案出门前，再过一道关。',
        eyebrow: 'YOUR SECOND THOUGHT', lab: '自检实验室', preview: '正在预览', active: '当前生效', notLoaded: '等待配置', lastKnown: '上次确认', previewOnly: '尚未读到配置，下面仅为外观预览。',
        choose: '给它一点压力', chooseHint: '拖动滑条，或直接点选一只压力怪。选择后记得保存。',
        monster0: '休眠怪', monster1: '探头怪', monster2: '好奇怪', monster3: '挑刺怪', monster4: '较真怪', monster5: '反证怪',
        speech0: '这次我先休息，你来发挥。', speech1: '等等，前提看清楚了吗？', speech2: '换个角度，会不会不一样？',
        speech3: '先别急。最强的反驳是什么？', speech4: '这个答案，经得起多面审查吗？', speech5: '现在，试着推翻你自己的答案。',
        skill1: '查前提', skill2: '找歧义', skill3: '寻反例', skill4: '提反驳', skill5: '试证伪',
        footerTitle: '认真一点，不是难受一点', footerHint: '压力怪只是提示级自检，不代表模型具有感受。适用于 DSH 内的模型，不作用于独立 Codex CLI。',
        level: '压力程度', off: '关闭', light: '轻度', medium: '中度', strong: '较强', strict: '严格', maximum: '极强',
        hint0: '不再为新的请求添加检查提示。已进入对话历史的提示不会被删除。',
        hint1: '检查主要前提和明显错误。', hint2: '检查前提、歧义和常见反例。',
        hint3: '在此基础上检验最强反驳。', hint4: '对初步判断进行多角度自我批评。',
        hint5: '进行更严格的对抗审查，尝试证伪初步判断。',
        note: '这些档位控制提示词，不改变模型的推理强度设置。越强不一定越准确，也可能增加耗时和 token。',
        loading: '正在读取配置…', saving: '正在保存…', saved: '已保存，新请求将使用此档位。',
        pending: '尚未保存', save: '保存并生效', discard: '撤销更改', retry: '重新读取配置',
        readError: '无法读取压力怪配置', missing: '暂未读到压力怪配置，请点击「重新读取配置」。',
        writeError: '保存失败，原配置保持不变。',
      },
      en: {
        title: 'Pressure monster', description: 'A little partner that questions your first instinct. One more check before the answer goes out.',
        eyebrow: 'YOUR SECOND THOUGHT', lab: 'Self-check lab', preview: 'Previewing', active: 'Active', notLoaded: 'Awaiting configuration', lastKnown: 'Last confirmed', previewOnly: 'Configuration has not loaded. The character below is a visual preview only.',
        choose: 'Turn up the scrutiny', chooseHint: 'Move the slider or pick a monster. Save to apply your choice.',
        monster0: 'Sleepy', monster1: 'Scout', monster2: 'Curious', monster3: 'Challenger', monster4: 'Inspector', monster5: 'Falsifier',
        speech0: 'I will sit this one out.', speech1: 'Wait. Did you check the premise?', speech2: 'What if we look at it another way?',
        speech3: 'Not so fast. What is the strongest objection?', speech4: 'Does this answer survive a closer inspection?', speech5: 'Now try to prove your own answer wrong.',
        skill1: 'Premises', skill2: 'Ambiguity', skill3: 'Examples', skill4: 'Objections', skill5: 'Falsification',
        footerTitle: 'More thoughtful, not more miserable', footerHint: 'This is a self-check prompt, not evidence of model feelings. Works inside DSH, not with the standalone Codex CLI.',
        level: 'Check intensity', off: 'Off', light: 'Light', medium: 'Medium', strong: 'Strong', strict: 'Strict', maximum: 'Maximum',
        hint0: 'Stop adding checks to new requests. Prompts already in conversation history are not removed.',
        hint1: 'Check the main premise and obvious mistakes.', hint2: 'Check premises, ambiguity and likely counterexamples.',
        hint3: 'Also test the strongest objection.', hint4: 'Critique the initial judgment from several perspectives.',
        hint5: 'Try to falsify the initial judgment with a stricter adversarial review.',
        note: 'Levels change the prompt, not model reasoning effort. Stronger does not necessarily mean more accurate and may use more time and tokens.',
        loading: 'Loading configuration…', saving: 'Saving…', saved: 'Saved. New requests will use this level.',
        pending: 'Unsaved changes', save: 'Save and apply', discard: 'Discard changes', retry: 'Reload configuration',
        readError: 'Cannot read pressure-check configuration', missing: 'Pressure-check settings are not available yet. Reload configuration to retry.',
        writeError: 'Save failed. The previous configuration is unchanged.',
      },
    }
    const labels = ['off', 'light', 'medium', 'strong', 'strict', 'maximum']
    const clamp = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(5, Math.round(Number(value)))) : 3

    class PressureState {
      constructor(ctx) {
        this.ctx = ctx
        this.snapshot = { status: 'loading', level: 3, revision: undefined, error: '', saved: false }
        this.listeners = new Set()
        this.disposed = false
        this.generation = 0
      }
      getSnapshot = () => this.snapshot
      subscribe = listener => { this.listeners.add(listener); return () => this.listeners.delete(listener) }
      publish(next) {
        if (this.disposed) return
        this.snapshot = next
        for (const listener of this.listeners) listener()
      }
      accept(item, saved = false) {
        const value = item.value || {}
        this.publish({ status: 'ready', level: value.enabled === true ? clamp(value.level ?? 3) : 0, revision: item.revision, error: '', saved })
      }
      async load() {
        if (this.disposed || this.snapshot.status === 'saving') return
        const generation = ++this.generation
        this.publish({ ...this.snapshot, status: 'loading', error: '' })
        try {
          const result = await this.ctx.remote.settings.describe()
          if (this.disposed || generation !== this.generation) return
          if (!result.ok) throw new Error(result.error?.message || this.ctx.locale.bind(NS)('readError'))
          const item = result.value.namespaces.find(entry => entry.ns === 'pressure-check')
          if (!item) throw new Error(this.ctx.locale.bind(NS)('missing'))
          this.accept(item)
        } catch (error) {
          if (generation === this.generation) this.publish({ ...this.snapshot, status: 'error', error: String(error?.message || error), saved: false })
        }
      }
      async setLevel(level) {
        const current = this.snapshot
        if (this.disposed || current.revision === undefined || current.status === 'saving') return false
        ++this.generation
        level = clamp(level)
        this.publish({ ...current, status: 'saving', error: '', saved: false })
        try {
          const result = await this.ctx.remote.settings.mutate('pressure-check', [
            { op: 'set', path: ['level'], value: level },
            { op: 'set', path: ['enabled'], value: level > 0 },
            { op: 'set', path: ['text'], value: '' },
          ], current.revision)
          if (!result.ok) throw new Error(result.error?.message || this.ctx.locale.bind(NS)('writeError'))
          this.accept(result.value, true)
          return true
        } catch (error) {
          this.publish({ ...current, status: 'error', error: String(error?.message || error), saved: false })
          return false
        }
      }
      dispose() { this.disposed = true; ++this.generation; this.listeners.clear() }
    }

    function PressureIcon({ size = 20 }) {
      return h('svg', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
        h('path', { d: 'M5 10 4 4l5 3a10 10 0 0 1 6 0l5-3-1 6v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z' }),
        h('path', { d: 'M9 12v2m6-2v2m-5 3h4' }))
    }
    // Original SVG character. Geometry, not external assets or emoji, changes by level.
    function PressureMonster({ level, small = false }) {
      const asleep = level === 0
      const serious = level >= 3
      const eyes = asleep
        ? h('path', { d: 'M57 88h17m32 0h17', fill: 'none', stroke: 'currentColor', strokeWidth: 5, strokeLinecap: 'round' })
        : h('g', null,
          h('ellipse', { cx: 66, cy: 88, rx: 12, ry: level === 5 ? 10 : 15, fill: 'var(--dsw-alias-bg-base)' }),
          h('ellipse', { cx: 114, cy: 88, rx: 12, ry: level === 5 ? 10 : 15, fill: 'var(--dsw-alias-bg-base)' }),
          h('circle', { cx: serious ? 70 : 68, cy: 88, r: 5, fill: 'currentColor' }),
          h('circle', { cx: serious ? 110 : 112, cy: 88, r: 5, fill: 'currentColor' }))
      const mouth = ['M86 113h8', 'M79 111q11 12 22 0', 'M84 115q6-7 12 0', 'M81 113h18', 'M80 115q10-6 20 0', 'M78 112q12 16 24 0'][level]
      return h('svg', { viewBox: '0 0 180 170', className: small ? 'pressure-monster-small' : 'pressure-monster-art', 'aria-hidden': true },
        h('ellipse', { cx: 90, cy: 151, rx: 49, ry: 7, fill: 'currentColor', opacity: .09 }),
        h('g', { className: small ? undefined : 'pressure-monster-body' },
          h('path', { d: 'M44 66 39 25q21 4 31 22m40 0q10-18 31-22l-5 41', fill: 'var(--monster-tint)', stroke: 'currentColor', strokeWidth: 3, strokeLinejoin: 'round' }),
          h('path', { d: 'M33 89q-15 3-12 15t15 5m111-20q15 3 12 15t-15 5', fill: 'none', stroke: 'currentColor', strokeWidth: 7, strokeLinecap: 'round' }),
          h('path', { d: 'M58 133v12m64-12v12', stroke: 'currentColor', strokeWidth: 13, strokeLinecap: 'round' }),
          h('path', { d: 'M36 72q0-27 27-27h54q27 0 27 27v39q0 27-27 27H63q-27 0-27-27Z', fill: 'var(--monster-tint)', stroke: 'currentColor', strokeWidth: 3 }),
          eyes,
          serious ? h('path', { d: 'M53 66 77 73m26 0 24-7', fill: 'none', stroke: 'currentColor', strokeWidth: level === 5 ? 5 : 3, strokeLinecap: 'round' }) : null,
          h('path', { d: mouth, fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round' }),
          level >= 2 ? h('g', { fill: 'currentColor', opacity: .25 }, h('ellipse', { cx: 52, cy: 104, rx: 7, ry: 4 }), h('ellipse', { cx: 128, cy: 104, rx: 7, ry: 4 })) : null,
        ),
        !small && level > 0 ? h('path', { d: 'M151 22v14m-7-7h14M21 46v8m-4-4h8', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', opacity: .55 }) : null,
        !small && asleep ? h('path', { d: 'M146 35h10l-10 12h10m-4-28h7l-7 8h7', stroke: 'currentColor', fill: 'none', strokeWidth: 2, strokeLinecap: 'round', opacity: .55 }) : null)
    }
    const css = `
      .pressure-check-page { --monster-accent:var(--dsw-alias-state-business-primary); --monster-tint:color-mix(in srgb, var(--monster-accent) 14%, var(--dsw-alias-bg-layer-1)); box-sizing:border-box; width:100%; height:100%; overflow:auto; color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-base); }
      .pressure-check-page[data-level='0'] { --monster-accent:var(--dsw-alias-label-tertiary); }
      .pressure-check-page[data-level='1'] { --monster-accent:var(--dsw-alias-state-success-primary); }
      .pressure-check-page[data-level='4'] { --monster-accent:var(--dsw-alias-state-warn-primary); }
      .pressure-check-page[data-level='5'] { --monster-accent:var(--dsw-alias-state-error-primary); }
      .pressure-check-page * { box-sizing:border-box; }
      .pressure-check-content { max-width:980px; margin:auto; padding:calc(var(--dsh-frame-top-clearance, 0px) + 32px) 32px 40px; }
      .pressure-check-top { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:18px; }
      .pressure-check-brand { display:flex; align-items:center; gap:8px; font-size:13px; color:var(--dsw-alias-label-secondary); }
      .pressure-check-status { display:flex; align-items:center; gap:7px; padding:6px 10px; border:1px solid var(--dsw-alias-border-l3); border-radius:999px; color:var(--dsw-alias-label-secondary); font-size:12px; }
      .pressure-check-status-dot { width:6px; height:6px; border-radius:50%; background:var(--dsw-alias-state-success-primary); }
      .pressure-check-status-dot[data-off='true'] { background:var(--dsw-alias-label-tertiary); }
      .pressure-check-hero { position:relative; display:grid; grid-template-columns:minmax(0,1fr) 240px; align-items:center; gap:24px; padding:30px; border:1px solid var(--dsw-alias-border-l3); border-radius:20px; background:radial-gradient(ellipse at 100% 0%, color-mix(in srgb, var(--monster-accent) 8%, transparent), transparent 65%),var(--dsw-alias-bg-layer-1); }
      .pressure-check-eyebrow { margin:0 0 12px; color:var(--monster-accent); letter-spacing:.18em; font-size:10px; font-weight:700; }
      .pressure-check-hero h1 { font-size:34px; line-height:1.2; letter-spacing:-.04em; margin:0 0 12px; }
      .pressure-check-secondary { color:var(--dsw-alias-label-secondary); line-height:1.7; }
      .pressure-check-intro { max-width:360px; font-size:14px; margin:0; }
      .pressure-check-speech { display:inline-flex; margin:22px 0 0; padding:10px 13px; border:1px solid color-mix(in srgb,var(--monster-accent) 25%,var(--dsw-alias-border-l3)); border-left:3px solid var(--monster-accent); border-radius:4px 12px 12px 4px; color:var(--dsw-alias-label-primary); font-size:14px; line-height:1.6; background:color-mix(in srgb,var(--monster-accent) 5%,var(--dsw-alias-bg-layer-1)); }
      .pressure-check-stage { color:var(--monster-accent); position:relative; text-align:center; background-image:radial-gradient(circle,var(--dsw-alias-border-l3) 1px,transparent 1px); background-size:16px 16px; border-radius:50%; }
      .pressure-monster-art { width:205px; height:194px; display:block; margin:auto; overflow:visible; }
      .pressure-monster-body { transform-origin:50% 82%; animation:pressure-monster-breathe 4s ease-in-out infinite; }
      .pressure-check-page[data-level='0'] .pressure-monster-body { animation-duration:6s; }
      .pressure-check-stage-name { display:inline-block; margin-top:0; padding:4px 12px; border-radius:99px; background:var(--dsw-alias-bg-layer-1); color:var(--monster-accent); font-size:12px; font-weight:600; }
      .pressure-check-card { margin-top:20px; padding:26px; border:1px solid var(--dsw-alias-border-l3); border-radius:18px; background:var(--dsw-alias-bg-layer-1); }
      .pressure-check-control-heading { display:flex; gap:16px; justify-content:space-between; align-items:center; }
      .pressure-check-control-heading h2 { font-size:17px; margin:0 0 5px; }
      .pressure-check-control-heading p { font-size:12px; margin:0; }
      .pressure-check-level-number { display:flex; align-items:baseline; gap:3px; font-variant-numeric:tabular-nums; color:var(--monster-accent); }
      .pressure-check-level-number strong { font-size:32px; line-height:1; letter-spacing:-.07em; }
      .pressure-check-level-number span { color:var(--dsw-alias-label-tertiary); font-size:13px; }
      .pressure-check-range { display:block; width:100%; margin:24px 0 16px; accent-color:var(--monster-accent); cursor:pointer; }
      .pressure-check-ticks { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); gap:8px; }
      .pressure-check-pick { min-width:0; padding:10px 3px 12px; font:inherit; border:1px solid transparent; border-radius:12px; cursor:pointer; color:var(--dsw-alias-label-tertiary); background:transparent; transition:background .15s,border-color .15s,transform .15s; }
      .pressure-check-pick:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); transform:translateY(-2px); }
      .pressure-check-pick[aria-pressed='true'] { color:var(--monster-accent); border-color:color-mix(in srgb,var(--monster-accent) 45%,var(--dsw-alias-border-l3)); background:color-mix(in srgb,var(--monster-accent) 7%,transparent); }
      .pressure-monster-small { display:block; width:54px; height:51px; max-width:100%; margin:0 auto 7px; }
      .pressure-check-pick-label { font-size:12px; white-space:nowrap; }
      .pressure-check-pick:disabled { cursor:default; opacity:.5; }
      .pressure-check-detail { margin-top:22px; padding-top:18px; border-top:1px solid var(--dsw-alias-border-l3); }
      .pressure-check-detail-line { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
      .pressure-check-preview-tag { font-size:10px; text-transform:uppercase; letter-spacing:.06em; color:var(--dsw-alias-label-tertiary); padding:2px 6px; border-radius:4px; border:1px solid var(--dsw-alias-border-l3); }
      .pressure-check-preview { font-size:13px; margin:9px 0 14px; line-height:1.7; color:var(--dsw-alias-label-secondary); }
      .pressure-check-skills { display:flex; gap:6px; flex-wrap:wrap; }
      .pressure-check-skill { color:var(--dsw-alias-label-tertiary); font-size:11px; border-radius:6px; padding:4px 7px; border:1px dashed var(--dsw-alias-border-l3); }
      .pressure-check-skill[data-on='true'] { color:var(--monster-accent); border-style:solid; border-color:color-mix(in srgb,var(--monster-accent) 25%,var(--dsw-alias-border-l3)); background:color-mix(in srgb,var(--monster-accent) 5%,transparent); }
      .pressure-check-actions { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:14px; padding-top:22px; }
      .pressure-check-action-buttons { display:flex; gap:8px; flex-wrap:wrap; }
      .pressure-check-button { font:inherit; font-size:13px; cursor:pointer; padding:9px 15px; border-radius:9px; border:1px solid var(--dsw-alias-border-l3); color:var(--dsw-alias-label-primary); background:var(--dsw-alias-bg-layer-2); }
      .pressure-check-button:hover:not(:disabled) { background:var(--dsw-alias-interactive-bg-hover); }
      .pressure-check-button-primary { border-color:color-mix(in srgb,var(--monster-accent) 50%,var(--dsw-alias-border-l3)); background:color-mix(in srgb,var(--monster-accent) 13%,var(--dsw-alias-bg-layer-1)); color:var(--monster-accent); font-weight:600; }
      .pressure-check-button:disabled { cursor:default; opacity:.5; }
      .pressure-check-feedback { font-size:12px; }
      .pressure-check-range:focus-visible,.pressure-check-button:focus-visible,.pressure-check-pick:focus-visible { outline:2px solid var(--dsw-alias-state-business-primary); outline-offset:3px; }
      .pressure-check-error { color:var(--dsw-alias-state-error-primary); margin:16px 0; font-size:13px; overflow-wrap:anywhere; }
      .pressure-check-footer { padding:22px 4px 0; max-width:740px; }
      .pressure-check-footer strong { display:block; margin-bottom:6px; font-size:12px; color:var(--dsw-alias-label-secondary); }
      .pressure-check-footer p { margin:0 0 6px; font-size:11px; line-height:1.7; color:var(--dsw-alias-label-tertiary); }
      @keyframes pressure-monster-breathe { 0%,100% { transform:translateY(0) rotate(-1deg); } 50% { transform:translateY(-4px) rotate(1deg); } }
      @media(prefers-reduced-motion:reduce) { .pressure-monster-body { animation:none; } .pressure-check-pick { transition:none; } .pressure-check-pick:hover:not(:disabled) { transform:none; } }
      @media(max-width:640px) { .pressure-check-content { padding:calc(var(--dsh-frame-top-clearance,0px) + 20px) 20px 28px; } .pressure-check-hero { grid-template-columns:1fr 130px; gap:14px; padding:20px; } .pressure-check-hero h1 { font-size:28px; } .pressure-monster-art { width:125px; height:120px; } .pressure-check-intro { font-size:12px; } .pressure-check-speech { font-size:12px; margin-top:14px; } .pressure-check-card { padding:20px; } .pressure-check-ticks { grid-template-columns:repeat(3,minmax(0,1fr)); } .pressure-check-control-heading h2 { font-size:16px; } }
      @media(max-width:420px) { .pressure-check-hero { grid-template-columns:1fr; } .pressure-check-stage { grid-row:1; width:140px; margin:auto; } .pressure-check-hero-copy { text-align:center; } .pressure-check-intro { max-width:none; } }
    `
    function PressurePanel({ usePressure, onSave, onRetry, t }) {
      const state = usePressure(snapshot => snapshot)
      // The browser bundle may mount before the Host plugin has finished loading.
      // Re-read each time the panel opens, not only once during client activation.
      useEffect(() => { void onRetry() }, [onRetry])
      // Keep an explicit draft across remote updates; null follows accepted state.
      const [selection, setSelection] = useState(null)
      const draft = selection ?? state.level
      const setDraft = value => setSelection(value)
      const dirty = draft !== state.level
      const controlId = useId()
      const hintId = `${controlId}-hint`
      const unavailable = state.revision === undefined || state.status === 'saving' || state.status === 'loading'
      const unconfirmed = state.revision === undefined || state.status === 'error' || state.status === 'loading'
      return h('section', { className: 'pressure-check-page', 'data-level': draft, 'aria-busy': state.status === 'loading' || state.status === 'saving' },
        h('style', null, css),
        h('div', { className: 'pressure-check-content' },
          h('div', { className: 'pressure-check-top' },
            h('div', { className: 'pressure-check-brand' }, h(PressureIcon, { size: 18 }), t('lab')),
            h('div', { className: 'pressure-check-status' },
              h('span', { className: 'pressure-check-status-dot', 'data-off': state.level === 0 || unconfirmed, 'aria-hidden': true }),
              state.revision === undefined ? t('notLoaded') : `${t(unconfirmed ? 'lastKnown' : 'active')} · ${state.level} ${t(labels[state.level])}`)),
          h('header', { className: 'pressure-check-hero' },
            h('div', { className: 'pressure-check-hero-copy' },
              h('p', { className: 'pressure-check-eyebrow' }, t('eyebrow')),
              h('h1', null, t('title')),
              h('p', { className: 'pressure-check-secondary pressure-check-intro' }, t('description')),
              h('p', { className: 'pressure-check-speech' }, t(`speech${draft}`))),
            h('div', { className: 'pressure-check-stage' }, h(PressureMonster, { level: draft }), h('span', { className: 'pressure-check-stage-name' }, `0${draft} / ${t(`monster${draft}`)}`))),
          state.status === 'loading' ? h('p', { role: 'status', className: 'pressure-check-secondary' }, t('loading')) : null,
          state.revision === undefined ? h('p', { className: 'pressure-check-secondary', role: 'status' }, t('previewOnly')) : null,
          state.error ? h('div', { className: 'pressure-check-error', role: 'alert' }, state.error, ' ', h('button', { type: 'button', className: 'pressure-check-button', onClick: onRetry }, t('retry'))) : null,
          h('div', { className: 'pressure-check-card' },
            h('div', { className: 'pressure-check-control-heading' },
              h('div', null, h('h2', null, h('label', { htmlFor: controlId }, t('choose'))), h('p', { className: 'pressure-check-secondary' }, t('chooseHint'))),
              h('div', { className: 'pressure-check-level-number', 'aria-hidden': true }, h('strong', null, draft), h('span', null, '/ 5'))),
            h('input', { id: controlId, className: 'pressure-check-range', type: 'range', min: 0, max: 5, step: 1, value: draft, disabled: unavailable, onChange: event => setDraft(clamp(event.target.value)), 'aria-describedby': hintId, 'aria-valuetext': `${draft}/5 ${t(labels[draft])}：${t(`hint${draft}`)}` }),
            h('div', { className: 'pressure-check-ticks', role: 'group', 'aria-label': t('level') }, labels.map((label, level) => h('button', { key: label, className: 'pressure-check-pick', type: 'button', disabled: unavailable, 'aria-pressed': draft === level, 'aria-label': `${level}/5 ${t(label)} · ${t(`monster${level}`)}. ${t(`hint${level}`)}`, onClick: () => setDraft(level) }, h(PressureMonster, { level, small: true }), h('span', { className: 'pressure-check-pick-label' }, `${level} ${t(label)}`)))),
            h('div', { className: 'pressure-check-detail' },
              h('div', { className: 'pressure-check-detail-line' }, h('strong', null, t(`monster${draft}`)), h('span', { className: 'pressure-check-preview-tag' }, dirty || unconfirmed ? t('preview') : t('active'))),
              h('p', { id: hintId, className: 'pressure-check-preview' }, t(`hint${draft}`)),
              h('div', { className: 'pressure-check-skills', 'aria-hidden': true }, [1, 2, 3, 4, 5].map(skill => h('span', { key: skill, className: 'pressure-check-skill', 'data-on': draft >= [0, 1, 2, 2, 3, 5][skill] }, `${draft >= [0, 1, 2, 2, 3, 5][skill] ? '✓ ' : ''}${t(`skill${skill}`)}`)))),
            h('div', { className: 'pressure-check-actions' },
              h('div', { className: 'pressure-check-action-buttons' },
                h('button', { type: 'button', className: 'pressure-check-button pressure-check-button-primary', disabled: unavailable || !dirty, onClick: async () => { if (await onSave(draft)) setSelection(null) } }, t('save')),
                dirty ? h('button', { type: 'button', className: 'pressure-check-button', disabled: unavailable, onClick: () => setSelection(null) }, t('discard')) : null),
              h('span', { role: 'status', 'aria-live': 'polite', className: 'pressure-check-secondary pressure-check-feedback' }, state.status === 'saving' ? t('saving') : dirty ? t('pending') : state.saved ? t('saved') : ''),
            ),
          ),
        ))
    }
    return {
      inject: ['slots', 'locale', 'remote', 'remote.settings'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, dictionaries), 'pressure-check: locale')
        const t = ctx.locale.bind(NS)
        const state = new PressureState(ctx)
        ctx.effect(() => () => state.dispose(), 'pressure-check: state')
        void state.load()
        ctx.effect(() => ctx.remote.$on('settings/document-updated', ns => { if (ns === 'pressure-check') void state.load() }), 'pressure-check: settings subscription')
        ctx.effect(() => ctx.remote.$on('plugin-manager/changed', () => { void state.load() }), 'pressure-check: plugin subscription')
        ctx.on('connection/reset', () => { void state.load() })
        const onSave = level => state.setLevel(level)
        const onRetry = () => state.load()
        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main', key: 'pressure-check', locale: NS,
          inject: () => ({ hooks: { pressure: state }, onSave, onRetry }),
        }, PressurePanel))
        ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
          name: 'plugins.bundle.config', key: 'dsh-pressure-check', locale: NS,
          inject: () => ({ hooks: { pressure: state }, onSave, onRetry }),
        }, PressurePanel))
        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({ name: 'sidebar.panellist', id: 'pressure-check', order: 15, locale: NS, label: () => t('title') }, PressureIcon))
      },
    }
  },
})
