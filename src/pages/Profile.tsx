import { useEffect, useState, type FormEvent } from 'react'
import { Avatar } from '../components/Avatar'
import { SkillsCard } from '../components/SkillsCard'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export const AVATAR_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ef4444', '#14b8a6', '#64748b']

export function Profile() {
  const { member, refreshMember, signOut } = useAuth()
  const [name, setName] = useState('')
  const [color, setColor] = useState(AVATAR_COLORS[0]!)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (member) {
      setName(member.display_name ?? '')
      setColor(member.avatar_color)
    }
  }, [member])

  if (!member) return null

  async function save(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.from('members').update({ display_name: name.trim() || null, avatar_color: color }).eq('id', member!.id)
    if (error) return setError(error.message)
    await refreshMember()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">My profile</h1>
      <form onSubmit={save} className="card space-y-4 p-5">
        <div className="flex items-center gap-3">
          <Avatar member={{ display_name: name, email: member.email, avatar_color: color }} size={56} />
          <div className="text-sm text-slate-500">{member.email}</div>
        </div>
        <div>
          <label className="label" htmlFor="name">Display name</label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Liudas G." />
        </div>
        <div>
          <span className="label">Avatar colour</span>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className={`h-9 w-9 rounded-full ring-offset-2 ${color === c ? 'ring-2 ring-slate-900' : ''}`}
                style={{ background: c }}
                aria-label={`Colour ${c}`}
              />
            ))}
          </div>
        </div>
        <button className="btn-primary w-full sm:w-auto">{saved ? 'Saved ✓' : 'Save'}</button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
      <SkillsCard />
      <button className="btn-ghost w-full sm:w-auto" onClick={signOut}>Sign out</button>
    </div>
  )
}
