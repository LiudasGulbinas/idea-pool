import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0'
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'

declare global {
  // Supabase Edge Runtime: keeps the function alive for background work after the response is sent.
  const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function serviceKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  // Projects on the new API keys expose secret keys as JSON, e.g. {"default": "sb_secret_..."}.
  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
  const key = keys.default ?? Object.values(keys)[0]
  if (!key) throw new Error('No Supabase service key available to the function')
  return key
}

/** Server-side database client: bypasses Row Level Security, so only use it after checking the caller. */
export const admin: SupabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
})

export const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

/** Server-side refusal fallback: if the model declines, the API retries on a fallback model in the same call. */
export const FALLBACK: { betas: Anthropic.Beta.AnthropicBeta[]; fallbacks: 'default' } = {
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default',
}

export interface Caller {
  id: string
  role: 'member' | 'admin'
  display_name: string | null
  email: string
}

/** The logged-in group member making the request, or null if not logged in / not on the list. */
export async function getCaller(req: Request): Promise<Caller | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return null
  const { data: member } = await admin.from('members').select('id, role, display_name, email').eq('user_id', data.user.id).maybeSingle()
  return (member as Caller | null) ?? null
}

export interface Settings {
  model: string
  instructions: string
  criteria: { key: string; name: string; description: string; weight: number }[]
}

export async function loadSettings(): Promise<Settings> {
  const { data, error } = await admin.from('settings').select('model, instructions, criteria').eq('id', 1).single()
  if (error) throw new Error(`Could not load AI settings: ${error.message}`)
  return data as Settings
}

/** Joins the text blocks of a response, after checking it finished normally. */
export function responseText(res: { stop_reason: string | null; content: { type: string }[] }) {
  if (res.stop_reason === 'refusal') throw new Error('Claude declined to analyse this content.')
  if (res.stop_reason === 'max_tokens') throw new Error('The answer was cut off (too long). Try again.')
  return res.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

export function errorMessage(e: unknown) {
  if (e instanceof Anthropic.APIError) {
    if (e.status === 401) return 'The Anthropic API key is missing or invalid (check Supabase secrets).'
    if (e.status === 429) return 'Claude is rate-limited or the monthly spend limit was reached. Try again later.'
    if (e.status && e.status >= 500) return 'Claude is temporarily unavailable. Try again in a few minutes.'
    return `Claude API error ${e.status}: ${e.message}`
  }
  return e instanceof Error ? e.message : String(e)
}
