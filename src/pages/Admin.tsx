import { useEffect, useState, type FormEvent } from 'react'
import { AiSettingsCard } from '../components/AiSettingsCard'
import { Avatar } from '../components/Avatar'
import { VotingAdminCard } from '../components/VotingAdminCard'
import { Spinner } from '../components/Spinner'
import { inviteSummary, sendInvites } from '../lib/ai'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { memberName, type Member, type Role } from '../lib/types'

export function Admin() {
  const { member: me } = useAuth()
  const [members, setMembers] = useState<Member[] | null>(null)
  const [emails, setEmails] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [inviting, setInviting] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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
    setMsg({ ok: true, text: `Added ${list.length} email${list.length > 1 ? 's' : ''}. Sending invite emails…` })
    load()
    await invite(list)
  }

  async function invite(list: string[], label = 'all') {
    setInviting(label)
    const { results, error } = await sendInvites(list)
    setInviting(null)
    setMsg(error ? { ok: false, text: `Could not send invites: ${error}` } : inviteSummary(results!))
  }

  const inviteText = `Hi! Our EMBA group is collecting startup ideas for the investor pitch in Idea Pool 💡\n\nOpen ${window.location.origin} on your phone or laptop, enter your email and tap "Send me a login link" (or "Continue with Google"). No password needed. There's a 30-second video tour when you first log in.`

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setMsg({ ok: false, text: 'Could not copy. Select the message text and copy it by hand.' })
    }
  }

  const notJoined = (members ?? []).filter((m) => !m.joined_at)

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
        <button className="btn-primary" disabled={!!inviting}>Add & email invites</button>
        <p className="text-xs text-slate-500">Each new person gets an email with a link that logs them straight in.</p>
        {msg && <p className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
      </form>

      <div className="card divide-y divide-slate-100">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <h2 className="flex-1 font-semibold">Allowed emails ({members?.length ?? 0})</h2>
          {notJoined.length > 0 && (
            <button className="btn-ghost py-1.5 text-sm" disabled={!!inviting} onClick={() => invite(notJoined.map((m) => m.email))}>
              {inviting === 'all' ? 'Sending…' : `✉️ Invite all not joined (${notJoined.length})`}
            </button>
          )}
        </div>
        {!members ? <Spinner /> : members.map((m) => (
          <div key={m.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar member={m} size={32} />
              <div className="min-w-0">
                <div className="truncate font-medium">{m.email}</div>
                <div className="text-xs text-slate-500">
                  {memberName(m)} · {m.joined_at ? 'has logged in' : 'not logged in yet'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 pl-11 sm:pl-0">
              <select
                className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                value={m.role}
                disabled={m.id === me.id}
                onChange={(e) => setRole(m, e.target.value as Role)}
              >
                <option value="member">member</option>
                <option value="admin">admin</option>
              </select>
              {!m.joined_at && (
                <button className="text-sm text-brand-700 hover:underline" disabled={!!inviting} onClick={() => invite([m.email], m.email)}>
                  {inviting === m.email ? 'Sending…' : 'Send invite'}
                </button>
              )}
              {m.id !== me.id && <button className="text-sm text-red-600 hover:underline" onClick={() => remove(m)}>Remove</button>}
            </div>
          </div>
        ))}
      </div>
      <div className="card space-y-3 p-5">
        <h2 className="font-semibold">💬 Invite message for WhatsApp / Messenger</h2>
        <p className="text-sm text-slate-600">Prefer to share the link yourself? Copy this and paste it into your group chat.</p>
        <p className="rounded-xl bg-slate-50 p-3 text-sm whitespace-pre-wrap select-all">{inviteText}</p>
        <button className="btn-ghost text-sm" onClick={copyInvite}>{copied ? 'Copied ✓' : '📋 Copy message'}</button>
      </div>
      <VotingAdminCard />
      <AiSettingsCard />
    </div>
  )
}
