import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { Spinner } from '../components/Spinner'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { IDEA_SELECT, STATUSES, memberName, timeAgo, type Idea, type IdeaStatus } from '../lib/types'

const SECTIONS = [
  { key: 'problem', label: '😣 Problem' },
  { key: 'solution', label: '🛠️ Solution' },
  { key: 'target_customer', label: '🎯 Target customer' },
  { key: 'revenue_model', label: '💶 How it makes money' },
] as const

export function IdeaDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { member } = useAuth()
  const [idea, setIdea] = useState<Idea | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('ideas').select(IDEA_SELECT).eq('id', id!).maybeSingle()
    setIdea(data as Idea | null)
  }, [id])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`idea-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ideas', filter: `id=eq.${id}` }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, load])

  if (idea === undefined) return <Spinner />
  if (idea === null)
    return (
      <div className="card p-8 text-center">
        <p className="text-slate-600">This idea was deleted or hidden.</p>
        <Link to="/" className="btn-ghost mt-4">← Back to ideas</Link>
      </div>
    )

  const isAuthor = member?.id === idea.author_id
  const isAdmin = member?.role === 'admin'

  async function update(patch: Partial<Idea>) {
    setError(null)
    const { error } = await supabase.from('ideas').update(patch).eq('id', idea!.id)
    if (error) setError(error.message)
    else load()
  }

  async function remove() {
    if (!confirm('Delete this idea for everyone? This cannot be undone.')) return
    const { error } = await supabase.from('ideas').delete().eq('id', idea!.id)
    if (error) setError(error.message)
    else navigate('/', { replace: true })
  }

  return (
    <div className="space-y-4">
      <Link to="/" className="text-slate-500">← All ideas</Link>

      <article className="card space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={idea.status} />
          {idea.hidden && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Hidden from team</span>}
        </div>
        <div>
          <h1 className="text-2xl leading-tight font-extrabold">{idea.title}</h1>
          <p className="mt-2 text-lg text-slate-700">{idea.pitch}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          {idea.author && <Avatar member={idea.author} size={26} />}
          <span className="font-medium text-slate-700">{idea.author ? memberName(idea.author) : 'Someone'}</span>
          <span>· {timeAgo(idea.created_at)}</span>
          {idea.updated_at.slice(0, 16) !== idea.created_at.slice(0, 16) && <span>· edited</span>}
        </div>

        {SECTIONS.filter((s) => idea[s.key].trim()).map((s) => (
          <section key={s.key}>
            <h2 className="text-sm font-bold tracking-wide text-slate-500 uppercase">{s.label}</h2>
            <p className="mt-1 whitespace-pre-wrap text-slate-800">{idea[s.key]}</p>
          </section>
        ))}

        {idea.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {idea.tags.map((t) => <span key={t} className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">#{t}</span>)}
          </div>
        )}

        {(isAuthor || isAdmin) && (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {isAuthor && <Link to={`/ideas/${idea.id}/edit`} className="btn-ghost">✏️ Edit</Link>}
            <button className="btn-danger" onClick={remove}>Delete</button>
          </div>
        )}
      </article>

      {isAdmin && (
        <div className="card space-y-3 p-5">
          <h2 className="font-semibold">Admin</h2>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => update({ status: s.value as IdeaStatus })}
                className={`rounded-full border px-3 py-1 text-sm font-medium ${idea.status === s.value ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button className="btn-ghost" onClick={() => update({ hidden: !idea.hidden })}>
            {idea.hidden ? '👁️ Show to team again' : '🙈 Hide from team'}
          </button>
        </div>
      )}

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="card p-5 text-sm text-slate-500">💬 Likes, comments and Claude's investor analysis are coming in the next stages.</div>
    </div>
  )
}
