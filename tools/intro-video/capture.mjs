// Captures demo screens of the Idea Pool app (mocked Supabase data) for the intro video.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const NM = '/home/user/idea-pool/node_modules/@dicebear'
const { createAvatar } = await import(`${NM}/core/lib/index.js`)
const styles = { fun: await import(`${NM}/fun-emoji/lib/index.js`), smile: await import(`${NM}/big-smile/lib/index.js`), adv: await import(`${NM}/adventurer/lib/index.js`) }
const av = (style, seed) => createAvatar(styles[style], { seed, size: 128, backgroundColor: ['b6e3f4', 'c0aede', 'ffd5dc', 'ffdfbf'], radius: 50 }).toDataUri()

const OUT = process.argv[2]
const BASE = 'http://localhost:4178'
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const uid = '11111111-1111-1111-1111-111111111111'
const exp = Math.floor(Date.now() / 1000) + 3600
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: uid, exp, role: 'authenticated' })}.sig`
const now = Date.now()
const iso = (minAgo) => new Date(now - minAgo * 60e3).toISOString()

const M = (id, name, color, avatar_url, extra = {}) => ({ id, user_id: id === 'm1' ? uid : 'x' + id, email: name.toLowerCase().replace(/\W/g, '') + '@example.com', display_name: name, avatar_color: color, avatar_url, role: 'member', created_at: iso(9000), intro_seen_at: iso(1), ...extra })
const me = M('m1', 'Jonas', '#6366f1', av('fun', 'jonas-7'))
const ruta = M('m2', 'Rūta K.', '#ec4899', av('smile', 'ruta-3'))
const tomas = M('m3', 'Tomas P.', '#10b981', av('adv', 'tomas-9'))
const egle = M('m4', 'Eglė S.', '#f59e0b', av('fun', 'egle-2'))
const mantas = M('m5', 'Mantas V.', '#0ea5e9', av('smile', 'mantas-5'))
const members = [me, ruta, tomas, egle, mantas]
const pub = (m) => ({ id: m.id, display_name: m.display_name, email: m.email, avatar_color: m.avatar_color, avatar_url: m.avatar_url })

const idea = (id, author, title, pitch, status, minAgo, tags, extra = {}) => ({ id, author_id: author.id, title, pitch, problem: '', solution: '', target_customer: '', revenue_model: '', tags, status, hidden: false, created_at: iso(minAgo), updated_at: iso(minAgo), author: pub(author), ...extra })
const ideas = [
  idea('i1', ruta, 'AI bookkeeping for Baltic micro-businesses', 'Snap a receipt, get compliant books and VAT returns in minutes.', 'shortlisted', 180, ['fintech', 'ai'], {
    problem: 'Sole traders in the Baltics lose ~6 hours a month on bookkeeping and fear VAT mistakes.',
    solution: 'A mobile app where AI reads receipts and invoices, books them and prepares VAT returns.',
    target_customer: 'Sole traders and micro-companies in Lithuania, Latvia and Estonia', revenue_model: '€19 per month subscription' }),
  idea('i2', tomas, 'EU grant co-pilot for SMEs', 'Find, write and win EU grants with an AI co-pilot.', 'shortlisted', 600, ['b2b', 'ai']),
  idea('i3', egle, 'Pre-loved kids’ gear subscription', 'Rent baby gear that grows with your child, then pass it on.', 'new', 1500, ['circular', 'consumer']),
  idea('i4', me, 'Dog walking marketplace', 'Trusted neighbours walk your dog while you work.', 'new', 2, ['marketplace']),
]
const likes = [['i1', ruta], ['i1', tomas], ['i1', egle], ['i1', mantas], ['i1', me], ['i2', me], ['i2', mantas], ['i3', ruta]].map(([idea_id, m]) => ({ idea_id, member_id: m.id, created_at: iso(30), member: pub(m) }))
const comments = [
  { id: 'c1', idea_id: 'i1', author_id: tomas.id, body: 'Love it! My accountant network in Vilnius could be our first pilot customers.', created_at: iso(95), updated_at: iso(95), author: pub(tomas) },
  { id: 'c2', idea_id: 'i1', author_id: egle.id, body: 'Big pain for my sister’s shop. Let’s check how we beat Dext on price.', created_at: iso(40), updated_at: iso(40), author: pub(egle) },
  { id: 'c3', idea_id: 'i1', author_id: me.id, body: 'Agreed, I’ll draft the pitch slide on the VAT angle 👍', created_at: iso(5), updated_at: iso(5), author: pub(me) },
]
const crit = (key, name, weight, score, explanation) => ({ key, name, weight, score, explanation })
const analysis = {
  i1: { idea_id: 'i1', status: 'done', overall_score: 3.9, analysed_at: iso(170), updated_at: iso(170), model: 'claude-sonnet-5-5', error: null,
    verdict: 'A frequent, well-understood pain with a simple subscription model. Competitors exist, so the pitch must show a sharp Baltic VAT and local-language wedge, plus a fast path to the first 100 paying users.',
    criteria: [crit('problem', 'Problem', 1.5, 5, 'Monthly bookkeeping is a recurring, stressful chore for sole traders.'), crit('uniqueness', 'Uniqueness & competition', 1.5, 3, 'Dext and Accountable exist, but none focus on Baltic VAT rules.'), crit('market', 'Market size', 1, 4, '~300k micro-businesses across the Baltics.'), crit('business_model', 'Business model', 1, 4, 'Clear €19/month SaaS pricing.'), crit('feasibility', 'Feasibility & time to MVP', 1, 4, 'MVP in ~3 months with OCR + LLM.'), crit('team_fit', 'Team fit', 1, 4, 'Strong finance and banking background.'), crit('pitch_appeal', 'Pitch appeal', 1.5, 4, 'Easy to demo live in 30 seconds.')],
    similar_companies: [{ name: 'Dext', url: 'https://dext.com', note: 'Receipt capture for accountants, not Baltic-specific.' }, { name: 'Accountable', url: 'https://accountable.eu', note: 'Freelancer tax app in BE/DE.' }],
    recommendations: ['Interview 10 sole traders this month', 'Partner with an accounting firm for distribution', 'Demo a live VAT return in the pitch'],
    investor_questions: ['What does it cost to acquire a customer?', 'Why won’t Dext add Baltic VAT?'],
    team_fit: { members: [{ member_id: 'm2', name: 'Rūta K.', reason: '10 years in Baltic SME banking.', role: 'CEO / partnerships' }, { member_id: 'm3', name: 'Tomas P.', reason: 'Built two fintech apps.', role: 'CTO' }], gaps: ['Tax law expert'] } },
  i2: { idea_id: 'i2', status: 'done', overall_score: 4.2, verdict: 'Strong B2B pain with clear willingness to pay.', criteria: [], team_fit: { members: [{ member_id: 'm3', name: 'Tomas P.', reason: '', role: '' }], gaps: [] }, analysed_at: iso(500), updated_at: iso(500) },
  i3: { idea_id: 'i3', status: 'done', overall_score: 3.3, criteria: [], team_fit: { members: [{ member_id: 'm4', name: 'Eglė S.', reason: '', role: '' }], gaps: [] }, analysed_at: iso(1400), updated_at: iso(1400) },
  i4: { idea_id: 'i4', status: 'running', overall_score: null, team_fit: null, updated_at: iso(1) },
}
const votes = [['i1', ruta, 3], ['i1', egle, 2], ['i1', me, 3], ['i2', tomas, 3], ['i2', mantas, 2], ['i2', me, 2]].map(([idea_id, m, points]) => ({ idea_id, member_id: m.id, points, member: pub(m) }))
const profile = { member_id: 'm1', linkedin_path: 'm1/linkedin.pdf', experience_text: '', summary_status: 'done', summary_error: null, updated_at: iso(60),
  skills_summary: 'Product & marketing leader, 12 yrs in Baltic retail\n• Brand strategy and go-to-market for consumer products\n• Led a 15-person digital marketing team\n• E-commerce growth: from 0 to €4M online sales\n• Industries: retail, FMCG, telecom\n• Languages: Lithuanian, English, Russian' }

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1' })
await ctx.addInitScript(([k, v]) => { localStorage.setItem(k, v); localStorage.setItem('idea-pool-install-hint-dismissed', '1') },
  ['sb-tciicfmrixbzyrkkjbnl-auth-token', JSON.stringify({ access_token: jwt, refresh_token: 'r', expires_at: exp, expires_in: 3600, token_type: 'bearer', user: { id: uid, email: me.email, aud: 'authenticated', role: 'authenticated' } })])
await ctx.route('**/tciicfmrixbzyrkkjbnl.supabase.co/**', async (route) => {
  const u = decodeURIComponent(route.request().url())
  const single = (route.request().headers()['accept'] || '').includes('vnd.pgrst.object')
  const byId = (rows, key = 'id') => { const m = u.match(new RegExp(`[?&]${key}=eq\\.([\\w-]+)`)); return m ? rows.filter((r) => r[key] === m[1]) : rows }
  let rows = []
  if (u.includes('/rest/v1/members')) rows = u.includes('user_id=eq') ? [me] : members
  else if (u.includes('/rest/v1/ideas')) rows = byId(u.includes('status=in') ? ideas.filter((i) => i.status !== 'new') : ideas)
  else if (u.includes('/rest/v1/likes')) rows = byId(likes, 'idea_id')
  else if (u.includes('/rest/v1/comments')) rows = byId(comments, 'idea_id')
  else if (u.includes('/rest/v1/ai_analysis')) rows = byId(Object.values(analysis), 'idea_id')
  else if (u.includes('/rest/v1/votes')) rows = votes
  else if (u.includes('/rest/v1/settings')) rows = [{ vote_budget: 5, voting_open: true }]
  else if (u.includes('/rest/v1/profiles')) rows = u.includes('member_id=eq') ? [profile] : [profile]
  else return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(single ? rows[0] ?? null : rows) })
})
const p = await ctx.newPage()
const errors = []
p.on('pageerror', (e) => errors.push(e.message))
const shot = (name) => p.screenshot({ path: `${OUT}/${name}.png` })
const scrollTo = (text, offset = 80) => p.evaluate(([t, o]) => { const el = [...document.querySelectorAll('h1,h2,h3,button,span,p')].find((e) => e.textContent.includes(t)); window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - o) }, [text, offset])

await p.goto(`${BASE}/`); await p.waitForSelector('text=EU grant co-pilot'); await p.waitForTimeout(400); await shot('feed')
await p.goto(`${BASE}/ideas/new`); await p.waitForSelector('#title')
await p.fill('#title', 'AI bookkeeping for Baltic micro-businesses'); await p.fill('#pitch', 'Snap a receipt, get compliant books and VAT returns in minutes.')
await p.fill('#problem', 'Sole traders lose ~6 hours a month on bookkeeping and fear VAT mistakes.'); await p.fill('#solution', 'AI reads receipts, books them and prepares the VAT return.')
await shot('form')
await p.goto(`${BASE}/ideas/i1`); await p.waitForSelector('text=Investor analysis'); await p.waitForTimeout(400)
await scrollTo('Investor analysis', 70); await p.waitForTimeout(200); await shot('analysis')
await scrollTo('Snap a receipt', 160); await p.waitForTimeout(200); await shot('detail-top')
await scrollTo('Discussion', 90); await p.waitForTimeout(200); await shot('comments')
await scrollTo('Team fit', 90); await p.waitForTimeout(200); await shot('teamfit')
await p.goto(`${BASE}/profile`); await p.waitForSelector('text=Fun emoji'); await p.waitForTimeout(500)
await scrollTo('Profile picture', 70); await p.waitForTimeout(200); await shot('avatar')
await scrollTo('My expertise', 70); await p.waitForTimeout(200); await shot('skills')
await p.goto(`${BASE}/shortlist`); await p.waitForSelector('text=EU grant co-pilot'); await p.waitForTimeout(300); await shot('shortlist')
await p.goto(`${BASE}/meeting`); await p.waitForSelector('text=EU grant co-pilot'); await p.click('text=AI bookkeeping'); await p.waitForSelector('text=Your vote'); await p.waitForTimeout(300); await shot('meeting')
console.log('errors', errors)
await browser.close()
