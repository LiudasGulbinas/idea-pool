import { useEffect, useState, type FormEvent } from 'react'
import { AiSettingsCard } from '../components/AiSettingsCard'
import { Avatar } from '../components/Avatar'
import { VotingAdminCard } from '../components/VotingAdminCard'
import { Spinner } from '../components/Spinner'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { memberName, type Member, type Role } from '../lib/types'

export function Admin() {
  const { member: me } = useAuth()
  const [members, setMembers] = useState<Member[] | null>(null)
  const [emails, setEmails] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function load() {
    const { data } = await supabase.from('members').select('*').order('created_at')
    setMembers((data as Member[]) ?? [])
  }
  useEffect(() => { load() }, [])

  if (me?.role !== 'admin') return <p className="text-slate-600">Only the admin can see this page.</p>

  async function addEmails(e: FormEvent) {
    e.preventDefault()
    setMsg(null)
    const list = [...new Set(emails.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter((x) => x.includes('@')))]
    if (!list.length) return setMsg({ ok: false, text: 'Paste one or more email addresses.' })
    const { error } = await supabase.from('members').upsert(list.map((email) => ({ email })), { onConflict: 'email', ignoreDuplicates: true })
    if (error) return setMsg({ ok: false, text: error.message })
    setEmails('')
    setMsg({ ok: true, text: `Added ${list.length} email${list.length > 1 ? 's' : ''}. They can log in now.` })
    load()
  }

  async function setRole(m: Member, role: Role) {
    const { error } = await supabase.from('members').update({ role }).eq('id', m.id)
    if (error) setMsg({ ok: false, text: error.message })
    load()
  }

  async function remove(m: Member) {
    if (!confirm(`Remove ${m.email} from the group? They will lose access.`)) return
    const { error } = await supabase.from('members').delete().eq('id', m.id)
    if (error) setMsg({ ok: false, text: error.message })
    load()
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Admin</h1>

      <form onSubmit={addEmails} className="card space-y-3 p-5">
        <h2 className="font-semibold">Add group members</h2>
        <textarea
          className="input min-h-24"
          placeholder="Paste emails, separated by commas or new lines"
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
        />
        <button className="btn-primary">Add to the list</button>
        {msg && <p className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
      </form>

      <div className="card divide-y divide-slate-100">
        <h2 className="p-4 font-semibold">Allowed emails ({members?.length ?? 0})</h2>
        {!members ? <Spinner /> : members.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-3 p-4">
            <Avatar member={m} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{m.email}</div>
              <div className="text-xs text-slate-500">
                {memberName(m)} · {m.user_id ? 'has logged in' : 'not logged in yet'}
              </div>
            </div>
            <select
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
              value={m.role}
              disabled={m.id === me.id}
              onChange={(e) => setRole(m, e.target.value as Role)}
            >
              <option value="member">member</option>
              <option value="admin">admin</option>
            </select>
            {m.id !== me.id && <button className="text-sm text-red-600 hover:underline" onClick={() => remove(m)}>Remove</button>}
          </div>
        ))}
      </div>
      <VotingAdminCard />
      <AiSettingsCard />
    </div>
  )
}
