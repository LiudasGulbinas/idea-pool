import { useAuth } from '../lib/auth'
import { memberName } from '../lib/types'

export function Home() {
  const { member } = useAuth()
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h1 className="text-xl font-bold">Welcome, {member ? memberName(member) : 'friend'}! 👋</h1>
        <p className="mt-2 text-slate-600">
          Login works. The idea feed is coming next: post ideas, like and comment, and Claude will score each one for investors.
        </p>
      </div>
    </div>
  )
}
