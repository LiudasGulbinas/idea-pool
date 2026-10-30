// Reads the caller's LinkedIn PDF (or pasted experience) and stores a short skills summary for team-fit matching.
// POST {}  — always works on the caller's own profile.
import type Anthropic from 'npm:@anthropic-ai/sdk@1.3.0'
import { encodeBase64 } from 'jsr:@std/encoding@1.0.10/base64'
import { admin, anthropic, corsHeaders, errorMessage, FALLBACK, getCaller, json, loadSettings, responseText } from '../_shared/common.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const caller = await getCaller(req)
    if (!caller) return json({ error: 'Please log in as a group member.' }, 401)

    const { data: profile } = await admin.from('profiles').select('linkedin_path, experience_text').eq('member_id', caller.id).maybeSingle()
    if (!profile?.linkedin_path && !profile?.experience_text?.trim()) {
      return json({ error: 'Upload your LinkedIn PDF or paste your experience first.' }, 400)
    }
    await admin.from('profiles').update({ summary_status: 'running', summary_error: null }).eq('member_id', caller.id)
    EdgeRuntime.waitUntil(summarize(caller.id, profile.linkedin_path, profile.experience_text ?? ''))
    return json({ status: 'started' }, 202)
  } catch (e) {
    console.error(e)
    return json({ error: errorMessage(e) }, 500)
  }
})

async function summarize(memberId: string, pdfPath: string | null, pastedText: string) {
  try {
    const settings = await loadSettings()
    const content: Anthropic.Beta.BetaContentBlockParam[] = []
    if (pdfPath) {
      const { data, error } = await admin.storage.from('linkedin').download(pdfPath)
      if (error) throw new Error(`Could not read the uploaded PDF: ${error.message}`)
      content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: encodeBase64(await data.arrayBuffer()) } })
    }
    if (pastedText.trim()) content.push({ type: 'text', text: `<experience_notes>\n${pastedText.trim()}\n</experience_notes>` })
    content.push({
      type: 'text',
      text: `This is an EMBA student's LinkedIn profile and/or experience notes. Summarise what they could bring to a startup team, for matching people to startup ideas.

Return:
- headline: one line, e.g. "Senior finance leader, 15 yrs in Baltic banking".
- skills: 5-8 short bullet points covering core expertise, industries, functions, seniority/leadership, notable achievements or networks, and languages if relevant.
- experience: a factual 120-200 word plain-text summary of their career.`,
    })

    const res = await anthropic.beta.messages.create({
      ...FALLBACK,
      model: settings.model,
      max_tokens: 4000,
      output_config: {
        effort: 'low',
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['headline', 'skills', 'experience'],
            properties: { headline: { type: 'string' }, skills: { type: 'array', items: { type: 'string' } }, experience: { type: 'string' } },
          },
        },
      },
      messages: [{ role: 'user', content }],
    })
    const out = JSON.parse(responseText(res)) as { headline: string; skills: string[]; experience: string }

    const { error } = await admin
      .from('profiles')
      .update({
        skills_summary: [out.headline, ...out.skills.map((s) => `• ${s}`)].join('\n'),
        // Keep what the member typed; otherwise store the summary of their PDF.
        experience_text: pastedText.trim() || out.experience,
        summary_status: 'done',
        summary_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('member_id', memberId)
    if (error) throw error
  } catch (e) {
    console.error('profile summary failed', memberId, e)
    await admin.from('profiles').update({ summary_status: 'failed', summary_error: errorMessage(e) }).eq('member_id', memberId)
  }
}
