import { createClient } from '@supabase/supabase-js'

// Public values by design: the publishable key only identifies the project; Row Level Security protects the data.
const url = 'https://tciicfmrixbzyrkkjbnl.supabase.co'
const anonKey = 'sb_publishable_tu7_aVtbIwtIA0BcVs3vuQ_jRBPCMlt'

// Implicit flow so a login link opened in a different browser (e.g. phone mail app) still works.
export const supabase = createClient(url, anonKey, {
  auth: { flowType: 'implicit', persistSession: true, detectSessionInUrl: true },
})
