import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ---------- SSRF-safe fetcher ----------
function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true;
  const parts = ip.split('.').map(n => parseInt(n, 10));
  if (parts.length !== 4 || parts.some(n => isNaN(n))) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

interface FetchResult { html: string; finalUrl: string; status: number; ms: number; bytes: number; }

async function safeFetchHtml(rawUrl: string, method: 'GET' | 'HEAD' = 'GET'): Promise<FetchResult | null> {
  let target: URL;
  try { target = new URL(rawUrl); } catch { return null; }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') return null;
  const host = target.hostname.toLowerCase();
  if (['localhost', 'metadata.google.internal'].includes(host) || host.endsWith('.local') || host.endsWith('.internal')) return null;
  try {
    const records = await Promise.allSettled([Deno.resolveDns(host, 'A'), Deno.resolveDns(host, 'AAAA')]);
    for (const r of records) if (r.status === 'fulfilled') for (const ip of r.value) if (isPrivateIp(ip)) return null;
  } catch { /* allow */ }
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 12000);
  const t0 = Date.now();
  try {
    const res = await fetch(target.toString(), {
      method, redirect: 'follow', signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 ProjectBondCustomerTester/1.0' },
    });
    clearTimeout(tid);
    const text = method === 'HEAD' ? '' : await res.text();
    return { html: text.slice(0, 250_000), finalUrl: res.url, status: res.status, ms: Date.now() - t0, bytes: text.length };
  } catch { clearTimeout(tid); return null; }
}

// ---------- Evidence extractor ----------
function extractCustomerEvidence(html: string, baseUrl: string) {
  const origin = new URL(baseUrl).origin;
  const title = (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '').trim().slice(0, 200);
  const description = (html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)?.[1] || '').slice(0, 300);
  const viewport = !!html.match(/<meta\s+name=["']viewport["']/i);
  const lang = (html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1] || '');

  const headings: { tag: string; text: string }[] = [];
  const hRe = /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let hm: RegExpExecArray | null;
  while ((hm = hRe.exec(html)) && headings.length < 25) {
    const text = hm[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text) headings.push({ tag: hm[1].toLowerCase(), text: text.slice(0, 120) });
  }
  const h1Count = headings.filter(h => h.tag === 'h1').length;

  const ctas: string[] = [];
  const btnRe = /<(?:button|a)\b[^>]*>([\s\S]*?)<\/(?:button|a)>/gi;
  let bm: RegExpExecArray | null;
  while ((bm = btnRe.exec(html)) && ctas.length < 40) {
    const t = bm[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (t && t.length > 1 && t.length < 60) ctas.push(t);
  }

  const imgs = [...html.matchAll(/<img\b([^>]*)>/gi)].slice(0, 80);
  const imgTotal = imgs.length;
  const imgsMissingAlt = imgs.filter(m => !/\balt=["'][^"']+["']/i.test(m[1])).length;

  const forms: { method: string; action: string; fields: string[]; hasLabels: boolean; isAuth: boolean }[] = [];
  const formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let fm: RegExpExecArray | null;
  while ((fm = formRe.exec(html)) && forms.length < 10) {
    const attrs = fm[1], body = fm[2];
    const action = attrs.match(/action=["']([^"']+)["']/i)?.[1] || baseUrl;
    const method = (attrs.match(/method=["']([^"']+)["']/i)?.[1] || 'get').toLowerCase();
    const fields: string[] = [];
    const inRe = /<(?:input|select|textarea)\b[^>]*name=["']([^"']+)["'][^>]*>/gi;
    let im: RegExpExecArray | null;
    while ((im = inRe.exec(body)) && fields.length < 15) fields.push(im[1]);
    const hasLabels = /<label\b/i.test(body);
    const isAuth = /password|email|username|login|signin/i.test(body) || /password|email|username/i.test(fields.join(' '));
    forms.push({ method, action, fields, hasLabels, isAuth });
  }

  const links: { href: string; text: string; external: boolean }[] = [];
  const linkRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  let lm: RegExpExecArray | null;
  while ((lm = linkRe.exec(html)) && links.length < 200) {
    const href = lm[1].trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    let abs: string; try { abs = new URL(href, baseUrl).toString(); } catch { continue; }
    if (seen.has(abs)) continue; seen.add(abs);
    const text = lm[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
    links.push({ href: abs, text, external: !abs.startsWith(origin) });
  }

  const navText = (html.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/i)?.[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
  const footerText = (html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/i)?.[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);

  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 1200);

  // Real signals a human would care about
  const looksEmpty = bodyText.length < 80;
  const isSpaShell = looksEmpty && /<div[^>]+id=["'](root|app|__next)["']/i.test(html);
  const hasConsoleError = /Uncaught|TypeError|ReferenceError|throw new Error/i.test(html);
  const inlineScripts = (html.match(/<script\b(?![^>]*\bsrc=)[^>]*>/gi) || []).length;
  const scriptTags = (html.match(/<script\b/gi) || []).length;
  const cssTags = (html.match(/<link[^>]+rel=["']stylesheet["']/gi) || []).length;
  const totalBytes = html.length;

  return {
    title, description, viewport, lang,
    headings: headings.slice(0, 15), h1Count,
    ctas: ctas.slice(0, 25),
    imgTotal, imgsMissingAlt,
    forms, links,
    navText, footerText, bodyText,
    looksEmpty, isSpaShell, hasConsoleError,
    scriptTags, inlineScripts, cssTags, totalBytes,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { url, company_name, scan_id } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: 'URL is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Learn from prior thumbs up/down + ignored
    const { data: feedbackRows } = await adminClient
      .from('scan_issues').select('title, category, feedback, status')
      .eq('user_id', user.id).or('feedback.not.is.null,status.eq.ignored')
      .order('created_at', { ascending: false }).limit(80);
    const goodEx = (feedbackRows || []).filter(r => r.feedback === 'good').slice(0, 15);
    const badEx = (feedbackRows || []).filter(r => r.feedback === 'bad' || r.status === 'ignored').slice(0, 25);
    const trainingBlock = (goodEx.length || badEx.length)
      ? `\n\nUSER FEEDBACK MEMORY:\nGOOD findings the user kept (produce MORE like these):\n${goodEx.map(r => `- [${r.category}] ${r.title}`).join('\n') || '(none)'}\n\nBAD / IGNORED findings the user dismissed (AVOID raising similar):\n${badEx.map(r => `- [${r.category}] ${r.title}`).join('\n') || '(none)'}`
      : '';

    // ---------- Full-site crawl, login/checkout prioritized ----------
    const MAX_PAGES = 60;
    const MAX_TIME_MS = 75_000;
    const startedAt = Date.now();
    const pages: { url: string; status: number; ms: number; ev: ReturnType<typeof extractCustomerEvidence> }[] = [];
    const broken: { url: string; status: number; from: string }[] = [];
    let crawlNote = '';

    const home = await safeFetchHtml(url);
    if (!home) {
      crawlNote = `CRAWL FAILED: could not reach ${url}. Network error, DNS, or server down. This itself is a critical finding.`;
    } else {
      const origin = new URL(home.finalUrl).origin;
      const followed = new Set<string>([home.finalUrl]);
      const queue: { href: string; from: string }[] = [];

      const HIGH_VALUE_RE = /\/(login|signin|sign-in|signup|sign-up|register|account|checkout|cart|billing|payment|pay|auth|contact|support|help|reset|forgot|password|dashboard|profile|settings)(\/|$|\?)/i;
      const prioritize = () => queue.sort((a, b) => (HIGH_VALUE_RE.test(b.href) ? 1 : 0) - (HIGH_VALUE_RE.test(a.href) ? 1 : 0));

      // Seed from sitemap
      try {
        const sm = await safeFetchHtml(new URL('/sitemap.xml', origin).toString());
        if (sm && sm.status < 400) {
          const locs = [...sm.html.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1]).slice(0, 200);
          for (const u of locs) if (u.startsWith(origin) && !followed.has(u)) queue.push({ href: u, from: 'sitemap.xml' });
        }
      } catch { /* ignore */ }

      // Probe common auth paths even if not linked
      for (const p of ['/login', '/signin', '/sign-in', '/signup', '/register', '/account', '/contact', '/pricing', '/checkout']) {
        const u = new URL(p, origin).toString();
        if (!followed.has(u)) queue.push({ href: u, from: 'probe' });
      }

      // Process homepage
      const homeEv = extractCustomerEvidence(home.html, home.finalUrl);
      pages.push({ url: home.finalUrl, status: home.status, ms: home.ms, ev: homeEv });
      for (const l of homeEv.links) {
        if (!l.external && !followed.has(l.href)) queue.push({ href: l.href, from: home.finalUrl });
      }
      prioritize();

      while (pages.length < MAX_PAGES && queue.length && Date.now() - startedAt < MAX_TIME_MS) {
        const batch = queue.splice(0, 6).filter(q => !followed.has(q.href));
        if (!batch.length) continue;
        for (const b of batch) followed.add(b.href);
        const results = await Promise.all(batch.map(async (b) => ({ b, p: await safeFetchHtml(b.href) })));
        for (const { b, p } of results) {
          if (!p) { broken.push({ url: b.href, status: 0, from: b.from }); continue; }
          if (p.status >= 400) { broken.push({ url: p.finalUrl, status: p.status, from: b.from }); continue; }
          const ev = extractCustomerEvidence(p.html, p.finalUrl);
          pages.push({ url: p.finalUrl, status: p.status, ms: p.ms, ev });
          for (const l of ev.links) {
            if (!l.external && !followed.has(l.href)) queue.push({ href: l.href, from: p.finalUrl });
          }
        }
        prioritize();
      }

      // HEAD-check more links for dead links
      const allLinks = new Set<string>();
      for (const p of pages) for (const l of p.ev.links) allLinks.add(l.href);
      const sample = [...allLinks].filter(h => !followed.has(h)).slice(0, 80);
      await Promise.all(sample.map(async (href) => {
        const r = await safeFetchHtml(href, 'HEAD');
        if (!r) broken.push({ url: href, status: 0, from: home.finalUrl });
        else if (r.status >= 400) broken.push({ url: r.finalUrl, status: r.status, from: home.finalUrl });
      }));
    }

    // ---------- Build evidence summary ----------
    const slowPages = pages.filter(p => p.ms > 3000).map(p => `${p.url} (${p.ms}ms)`);
    const emptyPages = pages.filter(p => p.ev.looksEmpty || p.ev.isSpaShell);
    const authPages = pages.filter(p => /login|signin|signup|register|account|auth|password/i.test(p.url) || p.ev.forms.some(f => f.isAuth));
    const formPages = pages.filter(p => p.ev.forms.length > 0);

    // SPA detection: if most pages look empty AND have a root/app mount + scripts, this is an SPA.
    // The raw-HTML crawler cannot see the rendered app — treat as LOW CONFIDENCE, not "broken".
    const spaShellRatio = pages.length ? emptyPages.length / pages.length : 0;
    const isSpaApp = pages.length > 0 && spaShellRatio >= 0.5 && pages.some(p => p.ev.scriptTags >= 1);
    const lowConfidence = isSpaApp || pages.length <= 2;
    const confidenceNote = isSpaApp
      ? `\n\n⚠ SPA DETECTED: ${emptyPages.length}/${pages.length} pages render their content via JavaScript. The raw-HTML crawler cannot see the rendered app, so it could NOT verify the real product UI, login flow, or authenticated areas. This is a CRAWLER LIMITATION, not a product defect. Coverage is INCOMPLETE and confidence is LOW. Do NOT flag pages as "empty" or "broken" on that basis — at most note SSR/SEO once across the whole site.`
      : '';

    const evidenceSummary = pages.length
      ? pages.slice(0, 25).map(p => `URL: ${p.url} (HTTP ${p.status}, ${p.ms}ms, ${p.ev.totalBytes}b)
Title: ${p.ev.title || '(MISSING)'}
H1 count: ${p.ev.h1Count} | Headings: ${p.ev.headings.slice(0, 6).map(h => `${h.tag}:"${h.text}"`).join(' | ')}
CTAs in raw HTML (${p.ev.ctas.length}): ${p.ev.ctas.slice(0, 12).join(' | ') || '(none in raw HTML — may be JS-rendered)'}
Forms in raw HTML: ${p.ev.forms.map(f => `[${f.method.toUpperCase()} action=${f.action} fields=${f.fields.join(',')} labels=${f.hasLabels} isAuth=${f.isAuth}]`).join(' ') || 'none in raw HTML'}
Raw-HTML empty: ${p.ev.looksEmpty} | SPA shell: ${p.ev.isSpaShell} | JS error tokens: ${p.ev.hasConsoleError}
Scripts: ${p.ev.scriptTags} | CSS: ${p.ev.cssTags}`).join('\n\n---\n\n')
      : crawlNote;

    const brokenBlock = broken.length
      ? `\n\nBROKEN / DEAD LINKS (${broken.length} total — each is a real finding):\n${broken.slice(0, 25).map(b => `- ${b.url} → HTTP ${b.status || 'unreachable'} (from ${b.from})`).join('\n')}`
      : '';
    const summaryStats = `\n\nCRAWL STATS:\n- Pages crawled: ${pages.length}\n- Broken links: ${broken.length}\n- Slow pages (>3s): ${slowPages.length}${slowPages.length ? '\n  ' + slowPages.slice(0, 5).join('\n  ') : ''}\n- SPA-shell pages (JS-rendered, crawler cannot see UI): ${emptyPages.length}\n- Auth pages found in raw HTML: ${authPages.length}${authPages.length ? '\n  ' + authPages.map(p => p.url).slice(0, 5).join('\n  ') : ''}\n- Pages with raw-HTML forms: ${formPages.length}${confidenceNote}`;

    // ---------- AI call ----------
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are ProjectBond V2 — an AUTOMATED QA system. You are NOT a human. Judge rubrics + observable evidence only. Never invent users, reviews, sentiment, or media coverage.

=== CRAWLER LIMITATION (READ FIRST) ===
This crawler reads RAW HTML only — it does NOT execute JavaScript. Modern React/Vite/Next SPAs serve <div id="root"></div> + scripts; the real UI is rendered client-side. When CRAWL STATS says "SPA DETECTED" or a page is a "SPA shell":
- This is a CRAWLER LIMITATION, not a product bug.
- DO NOT flag pages as "empty", "broken", "blank", "dead", "renders nothing", or "no content".
- DO NOT claim login/signup/CTA/nav is missing just because raw HTML didn't show it — the real UI is JS-rendered.
- DO NOT flag "no SSR" per page. At MOST raise ONE low-priority SEO/SSR note for the whole site, never per page, never critical.
- Mark coverage as INCOMPLETE and confidence LOW. Report which app sections you could NOT verify.

=== PRIORITY ORDER ===
1. Real broken links (HTTP 4xx/5xx) listed in BROKEN / DEAD LINKS — these are real and reproducible.
2. Real raw-HTML forms with concrete problems (e.g. an auth form present with no <label>) — only if the form actually appears in raw HTML.
3. Crawler reachability issues (DNS fail, 5xx on homepage, redirect loops).
4. SEO/meta only as low-priority, max 1-2 total.

=== NEVER RAISE ===
- "Empty page", "blank page", "SPA shell", "no content", "renders nothing without JS" as critical or per-page. (One site-wide low note max.)
- Missing login/signup just because /login wasn't found in raw HTML — JS routers hide it from the crawler.
- Missing H1, favicon, og:image, share preview, meta description length, footer, testimonials, "trusted by", social proof, generic CTA wording.
- Duplicate findings of the same type. Group "empty without JS" into ONE site-wide finding, not 10.
- Speculation, vibes, color/aesthetic critique, or anything you can't point to a URL + concrete observable for.

=== SEVERITY ===
- critical = a real user is blocked RIGHT NOW with hard evidence: confirmed 5xx, confirmed broken link to a primary path, redirect loop, raw-HTML auth form with no labels.
- warning = real but not blocking: dead link to secondary page, slow page (>3s), real-HTML form missing accessible labels.
- low = SEO/meta/cosmetic. CAP AT 2 LOW TOTAL across the whole report.

=== EVERY FINDING MUST INCLUDE ===
title, description, category, priority, location (real URL), repro_steps, expected, actual, user_impact, fix_dev. If you cannot fill repro_steps with concrete clicks → don't raise it.

=== SCORING (be calibrated, NOT harsh) ===
- An SPA whose homepage returns 200 and has zero broken links should score 78-92. The crawler's inability to see the rendered UI is NOT the site's fault.
- One real critical (confirmed 5xx / broken primary link / redirect loop): 55-70.
- Multiple confirmed criticals: 30-55.
- Never output 100. Never claim a score on something you couldn't test.

=== RUBRIC (max 100) ===
- product_access (0-20): cap at 10 if crawler couldn't enter auth area (almost always true for SPA).
- flow_quality (0-25): cap at 12 if SPA detected and no flows were actually exercised.
- functional_quality (0-25): score what was actually observed (broken links, 5xx, raw-HTML forms). Default ~18 if nothing broken was found.
- ux_friction_quality (0-15): only score what you observed. Default 10 when no evidence either way.
- evidence_quality (0-15): based on how well YOUR findings are sourced. If you raised noise findings, lose points here.

=== COVERAGE HONESTY ===
In ai_summary explicitly say: pages discovered vs tested, whether SPA was detected, whether authenticated area could NOT be verified, and confidence (low/medium/high). If SPA detected: "Confidence: LOW — only raw HTML inspected; the rendered React/SPA app could not be tested by this crawler."

Quality over quantity: 2-6 findings. Criticals first. Duplicates banned.${trainingBlock}`,
          },
          {
            role: 'user',
            content: `Audit this site per ProjectBond V2 directive: ${url}${company_name ? ` (Company: ${company_name})` : ''}

CRAWL EVIDENCE (ground truth — do not invent beyond this):
${evidenceSummary}${brokenBlock}${summaryStats}

Produce findings with repro_steps, expected, actual, user_impact, and a concrete fix. Fill the rubric scores honestly and a benchmark_note (1-2 sentences) comparing to typical sites of this kind.`,
          },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'website_analysis',
            description: 'Evidence-backed customer-tester analysis',
            parameters: {
              type: 'object',
              properties: {
                health_score: { type: 'integer', description: '0-100 overall. Calibrated: working site 75-90, one critical 40-65, multiple criticals <30. Never 100.' },
                security_score: { type: 'integer' },
                sentiment_score: { type: 'integer' },
                product_access: { type: 'integer', description: '0-20 per rubric' },
                flow_quality: { type: 'integer', description: '0-25 per rubric' },
                functional_quality: { type: 'integer', description: '0-25 per rubric' },
                ux_friction_quality: { type: 'integer', description: '0-15 per rubric' },
                evidence_quality: { type: 'integer', description: '0-15 per rubric' },
                coverage: {
                  type: 'object',
                  properties: {
                    pages_discovered: { type: 'integer' },
                    pages_tested: { type: 'integer' },
                    pages_skipped: { type: 'integer' },
                    authenticated_area_reached: { type: 'boolean' },
                    notes: { type: 'string' },
                  },
                },
                ai_summary: { type: 'string', description: '3-4 sentences: what was actually tested (pages discovered/tested/skipped), whether authenticated area was reached, top issue. If only public pages tested, say so explicitly.' },
                benchmark_note: { type: 'string', description: 'How this site compares to typical sites of its type.' },
                brand_analysis: {
                  type: 'object',
                  properties: {
                    tone: { type: 'string' },
                    positioning: { type: 'string' },
                    customer_expectations: { type: 'string' },
                    differentiator: { type: 'string' },
                  },
                  required: ['tone', 'positioning', 'customer_expectations', 'differentiator'],
                },
                issues: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string' },
                      description: { type: 'string' },
                      category: { type: 'string', enum: ['auth', 'broken', 'form', 'navigation', 'cta', 'clarity', 'trust', 'content', 'accessibility', 'performance', 'mobile', 'security'] },
                      priority: { type: 'string', enum: ['critical', 'warning', 'low'] },
                      impact: { type: 'string' },
                      location: { type: 'string' },
                      repro_steps: { type: 'string' },
                      expected: { type: 'string' },
                      actual: { type: 'string' },
                      user_impact: { type: 'string' },
                      fix_dev: { type: 'string' },
                      fix_code: { type: 'string' },
                      fix_nocode: { type: 'string' },
                      fix_content: { type: 'string' },
                      fix_visual: { type: 'string' },
                    },
                    required: ['title', 'description', 'category', 'priority', 'impact', 'location'],
                  },
                },
              },
              required: ['health_score', 'security_score', 'sentiment_score', 'ai_summary', 'brand_analysis', 'issues'],
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'website_analysis' } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text().catch(() => '');
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited, please try again later' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Add funds in Settings > Workspace > Usage.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      console.error('AI error:', aiResponse.status, errorText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('No analysis returned from AI');
    const analysis = JSON.parse(toolCall.function.arguments);

    // ---------- Deterministic severity normalizer ----------
    // Aggressively drop crawler-limitation noise + generic SEO complaints.
    const NOISE_DROP = /(favicon|og:image|og image|share preview|meta description|missing h1|no h1|footer (is )?missing|missing footer|testimonial|trusted by|social proof|alt text on decorative|generic cta|spa shell|no ssr|renders empty without js|page is empty|blank page|no server[- ]rendered|empty body|no content in raw html)/i;
    const COSMETIC_TITLE = /(meta tag|seo|robots\.txt|sitemap|open graph)/i;
    const FUNCTIONAL_TITLE = /(broken link|404|500|5xx|redirect loop|silently fails|does nothing|crash|hangs?|api (error|fail)|cors error)/i;
    const AUTH_TITLE = /(login (broken|fails|404)|signup (broken|fails)|password reset broken|auth.* broken)/i;
    const PAYMENT_TITLE = /(checkout broken|payment fails|billing broken|cart broken)/i;
    const JOURNEY_TITLE = /(no navigation found|dead[- ]end|redirect loop|mobile menu broken)/i;

    function HIGH_VALUE(u: string) { return /\/(login|signin|signup|register|account|checkout|cart|pay|auth|contact)(\/|$|\?)/i.test(u); }

    // Seed deterministic findings ONLY from hard evidence (no guessing).
    const deterministic: any[] = [];
    if (!pages.length) {
      deterministic.push({ title: `Site unreachable: ${url}`, description: 'Crawler could not load the URL. Real users will see the same failure.', category: 'broken', priority: 'critical', impact: 'Every visitor blocked.', location: url, repro_steps: `Open ${url} in a fresh browser.`, expected: 'Page loads with HTTP 200.', actual: 'Connection failed / DNS error / timeout.', user_impact: 'Nobody can reach the site.', fix_dev: 'Check DNS, hosting, SSL certificate, and origin server health.' });
    }
    for (const b of broken.slice(0, 8)) {
      deterministic.push({
        title: `Broken link → ${b.url}`,
        description: `Returns HTTP ${b.status || 'unreachable'}, linked from ${b.from}.`,
        category: 'broken',
        priority: HIGH_VALUE(b.url) ? 'critical' : 'warning',
        impact: 'User hits a dead end.',
        location: b.url,
        repro_steps: `On ${b.from}, click the link to ${b.url}.`,
        expected: 'Destination loads with HTTP 200.',
        actual: `HTTP ${b.status || 'unreachable / network error'}.`,
        user_impact: 'User abandons or loses trust.',
        fix_dev: 'Fix the destination URL, restore the page, or remove the link.',
      });
    }
    // Auth form with no labels — only when an auth form was ACTUALLY seen in raw HTML.
    for (const p of pages) {
      for (const f of p.ev.forms) {
        if (f.isAuth && !f.hasLabels) {
          deterministic.push({ title: `Auth form on ${p.url} has no <label> elements`, description: 'A login/signup form was found in raw HTML with no <label>s. Screen readers and password managers struggle.', category: 'accessibility', priority: 'warning', impact: 'Assistive-tech users struggle to sign in.', location: p.url, repro_steps: `Open ${p.url} with a screen reader and Tab through the form.`, expected: 'Each field announces its label.', actual: 'Fields announce nothing.', user_impact: 'Users on screen readers cannot reliably complete sign-in.', fix_dev: 'Wrap each input in <label> or add matching for/id.' });
        }
      }
    }
    // SPA / SSR — ONE single low-priority note for the whole site (never per page, never critical).
    if (isSpaApp) {
      deterministic.push({
        title: 'Site renders content via JavaScript (no server-side HTML)',
        description: `The site is a JavaScript-rendered app. This is normal for React/Vite/Next-client apps, but it limits SEO crawlers and link-preview bots. NOTE: this also means ProjectBond's HTML crawler could NOT verify the in-app UI, login flow, or authenticated areas — those need to be tested in a real browser.`,
        category: 'performance',
        priority: 'low',
        impact: 'SEO and link previews may not see content. Crawler coverage is limited.',
        location: url,
        repro_steps: 'View page source on the homepage and compare to what renders in a browser.',
        expected: 'Key content visible in the initial HTML.',
        actual: 'Initial HTML is mostly an empty shell + script tags.',
        user_impact: 'Real users see the app fine; search engines / crawlers may not.',
        fix_dev: 'Consider SSR / pre-rendering (Next.js, Astro, React Router SSR) for marketing pages if SEO matters.',
      });
    }

    if (!Array.isArray(analysis.issues)) analysis.issues = [];
    analysis.issues.push(...deterministic);

    // Drop crawler-limitation noise + cosmetic complaints
    analysis.issues = analysis.issues.filter((it: any) => {
      const blob = `${it.title || ''} ${it.description || ''}`;
      if (NOISE_DROP.test(blob) && !/broken link|http (4|5)\d\d|redirect loop/i.test(blob)) {
        // exception: keep our own single SPA note
        return /renders content via javascript/i.test(it.title || '');
      }
      return true;
    });

    // Dedupe by title AND by category+location signature (so 10 "empty page" findings collapse)
    const seenKey = new Set<string>();
    analysis.issues = analysis.issues.filter((it: any) => {
      const title = String(it.title || '').toLowerCase().trim();
      const sig = `${(it.category || '').toLowerCase()}|${String(it.location || '').toLowerCase().trim()}|${title.slice(0, 40)}`;
      if (!title || seenKey.has(title) || seenKey.has(sig)) return false;
      seenKey.add(title);
      seenKey.add(sig);
      return true;
    });

    // Enforce severity walls (much narrower now — only escalate on REAL evidence patterns)
    for (const it of analysis.issues) {
      const t = `${it.title || ''} ${it.description || ''}`;
      if (FUNCTIONAL_TITLE.test(t) && it.priority !== 'critical') it.priority = it.category === 'broken' ? 'critical' : 'warning';
      if (AUTH_TITLE.test(t) || PAYMENT_TITLE.test(t)) it.priority = 'critical';
      if (COSMETIC_TITLE.test(t)) it.priority = 'low';
      if (it.category === 'broken' && it.priority === 'low') it.priority = 'warning';
    }

    // Sort + cap low to 2
    const rank: Record<string, number> = { critical: 0, warning: 1, low: 2 };
    analysis.issues.sort((a: any, b: any) => (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3));
    let lowKept = 0;
    analysis.issues = analysis.issues.filter((it: any) => {
      if (it.priority !== 'low') return true;
      lowKept++;
      return lowKept <= 2;
    });

    // Re-weighted deterministic score
    const weightFor = (it: any): { bucket: string; weight: number } => {
      const t = `${it.title || ''} ${it.description || ''}`;
      if (AUTH_TITLE.test(t) || PAYMENT_TITLE.test(t)) return { bucket: 'functional', weight: 55 };
      if (it.category === 'broken' || it.category === 'form' || it.category === 'auth' || FUNCTIONAL_TITLE.test(t)) return { bucket: 'functional', weight: 55 };
      if (it.category === 'navigation' || it.category === 'cta' || it.category === 'clarity' || JOURNEY_TITLE.test(t)) return { bucket: 'journey', weight: 25 };
      if (it.category === 'performance') return { bucket: 'perf', weight: 10 };
      if (it.category === 'accessibility' || it.category === 'mobile') return { bucket: 'a11y', weight: 7 };
      return { bucket: 'marketing', weight: 3 };
    };
    const sevPenalty = (p: string) => (p === 'critical' ? 1 : p === 'warning' ? 0.45 : 0.1);
    const maxBucket: Record<string, number> = { functional: 55, journey: 25, perf: 10, a11y: 7, marketing: 3 };
    const usedBucket: Record<string, number> = { functional: 0, journey: 0, perf: 0, a11y: 0, marketing: 0 };
    let totalPenalty = 0;
    for (const it of analysis.issues) {
      const { bucket, weight } = weightFor(it);
      const pen = weight * sevPenalty(it.priority || 'low');
      const headroom = Math.max(0, maxBucket[bucket] - usedBucket[bucket]);
      const applied = Math.min(pen, headroom);
      usedBucket[bucket] += applied;
      totalPenalty += applied;
    }
    const computed = Math.max(0, Math.min(100, Math.round(100 - totalPenalty)));
    const aiScore = typeof analysis.health_score === 'number' ? analysis.health_score : computed;
    const rubricSum =
      (Number(analysis.product_access) || 0) +
      (Number(analysis.flow_quality) || 0) +
      (Number(analysis.functional_quality) || 0) +
      (Number(analysis.ux_friction_quality) || 0) +
      (Number(analysis.evidence_quality) || 0);
    const hasRubric = rubricSum > 0;
    let blended = hasRubric
      ? Math.round(computed * 0.5 + aiScore * 0.2 + rubricSum * 0.3)
      : Math.round(computed * 0.75 + aiScore * 0.25);

    // SPA + no hard failures = working site the crawler just can't see. Don't punish for crawler blindness.
    const hardCriticals = analysis.issues.filter((i: any) => i.priority === 'critical' && (i.category === 'broken' || /broken link|http (4|5)\d\d|redirect loop/i.test(`${i.title} ${i.description}`))).length;
    if (isSpaApp && hardCriticals === 0 && pages.length > 0) {
      blended = Math.max(blended, 78); // floor for "site loads, nothing actually broken"
    }
    if (pages.length > 0 && broken.length === 0 && analysis.issues.filter((i: any) => i.priority === 'critical').length === 0) {
      blended = Math.max(blended, 72);
    }

    analysis.health_score = Math.min(95, Math.max(0, blended));
    analysis.confidence = lowConfidence ? 'low' : (pages.length >= 10 ? 'high' : 'medium');

    const coverageLine = `Coverage: ${pages.length} pages crawled via raw HTML. ${isSpaApp ? 'SPA detected — rendered React/Vite app could NOT be tested by this crawler. The real product UI, login flow, and authenticated areas are UNVERIFIED.' : 'Authenticated area not reached by automated crawler.'} Confidence: ${analysis.confidence.toUpperCase()}.`;
    const rubricLine = hasRubric
      ? `Rubric — Access ${analysis.product_access}/20 · Flows ${analysis.flow_quality}/25 · Functional ${analysis.functional_quality}/25 · UX ${analysis.ux_friction_quality}/15 · Evidence ${analysis.evidence_quality}/15.`
      : '';
    if (analysis.benchmark_note) {
      analysis.ai_summary = `${analysis.ai_summary || ''}\n\n${coverageLine}\n${rubricLine}\nBenchmark: ${analysis.benchmark_note}`.trim();
    } else {
      analysis.ai_summary = `${analysis.ai_summary || ''}\n\n${coverageLine}\n${rubricLine}`.trim();
    }

    // ---------- Persist ----------
    const scanData = {
      user_id: user.id,
      url,
      scan_type: 'full',
      status: 'completed',
      health_score: analysis.health_score,
      security_score: analysis.security_score,
      sentiment_score: analysis.sentiment_score,
      ai_summary: analysis.ai_summary,
      brand_analysis: analysis.brand_analysis,
    };

    let finalScanId = scan_id;
    if (scan_id) {
      const { data: updated, error: updErr } = await adminClient.from('scans').update(scanData).eq('id', scan_id).eq('user_id', user.id).select('id');
      if (updErr) throw updErr;
      if (!updated || updated.length === 0) {
        return new Response(JSON.stringify({ error: 'Scan not found or not owned by user' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } else {
      const { data: newScan, error: scanError } = await adminClient.from('scans').insert(scanData).select('id').single();
      if (scanError) throw scanError;
      finalScanId = newScan.id;
    }

    if (analysis.issues && analysis.issues.length > 0) {
      const issueRows = analysis.issues.map((issue: any) => ({
        scan_id: finalScanId,
        user_id: user.id,
        title: issue.title,
        description: issue.description,
        category: ['performance', 'accessibility', 'content', 'security'].includes(issue.category) ? issue.category : 'qa',
        priority: issue.priority,
        impact: issue.impact,
        location: issue.location,
        fix_dev: issue.fix_dev || null,
        fix_code: issue.fix_code || null,
        fix_nocode: issue.fix_nocode || null,
        fix_content: issue.fix_content || null,
        fix_visual: issue.fix_visual || null,
        expected_result: issue.expected || null,
        actual_result: issue.actual || null,
        reproduction_steps: issue.repro_steps ? { steps: issue.repro_steps, user_impact: issue.user_impact || null } : null,
        source_engine: 'ai_analysis',
      }));
      const { error: issuesError } = await adminClient.from('scan_issues').insert(issueRows);
      if (issuesError) console.error('Issues insert error:', issuesError);
    }

    if (analysis.brand_analysis && company_name) {
      await adminClient.from('branding').upsert({
        user_id: user.id,
        company_name,
        tone: analysis.brand_analysis.tone,
        positioning: analysis.brand_analysis.positioning,
      }, { onConflict: 'user_id' });
    }

    return new Response(JSON.stringify({ scan_id: finalScanId, ...analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('analyze-website error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
