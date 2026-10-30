import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { Spinner } from '../components/Spinner'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../lib/auth'
import { STATUSES, memberName, timeAgo, type IdeaStatus } from '../lib/types'
import { useIdeas } from '../lib/useIdeas'

export function Feed() {
  const { member } = useAuth()
  const { ideas, error } = useIdeas()
  const [status, setStatus] = useState<IdeaStatus | 'all'>('all')
  const [tag, setTag] = useState<string>('all')

  const allTags = useMemo(() => [...new Set((ideas ?? []).flatMap((i) => i.tags))].sort(), [ideas])
  const shown = (ideas ?? []).filter((i) => (status === 'all' || i.status === status) && (tag === 'all' || i.tags.includes(tag)))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Ideas {ideas && <span className="text-slate-400">({ideas.length})</span>}</h1>
        <Link to="/ideas/new" className="btn-primary hidden sm:inline-flex">+ New idea</Link>
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {[{ value: 'all' as const, label: 'All' }, ...STATUSES].map((s) => (
          <button
            key={s.value}
            onClick={() => setStatus(s.value)}
            className={`shrink-0 rounded-full border px-3 py-1 text-sm font-medium ${status === s.value ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
          >
            {s.label}
          </button>
        ))}
        {allTags.length > 0 && (
          <select className="shrink-0 rounded-full border border-slate-300 bg-white px-3 py-1 text-sm" value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="all">All tags</option>
            {allTags.map((t) => <option key={t} value={t}>#{t}</option>)}
          </select>
        )}
      </div>

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Could not load ideas: {error}</p>}
      {!ideas && !error && <Spinner label="Loading ideas…" />}

      {ideas && ideas.length === 0 && (
        <div className="card p-8 text-center">
          <div className="text-5xl">🌱</div>
          <h2 className="mt-3 text-lg font-bold">No ideas yet</h2>
          <p className="mt-1 text-slate-600">Be the first, {member ? memberName(member) : 'friend'}! Rough ideas are welcome.</p>
          <Link to="/ideas/new" className="btn-primary mt-4">+ Post the first idea</Link>
        </div>
      )}
      {ideas && ideas.length > 0 && shown.length === 0 && (
        <p className="py-8 text-center text-slate-500">No ideas match these filters.</p>
      )}

      <div className="space-y-3">
        {shown.map((idea) => (
          <Link key={idea.id} to={`/ideas/${idea.id}`} className="card block p-4 transition hover:border-brand-300 hover:shadow-md">
            <div className="flex items-start gap-2">
              <h2 className="flex-1 text-lg leading-snug font-bold">{idea.title}</h2>
              {idea.status !== 'new' && <StatusBadge status={idea.status} />}
              {idea.hidden && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Hidden</span>}
            </div>
            <p className="mt-1 text-slate-700">{idea.pitch}</p>
            {idea.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {idea.tags.map((t) => <span key={t} className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">#{t}</span>)}
              </div>
            )}
            <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
              {idea.author && <Avatar member={idea.author} size={22} />}
              <span>{idea.author ? memberName(idea.author) : 'Someone'}</span>
              <span>·</span>
              <span>{timeAgo(idea.created_at)}</span>
            </div>
          </Link>
        ))}
      </div>

      <Link
        to="/ideas/new"
        className="fixed right-4 bottom-20 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-3xl text-white shadow-lg active:scale-95 sm:hidden"
        aria-label="New idea"
      >
        +
      </Link>
    </div>
  )
}
