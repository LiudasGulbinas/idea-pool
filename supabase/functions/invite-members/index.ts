// Emails a login invite to group members who haven't joined yet. Admin only.
// POST { emails: string[], redirect_to: string }
import { admin, corsHeaders, errorMessage, getCaller, json } from '../_shared/common.ts'

type Result = { email: string; status: 'invited' | 'reminded' | 'already-joined' | 'not-on-list' | 'failed'; error?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const caller = await getCaller(req)
    if (caller?.role !== 'admin') return json({ error: 'Only the admin can send invites.' }, 403)
    const { emails, redirect_to } = await req.json()
    if (!Array.isArray(emails) || !emails.length) return json({ error: 'No emails given.' }, 400)

    const results: Result[] = []
    // One at a time: the email provider rate-limits bursts.
    for (const raw of emails.slice(0, 50)) {
      const email = String(raw).trim().toLowerCase()
      const { data: member } = await admin.from('members').select('joined_at').eq('email', email).maybeSingle()
      if (!member) {
        results.push({ email, status: 'not-on-list' })
        continue
      }
      if (member.joined_at) {
        results.push({ email, status: 'already-joined' })
        continue
      }
      const invite = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: redirect_to })
      if (!invite.error) {
        results.push({ email, status: 'invited' })
        continue
      }
      // Invited before but never logged in: the account exists, so send a fresh login link instead.
      const reminder = await admin.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirect_to } })
      results.push(reminder.error ? { email, status: 'failed', error: reminder.error.message } : { email, status: 'reminded' })
    }
    return json({ results })
  } catch (e) {
    console.error(e)
    return json({ error: errorMessage(e) }, 500)
  }
})
