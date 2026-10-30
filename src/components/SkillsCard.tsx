import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { startProfileSummary } from '../lib/ai'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { timeAgo, type Profile } from '../lib/types'

/** The member's LinkedIn PDF / experience and Claude's skills summary, used for team-fit matching. */
export function SkillsCard() {
  const { member } = useAuth()
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)
  const [experience, setExperience] = useState('')
  const [skills, setSkills] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    if (!member) return
    const { data } = await supabase.from('profiles').select('*').eq('member_id', member.id).maybeSingle()
    const p = data as Profile | null
    setProfile(p)
    setExperience(p?.experience_text ?? '')
    setSkills(p?.skills_summary ?? '')
  }, [member])

  useEffect(() => {
    load()
    if (!member) return
    const channel = supabase
      .channel(`profile-${member.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `member_id=eq.${member.id}` }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [member, load])

  if (!member || profile === undefined) return null

  async function saveProfile(patch: Partial<Profile>) {
    const { error } = await supabase.from('profiles').upsert({ member_id: member!.id, ...patch }, { onConflict: 'member_id' })
    return error?.message ?? null
  }

  async function analyse() {
    const err = await startProfileSummary()
    if (err) setMsg({ ok: false, text: err })
    load()
  }

  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setMsg(null)
    if (file.type !== 'application/pdf') return setMsg({ ok: false, text: 'Please choose a PDF file.' })
    if (file.size > 10 * 1024 * 1024) return setMsg({ ok: false, text: 'That PDF is larger than 10 MB.' })
    setBusy('Uploading…')
    const path = `${member!.id}/linkedin.pdf`
    const { error } = await supabase.storage.from('linkedin').upload(path, file, { upsert: true, contentType: 'application/pdf' })
    const err = error?.message ?? (await saveProfile({ linkedin_path: path }))
    setBusy(null)
    if (err) return setMsg({ ok: false, text: `Upload failed: ${err}` })
    await analyse()
  }

  async function saveExperienceAndAnalyse() {
    setMsg(null)
    const err = await saveProfile({ experience_text: experience.trim() })
    if (err) return setMsg({ ok: false, text: err })
    await analyse()
  }

  async function saveSkills() {
    const err = await saveProfile({ skills_summary: skills.trim() })
    setMsg(err ? { ok: false, text: err } : { ok: true, text: 'Saved ✓' })
  }

  const running = profile?.summary_status === 'running'

  return (
    <div className="card space-y-4 p-5">
      <div>
        <h2 className="font-bold">🧠 My expertise</h2>
        <p className="mt-1 text-sm text-slate-600">Claude uses this to suggest who fits each idea best. Upload your LinkedIn profile as PDF, or paste your experience.</p>
      </div>

      <details className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
        <summary className="cursor-pointer font-medium text-slate-700">How do I get my LinkedIn PDF?</summary>
        <p className="mt-2">On a <b>computer</b>: open your LinkedIn profile → click <b>Resources</b> (or <b>More</b>) under your name → <b>Save to PDF</b>.</p>
      </details>

      <div className="flex flex-wrap items-center gap-3">
        <label className={`btn-primary cursor-pointer ${busy || running ? 'pointer-events-none opacity-50' : ''}`}>
          📄 {profile?.linkedin_path ? 'Replace LinkedIn PDF' : 'Upload LinkedIn PDF'}
          <input type="file" accept="application/pdf" className="hidden" onChange={upload} />
        </label>
        {profile?.linkedin_path && <span className="text-sm text-green-700">✓ PDF uploaded</span>}
      </div>

      <div>
        <label className="label" htmlFor="exp">…or paste your experience</label>
        <textarea id="exp" className="input min-h-28 text-sm" value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="Roles, industries, skills, achievements…" />
        <button className="btn-ghost mt-2 text-sm" disabled={!!busy || running || !experience.trim()} onClick={saveExperienceAndAnalyse}>
          Save &amp; summarise with Claude
        </button>
      </div>

      {(busy || running) && (
        <div className="flex items-center gap-3 rounded-xl bg-brand-50 p-3 text-sm text-brand-700">
          <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-brand-100 border-t-brand-600" />
          {busy ?? 'Claude is reading your profile… (about 20–40 seconds)'}
        </div>
      )}
      {profile?.summary_status === 'failed' && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">Summary failed: {profile.summary_error}</p>}

      <div>
        <label className="label" htmlFor="skills">
          Skills summary {profile?.updated_at && profile.skills_summary && <span className="font-normal text-slate-400">· updated {timeAgo(profile.updated_at)}</span>}
        </label>
        <textarea
          id="skills"
          className="input min-h-40 text-sm"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          placeholder="Claude will fill this in. You can edit it afterwards."
        />
        <button className="btn-ghost mt-2 text-sm" disabled={running || skills === (profile?.skills_summary ?? '')} onClick={saveSkills}>Save my edits</button>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>}
    </div>
  )
}
