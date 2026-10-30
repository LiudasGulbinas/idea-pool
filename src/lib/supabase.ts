import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)

// Implicit flow so a login link opened in a different browser (e.g. phone mail app) still works.
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing', {
  auth: { flowType: 'implicit', persistSession: true, detectSessionInUrl: true },
})
