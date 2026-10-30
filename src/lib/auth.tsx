import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { Member } from './types'

interface AuthState {
  session: Session | null
  member: Member | null
  loading: boolean
  refreshMember: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)

  const loadMember = useCallback(async (s: Session | null) => {
    if (!s) {
      setMember(null)
      return
    }
    const { data } = await supabase.from('members').select('*').eq('user_id', s.user.id).maybeSingle()
    setMember(data as Member | null)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadMember(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      // Defer the query: Supabase recommends not awaiting inside this callback.
      setTimeout(() => loadMember(s), 0)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadMember])

  const value: AuthState = {
    session,
    member,
    loading,
    refreshMember: () => loadMember(session),
    signOut: async () => {
      await supabase.auth.signOut()
      setMember(null)
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
