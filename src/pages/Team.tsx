import { useEffect, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { Spinner } from '../components/Spinner'
import { supabase } from '../lib/supabase'
import { memberName, type Member } from '../lib/types'

export function Team() {
  const [members, setMembers] = useState<Member[] | null>(null)

  useEffect(() => {
    supabase.from('members').select('*').order('display_name').then(({ data }) => setMembers((data as Member[]) ?? []))
  }, [])

  if (!members) return <Spinner />
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Team</h1>
      {members.map((m) => (
        <div key={m.id} className="card flex items-center gap-3 p-4">
          <Avatar member={m} />
          <div className="min-w-0">
            <div className="font-semibold">{memberName(m)}</div>
            <div className="truncate text-sm text-slate-500">{m.user_id ? 'Joined' : 'Invited, not logged in yet'}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
