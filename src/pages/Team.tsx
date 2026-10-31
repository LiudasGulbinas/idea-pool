import { useEffect, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { Spinner } from '../components/Spinner'
import { supabase } from '../lib/supabase'
import { memberName, type Member, type Profile } from '../lib/types'

export function Team() {
  const [members, setMembers] = useState<Member[] | null>(null)
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})

  useEffect(() => {
    supabase.from('members').select('*').order('display_name').then(({ data }) => setMembers((data as Member[]) ?? []))
    supabase.from('profiles').select('*').then(({ data }) => setProfiles(Object.fromEntries(((data as Profile[]) ?? []).map((p) => [p.member_id, p]))))
  }, [])

  if (!members) return <Spinner />
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Team</h1>
      {members.map((m) => {
        const [headline, ...skills] = (profiles[m.id]?.skills_summary ?? '').split('\n').filter((l) => l.trim())
        return (
          <div key={m.id} className="card p-4">
            <div className="flex items-center gap-3">
              <Avatar member={m} />
              <div className="min-w-0">
                <div className="font-semibold">{memberName(m)}</div>
                <div className="text-sm text-slate-500">{headline ?? (m.joined_at ? 'No skills summary yet' : 'Invited, not logged in yet')}</div>
              </div>
            </div>
            {skills.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm text-slate-700">
                {skills.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
