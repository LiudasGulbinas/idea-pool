import { useEffect, useState } from 'react'
import { exportIdeasCsv } from '../lib/exportCsv'
import { supabase } from '../lib/supabase'
import type { VotingSettings } from '../lib/types'

export function VotingAdminCard() {
  const [s, setS] = useState<VotingSettings | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    supabase.from('settings').select('vote_budget, voting_open').eq('id', 1).single().then(({ data }) => setS(data as VotingSettings))
  }, [])

  if (!s) return null

  async function save(patch: Partial<VotingSettings>) {
    setMsg(null)
    const { error } = await supabase.from('settings').update(patch).eq('id', 1)
    if (error) return setMsg({ ok: false, text: error.message })
    setS({ ...s!, ...patch })
    setMsg({ ok: true, text: 'Saved ✓' })
  }

  async function resetVotes() {
    if (!confirm('Delete everyone\'s votes and start a fresh round?')) return
    const { error } = await supabase.from('votes').delete().not('idea_id', 'is', null)
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: 'All votes cleared.' })
  }

  async function exportCsv() {
    setMsg(null)
    try {
      const n = await exportIdeasCsv()
      setMsg({ ok: true, text: `Exported ${n} ideas.` })
    } catch (e) {
      setMsg({ ok: false, text: `Export failed: ${(e as Error).message}` })
    }
  }

  return (
    <div className="card space-y-4 p-5">
      <h2 className="font-semibold">🗳️ Voting & export</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="label" htmlFor="budget">Points per member</label>
          <input id="budget" type="number" min={1} max={50} className="input w-24" value={s.vote_budget} onChange={(e) => setS({ ...s, vote_budget: Number(e.target.value) })} />
        </div>
        <button className="btn-ghost" onClick={() => save({ vote_budget: Math.min(50, Math.max(1, s.vote_budget || 5)) })}>Save</button>
        <label className="flex items-center gap-2 pb-2.5 text-sm font-medium">
          <input type="checkbox" className="h-5 w-5 accent-brand-600" checked={s.voting_open} onChange={(e) => save({ voting_open: e.target.checked })} />
          Voting open
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-danger text-sm" onClick={resetVotes}>Reset all votes</button>
        <button className="btn-ghost text-sm" onClick={exportCsv}>⬇️ Export all ideas (CSV)</button>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
    </div>
  )
}
