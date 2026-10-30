import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Spinner } from '../components/Spinner'
import { supabase } from '../lib/supabase'
import type { Idea } from '../lib/types'

const FIELDS = [
  { key: 'problem', label: 'Problem', hint: 'Who has this problem, and how painful or frequent is it?' },
  { key: 'solution', label: 'Solution', hint: 'What do we build or offer?' },
  { key: 'target_customer', label: 'Target customer', hint: 'Who pays? Be specific, e.g. "small dental clinics in the Baltics".' },
  { key: 'revenue_model', label: 'How it makes money (optional)', hint: 'Subscription, commission, licence…' },
] as const

type Draft = Pick<Idea, 'title' | 'pitch' | 'problem' | 'solution' | 'target_customer' | 'revenue_model'> & { tagsText: string }
const EMPTY: Draft = { title: '', pitch: '', problem: '', solution: '', target_customer: '', revenue_model: '', tagsText: '' }

export function IdeaForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [draft, setDraft] = useState<Draft | null>(id ? null : EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    supabase.from('ideas').select('*').eq('id', id).single().then(({ data, error }) => {
      if (error) return setError(error.message)
      const i = data as Idea
      setDraft({ ...i, tagsText: i.tags.join(', ') })
    })
  }, [id])

  if (!draft) return error ? <p className="text-red-600">{error}</p> : <Spinner />

  const set = (k: keyof Draft, v: string) => setDraft({ ...draft, [k]: v })

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!draft!.title.trim() || !draft!.pitch.trim()) return setError('Please add a title and a one-line pitch.')
    setBusy(true)
    const { tagsText, ...rest } = draft!
    const row = {
      title: rest.title.trim(),
      pitch: rest.pitch.trim(),
      problem: rest.problem.trim(),
      solution: rest.solution.trim(),
      target_customer: rest.target_customer.trim(),
      revenue_model: rest.revenue_model.trim(),
      tags: [...new Set(tagsText.split(/[,#]+/).map((t) => t.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean))],
    }
    const res = id
      ? await supabase.from('ideas').update(row).eq('id', id).select('id').single()
      : await supabase.from('ideas').insert(row).select('id').single()
    setBusy(false)
    if (res.error) return setError(`Could not save: ${res.error.message}`)
    navigate(`/ideas/${res.data.id}`, { replace: true })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to={id ? `/ideas/${id}` : '/'} className="text-slate-500">← Back</Link>
        <h1 className="text-xl font-bold">{id ? 'Edit idea' : 'New idea 💡'}</h1>
      </div>

      <div className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="title">Title *</label>
          <input id="title" className="input" maxLength={120} value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Uber for dog walking" />
        </div>
        <div>
          <label className="label" htmlFor="pitch">One-line pitch *</label>
          <input id="pitch" className="input" maxLength={200} value={draft.pitch} onChange={(e) => set('pitch', e.target.value)} placeholder="One sentence an investor remembers" />
        </div>
        {FIELDS.map((f) => (
          <div key={f.key}>
            <label className="label" htmlFor={f.key}>{f.label}</label>
            <textarea id={f.key} className="input min-h-24" value={draft[f.key]} onChange={(e) => set(f.key, e.target.value)} placeholder={f.hint} />
          </div>
        ))}
        <div>
          <label className="label" htmlFor="tags">Tags</label>
          <input id="tags" className="input" value={draft.tagsText} onChange={(e) => set('tagsText', e.target.value)} placeholder="fintech, b2b, ai" />
          <p className="mt-1 text-xs text-slate-500">Separate with commas.</p>
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button className="btn-primary w-full text-lg" disabled={busy}>{busy ? 'Saving…' : id ? 'Save changes' : 'Submit idea'}</button>
    </form>
  )
}
