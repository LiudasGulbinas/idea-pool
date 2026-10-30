// Analyses one idea against the admin-defined investor criteria:
// 1) research call with web search (competitors, market), 2) scoring call that returns strict JSON.
// POST { idea_id, force?: boolean, mode?: 'full' | 'team_fit' }
import type Anthropic from 'npm:@anthropic-ai/sdk@1.3.0'
import { admin, anthropic, corsHeaders, errorMessage, FALLBACK, getCaller, json, loadSettings, responseText, type Settings } from '../_shared/common.ts'

interface Idea {
  id: string
  title: string
  pitch: string
  problem: string
  solution: string
  target_customer: string
  revenue_model: string
  tags: string[]
}

interface TeamMember {
  member_id: string
  name: string
  skills: string
}

interface TeamFit {
  members: { member_id: string; name?: string; reason: string; role: string }[]
  gaps: string[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const caller = await getCaller(req)
    if (!caller) return json({ error: 'Please log in as a group member.' }, 401)
    const { idea_id, force = false, mode = 'full' } = await req.json()
    if (!idea_id) return json({ error: 'idea_id is required' }, 400)
    if ((force || mode === 'team_fit') && caller.role !== 'admin') return json({ error: 'Only the admin can re-run analyses.' }, 403)

    if (mode === 'team_fit') {
      await refreshTeamFit(idea_id)
      return json({ status: 'done' })
    }

    const { data: claimed, error } = await admin.rpc('claim_analysis', { p_idea: idea_id, p_force: force })
    if (error) throw error
    if (!claimed) return json({ status: 'already-running-or-done' })

    // Answer the browser right away; the analysis continues in the background and the app updates live.
    EdgeRuntime.waitUntil(runAnalysis(idea_id))
    return json({ status: 'started' }, 202)
  } catch (e) {
    console.error(e)
    return json({ error: errorMessage(e) }, 500)
  }
})

async function loadIdea(ideaId: string) {
  const { data, error } = await admin
    .from('ideas')
    .select('id, title, pitch, problem, solution, target_customer, revenue_model, tags')
    .eq('id', ideaId)
    .single()
  if (error) throw new Error(`Idea not found: ${error.message}`)
  return data as Idea
}

async function loadTeam(): Promise<TeamMember[]> {
  const { data } = await admin.from('profiles').select('member_id, skills_summary, member:members!profiles_member_id_fkey(display_name, email)')
  return ((data ?? []) as unknown as { member_id: string; skills_summary: string; member: { display_name: string | null; email: string } }[])
    .filter((p) => p.skills_summary.trim())
    .map((p) => ({ member_id: p.member_id, name: p.member.display_name || p.member.email.split('@')[0], skills: p.skills_summary.trim() }))
}

function ideaText(idea: Idea) {
  return [
    `Title: ${idea.title}`,
    `One-line pitch: ${idea.pitch}`,
    `Problem: ${idea.problem || '(not given)'}`,
    `Solution: ${idea.solution || '(not given)'}`,
    `Target customer: ${idea.target_customer || '(not given)'}`,
    `How it makes money: ${idea.revenue_model || '(not given)'}`,
    `Tags: ${idea.tags.join(', ') || '(none)'}`,
  ].join('\n')
}

function teamText(team: TeamMember[]) {
  if (!team.length) return 'No team member profiles have been uploaded yet, so team fit cannot be judged in detail.'
  return team.map((m) => `<member id="${m.member_id}" name="${m.name}">\n${m.skills}\n</member>`).join('\n')
}

async function research(settings: Settings, idea: Idea) {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: 'user',
      content: `Research this startup idea on the web before it is scored for investors.

<idea>
${ideaText(idea)}
</idea>

Find:
1. Existing startups, products or incumbents solving the same or a similar problem (name, website URL, one line on what they do and how far along they are). Aim for 3-6 of the most relevant, prioritising Europe/the Baltics where relevant.
2. Any useful data on market size, growth and customer pain (with source URLs).
3. Notable regulatory or technical constraints.

Write compact research notes with the URLs inline. Do not score the idea.`,
    },
  ]
  // Web search runs server-side; a long search session may pause and need resuming.
  for (let i = 0; i < 4; i++) {
    const res = await anthropic.beta.messages.create({
      ...FALLBACK,
      model: settings.model,
      max_tokens: 8000,
      output_config: { effort: 'medium' },
      system: settings.instructions,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5 }],
      messages,
    })
    if (res.stop_reason !== 'pause_turn') return responseText(res)
    messages.push({ role: 'assistant', content: res.content })
  }
  throw new Error('Web research took too long.')
}

function teamFitSchema(team: TeamMember[]) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['members', 'gaps'],
    properties: {
      members: {
        type: 'array',
        description: 'The 2-3 team members who would contribute most (empty if no profiles were given).',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['member_id', 'reason', 'role'],
          properties: {
            member_id: team.length ? { type: 'string', enum: team.map((m) => m.member_id) } : { type: 'string' },
            reason: { type: 'string', description: 'One line: why this person fits.' },
            role: { type: 'string', description: 'Suggested role, e.g. "CEO / sales lead".' },
          },
        },
      },
      gaps: { type: 'array', items: { type: 'string' }, description: 'Expertise the team would still need to cover.' },
    },
  }
}

const score = { type: 'integer', enum: [1, 2, 3, 4, 5] }

async function score_(settings: Settings, idea: Idea, notes: string, team: TeamMember[]) {
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['criteria', 'verdict', 'recommendations', 'investor_questions', 'similar_companies', 'team_fit'],
    properties: {
      criteria: {
        type: 'array',
        description: 'One entry per criterion, in the order given.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['key', 'score', 'explanation'],
          properties: {
            key: { type: 'string', enum: settings.criteria.map((c) => c.key) },
            score,
            explanation: { type: 'string', description: '2-3 sentences, specific to this idea.' },
          },
        },
      },
      verdict: { type: 'string', description: 'One paragraph overall verdict for the team.' },
      recommendations: { type: 'array', items: { type: 'string' }, description: 'Exactly three concrete ways to strengthen the idea.' },
      investor_questions: { type: 'array', items: { type: 'string' }, description: 'Key questions investors would ask (3-6).' },
      similar_companies: {
        type: 'array',
        description: 'Competitors / similar companies from the research, with links.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'url', 'note'],
          properties: { name: { type: 'string' }, url: { type: 'string' }, note: { type: 'string', description: 'What they do and how this idea differs.' } },
        },
      },
      team_fit: teamFitSchema(team),
    },
  }

  const criteriaText = settings.criteria.map((c) => `- ${c.key} (${c.name}): ${c.description}`).join('\n')
  const res = await anthropic.beta.messages.create({
    ...FALLBACK,
    model: settings.model,
    max_tokens: 16000,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
    system: settings.instructions,
    messages: [
      {
        role: 'user',
        content: `Score this startup idea for an investor pitch.

<idea>
${ideaText(idea)}
</idea>

<web_research>
${notes || '(no research available)'}
</web_research>

<team>
${teamText(team)}
</team>

Score each criterion from 1 (weak) to 5 (excellent):
${criteriaText}

For team fit, pick the 2-3 members whose expertise would contribute most (with a one-line reason and a suggested role) and list the expertise gaps. Only use member ids from <team>. List similar companies only if they appear in the research, with their real URLs.`,
      },
    ],
  })
  return JSON.parse(responseText(res)) as {
    criteria: { key: string; score: number; explanation: string }[]
    verdict: string
    recommendations: string[]
    investor_questions: string[]
    similar_companies: { name: string; url: string; note: string }[]
    team_fit: TeamFit
  }
}

type ScoredCriterion = { key: string; name: string; weight: number; score: number | null; explanation: string }

function withNames(fit: TeamFit, team: TeamMember[]): TeamFit {
  return {
    gaps: fit.gaps,
    members: fit.members
      .filter((m) => team.some((t) => t.member_id === m.member_id))
      .map((m) => ({ ...m, name: team.find((t) => t.member_id === m.member_id)!.name })),
  }
}

function overall(criteria: ScoredCriterion[]) {
  const scored = criteria.filter((c) => c.score !== null && c.weight > 0)
  const weights = scored.reduce((s, c) => s + c.weight, 0)
  return weights ? Math.round((scored.reduce((s, c) => s + c.weight * c.score!, 0) / weights) * 10) / 10 : null
}

async function runAnalysis(ideaId: string) {
  try {
    const [settings, idea, team] = await Promise.all([loadSettings(), loadIdea(ideaId), loadTeam()])
    const notes = await research(settings, idea)
    const result = await score_(settings, idea, notes, team)

    // Keep the admin's names and weights; the overall score is a weighted average computed here, not by the model.
    const criteria: ScoredCriterion[] = settings.criteria.map((c) => {
      const r = result.criteria.find((x) => x.key === c.key)
      return { key: c.key, name: c.name, weight: Number(c.weight) || 0, score: r ? Math.min(5, Math.max(1, Math.round(r.score))) : null, explanation: r?.explanation ?? '' }
    })

    const { error } = await admin
      .from('ai_analysis')
      .update({
        status: 'done',
        overall_score: overall(criteria),
        criteria,
        similar_companies: result.similar_companies.filter((c) => /^https?:\/\//.test(c.url)),
        verdict: result.verdict,
        recommendations: result.recommendations,
        investor_questions: result.investor_questions,
        team_fit: withNames(result.team_fit, team),
        model: settings.model,
        error: null,
        analysed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('idea_id', ideaId)
    if (error) throw error
  } catch (e) {
    console.error('analysis failed', ideaId, e)
    await admin.from('ai_analysis').update({ status: 'failed', error: errorMessage(e), updated_at: new Date().toISOString() }).eq('idea_id', ideaId)
  }
}

/** Cheaper update after new profiles are uploaded: re-judges only team fit, without web search. */
async function refreshTeamFit(ideaId: string) {
  const [settings, idea, team, { data: current }] = await Promise.all([
    loadSettings(),
    loadIdea(ideaId),
    loadTeam(),
    admin.from('ai_analysis').select('status, criteria').eq('idea_id', ideaId).maybeSingle(),
  ])
  if (current?.status !== 'done') return // a full analysis is pending or failed; it will include the latest team anyway

  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['score', 'explanation', 'team_fit'],
    properties: { score, explanation: { type: 'string', description: '2-3 sentences.' }, team_fit: teamFitSchema(team) },
  }
  const res = await anthropic.beta.messages.create({
    ...FALLBACK,
    model: settings.model,
    max_tokens: 8000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    system: settings.instructions,
    messages: [
      {
        role: 'user',
        content: `<idea>\n${ideaText(idea)}\n</idea>\n\n<team>\n${teamText(team)}\n</team>\n\nScore team fit from 1 to 5: how well this group's combined expertise matches what the idea needs. Pick the 2-3 members who would contribute most (one-line reason, suggested role) and list expertise gaps. Only use member ids from <team>.`,
      },
    ],
  })
  const result = JSON.parse(responseText(res)) as { score: number; explanation: string; team_fit: TeamFit }

  const criteria = ((current.criteria ?? []) as ScoredCriterion[]).map((c) =>
    c.key === 'team_fit' ? { ...c, score: Math.min(5, Math.max(1, Math.round(result.score))), explanation: result.explanation } : c,
  )
  const { error } = await admin
    .from('ai_analysis')
    .update({ team_fit: withNames(result.team_fit, team), criteria, overall_score: overall(criteria), updated_at: new Date().toISOString() })
    .eq('idea_id', ideaId)
  if (error) throw error
}
