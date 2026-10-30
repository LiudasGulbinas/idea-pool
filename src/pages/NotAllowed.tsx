import { useAuth } from '../lib/auth'

export function NotAllowed() {
  const { session, signOut } = useAuth()
  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="card max-w-sm p-6 text-center">
        <div className="text-5xl">🔒</div>
        <h1 className="mt-2 text-xl font-bold">Not on the list (yet)</h1>
        <p className="mt-2 text-sm text-slate-600">
          You're signed in as <b>{session?.user.email}</b>, but this email isn't on the Idea Pool member list.
          Ask Liudas to add it.
        </p>
        <button className="btn-ghost mt-5 w-full" onClick={signOut}>Sign out</button>
      </div>
    </div>
  )
}
