import { useEffect, useState } from 'react'
import { startAnalysis } from '../lib/ai'
import { supabase } from '../lib/supabase'
import type { AiSettings, Criterion } from '../lib/types'

const MODELS = [
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (recommended, ~10–20¢ per idea)' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (deeper, ~2× the cost)' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (fastest, cheapest)' },
]

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'criterion'

/** Admin: edit Claude's instructions and scoring criteria, and refresh team fit after new profiles. */
export function AiSettingsCard() {
  const [s, setS] = useState<AiSettings | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [progress, setProgress] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('settings').select('model, instructions, criteria').eq('id', 1).single().then(({ data }) => setS(data as AiSettings))
  }, [])

  if (!s) return null

  const setCriterion = (i: number, patch: Partial<Criterion>) => setS({ ...s, criteria: s.criteria.map((c, j) => (j === i ? { ...c, ...patch } : c)) })

  async function save() {
    setMsg(null)
    const used = new Set<string>()
    const criteria = s!.criteria
      .filter((c) => c.name.trim())
      .map((c) => {
        let key = c.key || slug(c.name)
        while (used.has(key)) key += '_2'
        used.add(key)
        return { ...c, key, name: c.name.trim(), description: c.description.trim(), weight: Math.max(0, Number(c.weight) || 0) }
      })
    const { error } = await supabase.from('settings').update({ ...s, criteria, updated_at: new Date().toISOString() }).eq('id', 1)
    if (error) return setMsg({ ok: false, text: error.message })
    setS({ ...s!, criteria })
    setMsg({ ok: true, text: 'Saved. New and re-run analyses will use these settings.' })
  }

  async function refreshTeamFit() {
    if (!confirm('Re-check team fit for every analysed idea using the latest profiles? (about 1–2 cents per idea)')) return
    const { data } = await supabase.from('ai_analysis').select('idea_id').eq('status', 'done')
    const ids = (data ?? []).map((d) => d.idea_id as string)
    let failed = 0
    for (let i = 0; i < ids.length; i++) {
      setProgress(`Updating team fit ${i + 1} of ${ids.length}…`)
      if (await startAnalysis(ids[i]!, { mode: 'team_fit' })) failed++
    }
    setProgress(null)
    setMsg(failed ? { ok: false, text: `Done, but ${failed} of ${ids.length} failed. Try again later.` } : { ok: true, text: `Team fit refreshed for ${ids.length} ideas.` })
  }

  return (
    <div className="card space-y-5 p-5">
      <div>
        <h2 className="font-semibold">🤖 Claude analysis settings</h2>
        <p className="text-sm text-slate-500">Changes apply to new analyses and re-runs.</p>
      </div>

      <div>
        <span className="label">Team fit</span>
        <p className="mb-2 text-sm text-slate-600">When teammates upload new LinkedIn profiles, refresh who fits each idea best.</p>
        <button className="btn-ghost text-sm" disabled={!!progress} onClick={refreshTeamFit}>{progress ?? '👥 Refresh team fit for all ideas'}</button>
      </div>

      <div>
        <label className="label" htmlFor="model">Model</label>
        <select id="model" className="input" value={s.model} onChange={(e) => setS({ ...s, model: e.target.value })}>
          {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          {!MODELS.some((m) => m.id === s.model) && <option value={s.model}>{s.model}</option>}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="instr">Instructions for Claude</label>
        <textarea id="instr" className="input min-h-32 text-sm" value={s.instructions} onChange={(e) => setS({ ...s, instructions: e.target.value })} />
      </div>

      <div className="space-y-3">
        <span className="label">Scoring criteria (weight = importance in the overall score)</span>
        {s.criteria.map((c, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-3">
            <div className="flex gap-2">
              <input className="input flex-1 py-1.5" value={c.name} onChange={(e) => setCriterion(i, { name: e.target.value })} placeholder="Name" />
              <input className="input w-20 py-1.5" type="number" step="0.5" min="0" value={c.weight} onChange={(e) => setCriterion(i, { weight: Number(e.target.value) })} aria-label="Weight" />
              <button className="px-2 text-red-600" onClick={() => setS({ ...s, criteria: s.criteria.filter((_, j) => j !== i) })} aria-label="Remove">✕</button>
            </div>
            <input className="input py-1.5 text-sm" value={c.description} onChange={(e) => setCriterion(i, { description: e.target.value })} placeholder="What should Claude judge?" />
          </div>
        ))}
        <button className="btn-ghost text-sm" onClick={() => setS({ ...s, criteria: [...s.criteria, { key: '', name: '', description: '', weight: 1 }] })}>+ Add criterion</button>
      </div>

      <button className="btn-primary" onClick={save}>Save settings</button>
      {msg && <p className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
    </div>
  )
}
