import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ---- SSRF-safe HTML crawler (free, no paid APIs) ----
function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true;
  const parts = ip.split('.').map(n => parseInt(n, 10));
  if (parts.length !== 4 || parts.some(n => isNaN(n))) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}
async function safeFetchHtml(rawUrl: string): Promise<{ html: string; finalUrl: string; status: number } | null> {
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
  try {
    const res = await fetch(target.toString(), {
      redirect: 'follow', signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 ProjectBondCustomerTester/1.0' },
    });
    clearTimeout(tid);
    const text = await res.text();
    return { html: text.slice(0, 250_000), finalUrl: res.url, status: res.status };
  } catch { clearTimeout(tid); return null; }
}

function extractCustomerEvidence(html: string, baseUrl: string) {
  const origin = new URL(baseUrl).origin;
  const title = (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '').trim().slice(0, 200);
  const description = (html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)?.[1] || '').slice(0, 300);
  const ogTitle = (html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i)?.[1] || '').slice(0, 200);
  const ogDesc = (html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i)?.[1] || '').slice(0, 300);
  const ogImage = (html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)?.[1] || '');
  const favicon = !!html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["']/i);
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
  while ((bm = btnRe.exec(html)) && ctas.length < 30) {
    const t = bm[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (t && t.length > 1 && t.length < 60) ctas.push(t);
  }

  const imgs = [...html.matchAll(/<img\b([^>]*)>/gi)].slice(0, 60);
  const imgTotal = imgs.length;
  const imgsMissingAlt = imgs.filter(m => !/\balt=["'][^"']+["']/i.test(m[1])).length;

  const forms: { method: string; action: string; fields: string[]; hasLabels: boolean }[] = [];
  const formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let fm: RegExpExecArray | null;
  while ((fm = formRe.exec(html)) && forms.length < 8) {
    const attrs = fm[1], body = fm[2];
    const action = attrs.match(/action=["']([^"']+)["']/i)?.[1] || baseUrl;
    const method = (attrs.match(/method=["']([^"']+)["']/i)?.[1] || 'get').toLowerCase();
    const fields: string[] = [];
    const inRe = /<(?:input|select|textarea)\b[^>]*name=["']([^"']+)["'][^>]*>/gi;
    let im: RegExpExecArray | null;
    while ((im = inRe.exec(body)) && fields.length < 12) fields.push(im[1]);
    const hasLabels = /<label\b/i.test(body);
    forms.push({ method, action, fields, hasLabels });
  }

  const links: { href: string; text: string; external: boolean }[] = [];
  const linkRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  let lm: RegExpExecArray | null;
  while ((lm = linkRe.exec(html)) && links.length < 60) {
    const href = lm[1].trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
    let abs: string; try { abs = new URL(href, baseUrl).toString(); } catch { continue; }
    if (seen.has(abs)) continue; seen.add(abs);
    const text = lm[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
    links.push({ href: abs, text, external: !abs.startsWith(origin) });
  }

  const navText = (html.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/i)?.[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
  const footerText = (html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/i)?.[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);

  // First ~600 chars of visible body text (above-the-fold-ish proxy)
  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 800);

  // Trust signals
  const trust = {
    hasPricing: /pricing|plans|cost/i.test(bodyText) || links.some(l => /pricing|plans/i.test(l.text)),
    hasContact: /contact|support|help/i.test(bodyText) || links.some(l => /contact|support/i.test(l.text)),
    hasAbout: /about|our story|who we are/i.test(bodyText) || links.some(l => /about/i.test(l.text)),
    hasTestimonials: /testimonial|review|trusted by|loved by|customers say/i.test(bodyText),
    hasPrivacy: links.some(l => /privacy|terms/i.test(l.text)),
    hasSocialProof: /\b\d{2,}[\s,+]*\s*(customers|users|companies|teams|brands)\b/i.test(bodyText),
  };

  return {
    title, description, ogTitle, ogDesc, ogImage, favicon, viewport, lang,
    headings: headings.slice(0, 15), h1Count,
    ctas: ctas.slice(0, 20),
    imgTotal, imgsMissingAlt,
    forms,
    links: links.slice(0, 30),
    navText, footerText, bodyText, trust,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { url, company_name, scan_id } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    // Pull recent user feedback so the model learns from prior thumbs up/down + ignored.
    const trainingClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { data: feedbackRows } = await trainingClient
      .from('scan_issues')
      .select('title, category, feedback, status')
      .eq('user_id', user.id)
      .or('feedback.not.is.null,status.eq.ignored')
      .order('created_at', { ascending: false })
      .limit(80);
    const goodEx = (feedbackRows || []).filter(r => r.feedback === 'good').slice(0, 15);
    const badEx = (feedbackRows || []).filter(r => r.feedback === 'bad' || r.status === 'ignored').slice(0, 25);
    const trainingBlock = (goodEx.length || badEx.length)
      ? `\n\nUSER FEEDBACK MEMORY (use to prioritize the right findings):\nGOOD examples the user found useful — produce MORE like these:\n${goodEx.map(r => `- [${r.category}] ${r.title}`).join('\n') || '(none yet)'}\n\nBAD / IGNORED examples the user dismissed — AVOID raising similar findings unless materially different:\n${badEx.map(r => `- [${r.category}] ${r.title}`).join('\n') || '(none yet)'}`
      : '';

    // ---- Full-site crawl (sitemap + BFS, effectively uncapped) ----
    // We crawl EVERYTHING reachable within a generous time budget so we find
    // real holes (broken login, dead checkout, crashing pages), not just the homepage.
    const MAX_PAGES = 500;
    const MAX_TIME_MS = 90_000;
    const startedAt = Date.now();
    const pages: { url: string; status: number; ev: ReturnType<typeof extractCustomerEvidence> }[] = [];
    const broken: { url: string; status: number; from: string }[] = [];

    const home = await safeFetchHtml(url);
    if (home) {
      const origin = new URL(home.finalUrl).origin;
      const followed = new Set<string>([home.finalUrl]);
      const queue: { href: string; from: string }[] = [];

      // 1. Seed from sitemap.xml + robots.txt
      try {
        const sm = await safeFetchHtml(new URL('/sitemap.xml', origin).toString());
        if (sm) {
          const locs = [...sm.html.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1]).slice(0, MAX_PAGES * 2);
          for (const u of locs) if (u.startsWith(origin) && !followed.has(u)) queue.push({ href: u, from: 'sitemap.xml' });
        }
      } catch { /* ignore */ }

      // 2. Process homepage
      const homeEv = extractCustomerEvidence(home.html, home.finalUrl);
      pages.push({ url: home.finalUrl, status: home.status, ev: homeEv });
      for (const l of homeEv.links) {
        if (!l.external && !followed.has(l.href)) queue.push({ href: l.href, from: home.finalUrl });
      }

      // 3. BFS — fetch up to MAX_PAGES, discover more internal links as we go
      while (pages.length < MAX_PAGES && queue.length && Date.now() - startedAt < MAX_TIME_MS) {
        // Pop next 4 in parallel
        const batch = queue.splice(0, 4).filter(q => !followed.has(q.href));
        if (!batch.length) continue;
        for (const b of batch) followed.add(b.href);
        const results = await Promise.all(batch.map(async (b) => {
          const p = await safeFetchHtml(b.href);
          return { b, p };
        }));
        for (const { b, p } of results) {
          if (!p) { broken.push({ url: b.href, status: 0, from: b.from }); continue; }
          if (p.status >= 400) { broken.push({ url: p.finalUrl, status: p.status, from: b.from }); continue; }
          const ev = extractCustomerEvidence(p.html, p.finalUrl);
          pages.push({ url: p.finalUrl, status: p.status, ev });
          // Discover more internal pages
          for (const l of ev.links) {
            if (!l.external && !followed.has(l.href) && queue.length < MAX_PAGES * 3) {
              queue.push({ href: l.href, from: p.finalUrl });
            }
          }
        }
      }

      // 4. HEAD-check a wider sample of remaining links (internal + external) for dead links
      const allLinks = new Set<string>();
      for (const p of pages) for (const l of p.ev.links) allLinks.add(l.href);
      const sample = [...allLinks].filter(h => !followed.has(h)).slice(0, 40);
      await Promise.all(sample.map(async (href) => {
        try {
          const ctl = new AbortController();
          const tid = setTimeout(() => ctl.abort(), 5000);
          const r = await fetch(href, { method: 'HEAD', redirect: 'follow', signal: ctl.signal });
          clearTimeout(tid);
          if (r.status >= 400) broken.push({ url: href, status: r.status, from: home.finalUrl });
        } catch { broken.push({ url: href, status: 0, from: home.finalUrl }); }
      }));
    }



    const evidenceSummary = pages.length
      ? pages.map(p => `URL: ${p.url} (HTTP ${p.status})
Title: ${p.ev.title || '(MISSING)'}
Meta description: ${p.ev.description || '(MISSING)'}
OG title/desc/image: ${p.ev.ogTitle ? 'yes' : 'NO'} / ${p.ev.ogDesc ? 'yes' : 'NO'} / ${p.ev.ogImage ? 'yes' : 'NO'}
Favicon: ${p.ev.favicon ? 'yes' : 'NO'} | viewport meta: ${p.ev.viewport ? 'yes' : 'NO'} | lang: ${p.ev.lang || 'NO'}
H1 count: ${p.ev.h1Count} | Headings: ${p.ev.headings.map(h => `${h.tag}:"${h.text}"`).join(' | ')}
CTAs found (${p.ev.ctas.length}): ${p.ev.ctas.slice(0, 15).join(' | ') || '(NONE)'}
Images: ${p.ev.imgTotal} total, ${p.ev.imgsMissingAlt} missing alt
Forms: ${p.ev.forms.map(f => `[${f.method.toUpperCase()} ${f.action} fields=${f.fields.join(',')} labels=${f.hasLabels}]`).join(' ') || 'none'}
Nav text: ${p.ev.navText || '(none)'}
Footer text: ${p.ev.footerText || '(none)'}
Trust signals: pricing=${p.ev.trust.hasPricing} contact=${p.ev.trust.hasContact} about=${p.ev.trust.hasAbout} testimonials=${p.ev.trust.hasTestimonials} privacy/terms=${p.ev.trust.hasPrivacy} socialProof=${p.ev.trust.hasSocialProof}
First-impression copy (≈800 chars): ${p.ev.bodyText}`).join('\n\n---\n\n')
      : `(Site could not be crawled at ${url}. Reason about it from URL only and flag the crawl failure as a critical issue.)`;

    const brokenBlock = broken.length
      ? `\n\nBROKEN / DEAD LINKS DETECTED (these are real findings, raise each one):\n${broken.slice(0, 15).map(b => `- ${b.url} → HTTP ${b.status || 'unreachable'} (linked from ${b.from})`).join('\n')}`
      : '';

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a PROFESSIONAL QA + CUSTOMER TESTER for real websites and apps. Your job is to find HIGH-IMPACT problems that actually stop people from using or buying — not cosmetic SEO/marketing nitpicks.

PRIORITIZATION (this is the most important rule):
Severity weighting for the report and the health_score:
  - Functional defects (broken flows, errors, login/checkout/contact failures, dead links, 5xx, redirect loops, form silently fails, button does nothing, API errors): 50% weight
  - User-journey blockers (no navigation, can't tell what the product is, no clear primary action, confusing IA, dead-end pages, mobile inaccessible nav): 20% weight
  - Performance (slow load, huge payloads, blocking resources): 15% weight
  - Accessibility (missing labels on forms, color/contrast, keyboard traps, missing alts on meaningful images): 10% weight
  - Marketing / trust / cosmetic (favicon, og:image, missing footer, missing testimonials, missing about page, missing H1 on a one-page SaaS): 5% weight

SEVERITY RULES — apply strictly:
  - critical = the product is broken or unusable for a real user RIGHT NOW (broken login, broken checkout, 5xx, redirect loop, JS-only site that renders empty, form submit returns error, primary CTA leads to 404, contact form silently fails).
  - warning = a real user can still use it but a meaningful share will bounce, get stuck, or distrust (no navigation/menu at all, can't tell what the product is, confusing CTA on a transactional page, mobile menu missing, no error handling on a form, slow page > 5s).
  - low = cosmetic / SEO / nice-to-have (favicon, og:image, missing H1 on a minimal page, missing footer on a one-pager, missing testimonials, "About" page absent, meta description length).

DO NOT MARK AS CRITICAL OR WARNING:
  - Missing favicon (always low)
  - Missing og:image / share preview (low)
  - Missing H1 if the page is a minimal landing with clear visible product name (low)
  - Missing footer on a one-page site (low)
  - Missing pricing page if the product is clearly not transactional (low)
  - Missing testimonials / about page / "trusted by" (low)
  - Generic "no social proof" complaints (low)

DO MARK AS CRITICAL / WARNING when evidence shows:
  - Any broken link in the BROKEN LINKS list — critical if it's in the nav/primary CTA, warning otherwise.
  - HTTP 4xx/5xx on any crawled page — critical for 5xx, warning for 4xx on linked pages.
  - The crawl returned essentially empty body text (likely client-rendered SPA that never hydrates for crawlers/bots) — warning (real customers on slow networks/screen readers/AI agents also see nothing).
  - A login/signup/checkout/contact form exists but has no labels, no method, no action, or fields that look broken — warning, critical if it's the primary conversion path.
  - There is NO navigation at all on a multi-page-looking site — warning.
  - The page does not communicate WHAT THE PRODUCT IS in the first impression copy — warning (judge from H1 + first 800 chars + CTAs).
  - Primary CTA is missing, ambiguous ("Submit", "Click here", "Learn more" with no context), or duplicated 3+ times with different destinations — warning.

You MUST ground every finding in the CRAWL EVIDENCE below. Do NOT invent issues. Do NOT generate generic best-practice checklists. If the evidence doesn't show a problem, don't raise it.

Quality over quantity: 4-12 findings is the right range for a normal site. Only raise more if the site is genuinely broken.

For EACH finding give:
- A specific, evidence-backed title (quote the actual heading/CTA/link/URL when possible)
- WHY a real user fails because of it (not "best practice says…")
- A concrete fix in plain language AND a code/no-code option

Be honest. A site that "just works" and has a clear value prop should score 75-90 even if it lacks a favicon, testimonials, or an About page.${trainingBlock}`
          },
          {
            role: 'user',
            content: `Audit this site as a professional QA + customer tester: ${url}${company_name ? ` (Company: ${company_name})` : ''}

CRAWL EVIDENCE (this is ground truth — do not invent beyond it):
${evidenceSummary}${brokenBlock}

Produce 4-12 findings, prioritized by REAL IMPACT (functional > journey > perf > a11y > marketing). Every broken link above MUST appear as its own finding. Do NOT pad the list with cosmetic SEO findings — mark those low or skip them.`

        ],
        tools: [{
          type: 'function',
          function: {
            name: 'website_analysis',
            description: 'Return evidence-backed customer-tester analysis',
            parameters: {
              type: 'object',
              properties: {
                health_score: { type: 'integer', description: 'Overall customer-readiness 0-100. Be honest: a confusing site with no value prop scores low even if technically fine.' },
                security_score: { type: 'integer', description: 'Security/trust 0-100 (HTTPS, privacy/terms presence, trust signals)' },
                sentiment_score: { type: 'integer', description: 'How a first-time customer would feel 0-100' },
                ai_summary: { type: 'string', description: '3-4 sentences in the voice of a customer: "I landed here and..." — include what is clear, what is confusing, and the #1 thing to fix.' },
                brand_analysis: {
                  type: 'object',
                  properties: {
                    tone: { type: 'string' },
                    positioning: { type: 'string', description: 'What the site appears to offer and to whom, based ONLY on evidence. If unclear, say so.' },
                    customer_expectations: { type: 'string' },
                    differentiator: { type: 'string', description: 'Differentiator stated on the site. If none is visible, say "None visible".' }
                  },
                  required: ['tone', 'positioning', 'customer_expectations', 'differentiator']
                },
                issues: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string', description: 'Specific, evidence-backed title. Quote real text when possible.' },
                      description: { type: 'string', description: 'What a customer experiences and why they bounce/distrust. Reference the evidence.' },
                      category: { type: 'string', enum: ['clarity', 'hierarchy', 'trust', 'cta', 'navigation', 'content', 'broken', 'accessibility', 'performance', 'mobile', 'security', 'form'] },
                      priority: { type: 'string', enum: ['critical', 'warning', 'low'] },
                      impact: { type: 'string', description: 'Concrete customer impact: bounce, lost trust, abandoned signup, etc.' },
                      location: { type: 'string', description: 'Exact page URL + element (e.g. "homepage hero", "/pricing H1", "footer contact link")' },
                      fix_dev: { type: 'string' },
                      fix_code: { type: 'string' },
                      fix_nocode: { type: 'string' },
                      fix_content: { type: 'string', description: 'Example copy a non-technical owner can paste in.' },
                      fix_visual: { type: 'string' }
                    },
                    required: ['title', 'description', 'category', 'priority', 'impact', 'location']
                  }
                }
              },
              required: ['health_score', 'security_score', 'sentiment_score', 'ai_summary', 'brand_analysis', 'issues']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'website_analysis' } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited, please try again later' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Add funds in Settings > Workspace > Usage.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    const analysis = JSON.parse(toolCall.function.arguments);

    // ---- Deterministic severity normalizer + re-weighted health_score ----
    // Cosmetic categories can never be > low. Broken/functional categories get bumped up.
    const COSMETIC_TITLE = /(favicon|og:image|og image|share preview|meta description length|missing footer|about page|testimonial|trusted by|social proof|pricing page)/i;
    const FUNCTIONAL_TITLE = /(broken|404|500|5xx|redirect loop|empty (page|body)|silently fails|does nothing|login|sign[\s-]?in|checkout|payment|contact form|api (error|fail)|cors)/i;
    const JOURNEY_TITLE = /(no navigation|missing menu|cannot tell|unclear (value|product)|primary cta|dead[- ]end|mobile menu)/i;

    if (Array.isArray(analysis.issues)) {
      for (const it of analysis.issues) {
        const t = `${it.title || ''} ${it.description || ''}`;
        if (COSMETIC_TITLE.test(t) && !FUNCTIONAL_TITLE.test(t)) it.priority = 'low';
        if (FUNCTIONAL_TITLE.test(t) && it.priority === 'low') it.priority = 'warning';
        if (it.category === 'broken' && it.priority !== 'critical') it.priority = 'warning';
      }
      // Re-weighted score: functional 50 / journey 20 / perf 15 / a11y 10 / marketing 5
      const weightFor = (it: any): { bucket: string; weight: number } => {
        const t = `${it.title || ''} ${it.description || ''}`;
        if (it.category === 'broken' || it.category === 'form' || FUNCTIONAL_TITLE.test(t)) return { bucket: 'functional', weight: 50 };
        if (it.category === 'navigation' || it.category === 'cta' || it.category === 'clarity' || JOURNEY_TITLE.test(t)) return { bucket: 'journey', weight: 20 };
        if (it.category === 'performance') return { bucket: 'perf', weight: 15 };
        if (it.category === 'accessibility' || it.category === 'mobile') return { bucket: 'a11y', weight: 10 };
        return { bucket: 'marketing', weight: 5 };
      };
      const sevPenalty = (p: string) => (p === 'critical' ? 1 : p === 'warning' ? 0.45 : 0.1);
      let totalPenalty = 0;
      const maxBucket: Record<string, number> = { functional: 50, journey: 20, perf: 15, a11y: 10, marketing: 5 };
      const usedBucket: Record<string, number> = { functional: 0, journey: 0, perf: 0, a11y: 0, marketing: 0 };
      for (const it of analysis.issues) {
        const { bucket, weight } = weightFor(it);
        const pen = weight * sevPenalty(it.priority || 'low');
        // cap each bucket so 20 cosmetic findings can't dominate
        const headroom = Math.max(0, maxBucket[bucket] - usedBucket[bucket]);
        const applied = Math.min(pen, headroom);
        usedBucket[bucket] += applied;
        totalPenalty += applied;
      }
      const computed = Math.max(0, Math.min(100, Math.round(100 - totalPenalty)));
      // Blend AI score with deterministic score, lean on deterministic (70/30)
      const aiScore = typeof analysis.health_score === 'number' ? analysis.health_score : computed;
      analysis.health_score = Math.round(computed * 0.7 + aiScore * 0.3);
    }

      console.error('AI error:', aiResponse.status, errorText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('No analysis returned from AI');

    const analysis = JSON.parse(toolCall.function.arguments);

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

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
      const { data: updated, error: updErr } = await adminClient
        .from('scans')
        .update(scanData)
        .eq('id', scan_id)
        .eq('user_id', user.id)
        .select('id');
      if (updErr) throw updErr;
      if (!updated || updated.length === 0) {
        return new Response(JSON.stringify({ error: 'Scan not found or not owned by user' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      const { data: newScan, error: scanError } = await adminClient
        .from('scans').insert(scanData).select('id').single();
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
