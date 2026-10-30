// Renders the 720x1280 video frames: caption on a branded background with the app screen in a phone frame.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const DIR = process.argv[2]
const img = (n) => `data:image/png;base64,${readFileSync(`${DIR}/shots/${n}.png`).toString('base64')}`
const icon = `data:image/svg+xml;base64,${readFileSync(`${DIR}/icon.svg`).toString('base64')}`

const css = `
  *{box-sizing:border-box;margin:0}
  body{width:720px;height:1280px;overflow:hidden;font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#fff;
    background:radial-gradient(circle at 20% 10%,#6d5df6 0%,#4338ca 35%,#1e1b4b 100%);}
  .blob{position:absolute;border-radius:50%;filter:blur(60px);opacity:.45}
  .top{position:absolute;top:70px;left:56px;right:56px}
  .chip{display:inline-block;background:rgba(255,255,255,.16);border-radius:999px;padding:8px 18px;font-weight:700;font-size:22px;letter-spacing:.04em}
  h1{font-size:56px;line-height:1.05;font-weight:900;margin-top:22px;letter-spacing:-.02em}
  p.sub{font-size:27px;line-height:1.3;margin-top:14px;color:#e0e7ff}
  .phone{position:absolute;left:50%;transform:translateX(-50%);top:360px;width:436px;height:944px;border-radius:58px;background:#0b0b14;padding:14px;
    box-shadow:0 40px 80px rgba(0,0,0,.45),0 0 0 2px rgba(255,255,255,.08)}
  .phone img{width:408px;height:883px;border-radius:44px;display:block;object-fit:cover;object-position:top}
  .notch{position:absolute;top:24px;left:50%;transform:translateX(-50%);width:110px;height:30px;border-radius:20px;background:#0b0b14;z-index:2}
  .center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:60px}
`
const blobs = `<div class="blob" style="width:420px;height:420px;background:#f472b6;top:-120px;right:-140px"></div><div class="blob" style="width:380px;height:380px;background:#fbbf24;bottom:-160px;left:-120px;opacity:.3"></div>`
const scene = (step, title, sub, shot) => `<style>${css}</style>${blobs}<div class="top"><span class="chip">${step}</span><h1>${title}</h1><p class="sub">${sub}</p></div>
  <div class="phone"><img src="${img(shot)}"></div>`
const card = (title, sub, extra = '') => `<style>${css}</style>${blobs}<div class="center"><img src="${icon}" style="width:190px;height:190px;border-radius:48px;box-shadow:0 30px 60px rgba(0,0,0,.4)">
  <h1 style="font-size:84px;margin-top:44px">${title}</h1><p class="sub" style="font-size:32px;margin-top:20px">${sub}</p>${extra}</div>`

const frames = {
  intro: card('Idea Pool', 'Startup ideas for our EMBA investor pitch', '<p class="sub" style="margin-top:60px;font-size:24px;opacity:.8">▶ 30-second tour</p>'),
  feed: scene('1 / 5 · POST', 'Share your ideas', 'Tap ＋ — a title and a one-line pitch is enough to start.', 'feed'),
  form: scene('1 / 5 · POST', 'Share your ideas', 'Tap ＋ — a title and a one-line pitch is enough to start.', 'form'),
  analysis: scene('2 / 5 · AI', 'Claude analyses every idea', 'Competitors from the web, investor scores and tips — in about 2 minutes.', 'analysis'),
  likes: scene('3 / 5 · DISCUSS', 'Like & discuss', '❤️ your favourites and comment to make them stronger.', 'detail-top'),
  comments: scene('3 / 5 · DISCUSS', 'Like & discuss', '❤️ your favourites and comment to make them stronger.', 'comments'),
  avatar: scene('4 / 5 · YOU', 'Show what you’re great at', 'Pick a fun avatar and upload your LinkedIn PDF.', 'avatar'),
  teamfit: scene('4 / 5 · YOU', 'Show what you’re great at', 'Claude matches people to the ideas they fit best.', 'teamfit'),
  shortlist: scene('5 / 5 · DECIDE', 'Vote & pick the winner 🏆', 'Spend your points on the shortlist, then decide together in meeting mode.', 'shortlist'),
  meeting: scene('5 / 5 · DECIDE', 'Vote & pick the winner 🏆', 'Spend your points on the shortlist, then decide together in meeting mode.', 'meeting'),
  outro: card('Let’s go! 🚀', 'Post your first idea today'),
}
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } })
for (const [name, html] of Object.entries(frames)) {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`)
  await page.waitForTimeout(150)
  await page.screenshot({ path: `${DIR}/frames/${name}.png` })
}
await browser.close()
console.log('ok')
