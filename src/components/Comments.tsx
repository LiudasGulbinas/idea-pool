import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { COMMENT_SELECT, memberName, timeAgo, type Comment } from '../lib/types'
import { Avatar } from './Avatar'

export function Comments({ ideaId }: { ideaId: string }) {
  const { member } = useAuth()
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [text, setText] = useState('')
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('comments').select(COMMENT_SELECT).eq('idea_id', ideaId).order('created_at')
    if (error) setError(error.message)
    else setComments(data as Comment[])
  }, [ideaId])

  useEffect(() => {
    load()
    const channel = supabase
      .channel(`comments-${ideaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `idea_id=eq.${ideaId}` }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [ideaId, load])

  async function add(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.from('comments').insert({ idea_id: ideaId, body: text.trim() })
    setBusy(false)
    if (error) return setError(`Could not post: ${error.message}`)
    setText('')
    load()
  }

  async function saveEdit() {
    if (!editing?.body.trim()) return
    const { error } = await supabase.from('comments').update({ body: editing.body.trim() }).eq('id', editing.id)
    if (error) return setError(error.message)
    setEditing(null)
    load()
  }

  async function remove(c: Comment) {
    if (!confirm('Delete this comment?')) return
    const { error } = await supabase.from('comments').delete().eq('id', c.id)
    if (error) setError(error.message)
    else load()
  }

  return (
    <section className="card p-5">
      <h2 className="font-bold">💬 Discussion {comments && comments.length > 0 && <span className="text-slate-400">({comments.length})</span>}</h2>

      {comments && comments.length === 0 && <p className="mt-2 text-sm text-slate-500">No comments yet. What do you think?</p>}

      <ul className="mt-3 space-y-4">
        {comments?.map((c) => {
          const mine = c.author_id === member?.id
          return (
            <li key={c.id} className="flex gap-3">
              {c.author && <Avatar member={c.author} size={32} />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-semibold">{c.author ? memberName(c.author) : 'Someone'}</span>
                  <span className="text-slate-400">{timeAgo(c.created_at)}{c.updated_at.slice(0, 16) !== c.created_at.slice(0, 16) && ' · edited'}</span>
                </div>
                {editing?.id === c.id ? (
                  <div className="mt-1 space-y-2">
                    <textarea className="input min-h-20" value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
                    <div className="flex gap-2">
                      <button className="btn-primary py-1.5 text-sm" onClick={saveEdit}>Save</button>
                      <button className="btn-ghost py-1.5 text-sm" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-0.5 break-words whitespace-pre-wrap text-slate-800">{c.body}</p>
                )}
                {editing?.id !== c.id && (mine || member?.role === 'admin') && (
                  <div className="mt-1 flex gap-3 text-xs text-slate-500">
                    {mine && <button onClick={() => setEditing({ id: c.id, body: c.body })} className="hover:underline">Edit</button>}
                    <button onClick={() => remove(c)} className="hover:text-red-600 hover:underline">Delete</button>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      <form onSubmit={add} className="mt-4 flex items-end gap-2 border-t border-slate-100 pt-4">
        <textarea
          className="input min-h-11 flex-1 resize-none"
          rows={text.includes('\n') || text.length > 60 ? 3 : 1}
          placeholder="Add a comment…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add(e)
          }}
        />
        <button className="btn-primary" disabled={busy || !text.trim()}>{busy ? '…' : 'Send'}</button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  )
}
