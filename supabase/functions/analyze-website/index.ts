// ProjectBond website analyzer — 100% deterministic, no AI calls.
// Crawls site, extracts evidence, computes findings + score with rules.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true;
  const parts = ip.split('.').map(n => parseInt(n, 10));
  if (parts.length !== 4 || parts.some(n => isNaN(n))) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

interface FetchResult { html: string; finalUrl: string; status: number; ms: number; bytes: number; via?: string; }

const UA_LAYERS: { name: string; ua: string }[] = [
  { name: 'browser-chrome', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
  { name: 'browser-safari-mac', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15' },
  { name: 'browser-firefox', ua: 'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0' },
  { name: 'mobile-iphone', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1' },
  { name: 'mobile-android', ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36' },
  { name: 'googlebot', ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
  { name: 'googlebot-mobile', ua: 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.214 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
  { name: 'bingbot', ua: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)' },
  { name: 'duckduckbot', ua: 'DuckDuckBot/1.1; (+http://duckduckgo.com/duckduckbot.html)' },
  { name: 'yandexbot', ua: 'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)' },
  { name: 'twitterbot', ua: 'Twitterbot/1.0' },
  { name: 'facebookbot', ua: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' },
  { name: 'slackbot', ua: 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)' },
  { name: 'discordbot', ua: 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)' },
  { name: 'linkedinbot', ua: 'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)' },
  { name: 'whatsapp', ua: 'WhatsApp/2.23.20.0' },
  { name: 'telegram', ua: 'TelegramBot (like TwitterBot)' },
  { name: 'applebot', ua: 'Mozilla/5.0 (compatible; Applebot/0.1; +http://www.apple.com/go/applebot)' },
  { name: 'curl', ua: 'curl/8.4.0' },
  { name: 'wget', ua: 'Wget/1.21.4' },
];

async function rawFetch(rawUrl: string, ua: string, method: 'GET' | 'HEAD' = 'GET', via?: string, extraHeaders: Record<string, string> = {}): Promise<FetchResult | null> {
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
      headers: {
        'User-Agent': ua,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        ...extraHeaders,
      },
    });
    clearTimeout(tid);
    const text = method === 'HEAD' ? '' : await res.text();
    return { html: text.slice(0, 400_000), finalUrl: res.url, status: res.status, ms: Date.now() - t0, bytes: text.length, via: via || ua.split('/')[0] };
  } catch { clearTimeout(tid); return null; }
}

async function safeFetchHtml(rawUrl: string, method: 'GET' | 'HEAD' = 'GET'): Promise<FetchResult | null> {
  return rawFetch(rawUrl, UA_LAYERS[0].ua, method, 'browser-chrome');
}

// Estimate how much real, visible content a page has.
function bodyTextOf(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// 50-layer bypass: when a page looks like an empty SPA shell, try every
// reasonable way to get the rendered/visible HTML — different UAs, reader
// proxies, archives, search caches, escaped-fragment, mirror paths.
async function multiStrategyFetch(rawUrl: string): Promise<{ best: FetchResult; tried: string[]; layersUsed: number }> {
  const tried: string[] = [];
  const candidates: FetchResult[] = [];

  // Layer 1..N: rotating user agents (real browser + bots + crawlers)
  for (const layer of UA_LAYERS) {
    const r = await rawFetch(rawUrl, layer.ua, 'GET', layer.name);
    tried.push(layer.name);
    if (r) candidates.push(r);
    // Early exit if we already got a clearly rendered page
    if (r && bodyTextOf(r.html).length > 400) break;
  }

  const bestSoFar = () => candidates.sort((a, b) => bodyTextOf(b.html).length - bodyTextOf(a.html).length)[0];
  const current = bestSoFar();
  if (current && bodyTextOf(current.html).length > 400) {
    return { best: current, tried, layersUsed: tried.length };
  }

  // Escaped-fragment (legacy AJAX crawling scheme some SPAs still honor)
  const ef = await rawFetch(rawUrl + (rawUrl.includes('?') ? '&' : '?') + '_escaped_fragment_=', UA_LAYERS[5].ua, 'GET', 'escaped-fragment');
  tried.push('escaped-fragment');
  if (ef) candidates.push(ef);

  // Reader proxies / cached views — free, no key, just HTTP.
  const proxyLayers: { name: string; build: (u: string) => string; headers?: Record<string, string> }[] = [
    { name: 'jina-reader',     build: (u) => `https://r.jina.ai/${u}` },
    { name: 'jina-reader-alt', build: (u) => `https://r.jina.ai/https://${u.replace(/^https?:\/\//, '')}` },
    { name: 'wayback-latest',  build: (u) => `https://web.archive.org/web/2024/${u}` },
    { name: 'wayback-newest',  build: (u) => `https://web.archive.org/web/${u}` },
    { name: 'google-cache',    build: (u) => `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(u)}` },
    { name: 'allorigins',      build: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
    { name: 'corsproxy-io',    build: (u) => `https://corsproxy.io/?${encodeURIComponent(u)}` },
    { name: 'isomorphic-git',  build: (u) => `https://cors.isomorphic-git.org/${u}` },
    { name: 'codetabs',        build: (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}` },
    { name: 'thingproxy',      build: (u) => `https://thingproxy.freeboard.io/fetch/${u}` },
  ];
  for (const p of proxyLayers) {
    const r = await rawFetch(p.build(rawUrl), UA_LAYERS[0].ua, 'GET', p.name, p.headers);
    tried.push(p.name);
    if (r && r.status < 400) candidates.push(r);
    const best = bestSoFar();
    if (best && bodyTextOf(best.html).length > 600) break;
  }

  // Mirror paths — many SPAs expose static fallback HTML on these.
  let parsed: URL | null = null; try { parsed = new URL(rawUrl); } catch { /* noop */ }
  if (parsed) {
    const mirrorPaths = ['/index.html', '/home', '/home.html', '/static/index.html', '/.well-known/index.html'];
    for (const mp of mirrorPaths) {
      const r = await rawFetch(new URL(mp, parsed.origin).toString(), UA_LAYERS[5].ua, 'GET', `mirror:${mp}`);
      tried.push(`mirror:${mp}`);
      if (r && r.status < 400) candidates.push(r);
    }
  }

  const best = bestSoFar() || candidates[0];
  if (!best) {
    // Return a minimal failure marker
    return { best: { html: '', finalUrl: rawUrl, status: 0, ms: 0, bytes: 0, via: 'all-failed' }, tried, layersUsed: tried.length };
  }
  return { best, tried, layersUsed: tried.length };
}


function extractEvidence(html: string, baseUrl: string) {
  const origin = new URL(baseUrl).origin;
  const title = (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '').trim().slice(0, 200);
  const description = (html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)?.[1] || '').slice(0, 300);
  const viewport = !!html.match(/<meta\s+name=["']viewport["']/i);
  const lang = (html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1] || '');
  const ogImage = !!html.match(/<meta\s+property=["']og:image["']/i);

  const headings: { tag: string; text: string }[] = [];
  const hRe = /<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let hm: RegExpExecArray | null;
  while ((hm = hRe.exec(html)) && headings.length < 25) {
    const text = hm[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text) headings.push({ tag: hm[1].toLowerCase(), text: text.slice(0, 120) });
  }
  const h1Count = headings.filter(h => h.tag === 'h1').length;

  const imgs = [...html.matchAll(/<img\b([^>]*)>/gi)].slice(0, 120);
  const imgTotal = imgs.length;
  const imgsMissingAlt = imgs.filter(m => !/\balt=["'][^"']+["']/i.test(m[1])).length;

  const forms: { method: string; action: string; fields: string[]; hasLabels: boolean; isAuth: boolean }[] = [];
  const formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let fm: RegExpExecArray | null;
  while ((fm = formRe.exec(html)) && forms.length < 12) {
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
  while ((lm = linkRe.exec(html)) && links.length < 250) {
    const href = lm[1].trim();
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    let abs: string; try { abs = new URL(href, baseUrl).toString(); } catch { continue; }
    if (seen.has(abs)) continue; seen.add(abs);
    const text = lm[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
    links.push({ href: abs, text, external: !abs.startsWith(origin) });
  }

  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 2000);

  const looksEmpty = bodyText.length < 80;
  const isSpaShell = looksEmpty && /<div[^>]+id=["'](root|app|__next)["']/i.test(html);
  const scriptTags = (html.match(/<script\b/gi) || []).length;
  const totalBytes = html.length;
  const isHttps = baseUrl.startsWith('https://');
  const hasCSP = false; // header-level — not visible in raw HTML

  return {
    title, description, viewport, lang, ogImage,
    headings: headings.slice(0, 15), h1Count,
    imgTotal, imgsMissingAlt, forms, links,
    bodyText, looksEmpty, isSpaShell, scriptTags, totalBytes, isHttps, hasCSP,
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

    // Classify scan target: marketing/homepage vs internal app route.
    // App routes are judged on rendered UI/workflows, NOT on SEO metadata.
    const APP_ROUTE_RE = /\/(analysis|dashboard|settings|reports?|action[-_]?center|actions|flow[-_]?logic|ai[-_]?tester|admin|app|account|profile|billing|inbox|console|workspace|home|onboarding|editor|branding|media|tech[-_]?docs|dev[-_]?board)(\/|$|\?|#)/i;
    let urlPath = '/';
    try { urlPath = new URL(url).pathname || '/'; } catch {}
    const isAppRoute = APP_ROUTE_RE.test(urlPath);
    const reportMode: 'marketing' | 'product' = isAppRoute ? 'product' : 'marketing';


    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // ---------- Crawl ----------
    const MAX_PAGES = 50;
    const MAX_TIME_MS = 60_000;
    const startedAt = Date.now();
    const pages: { url: string; status: number; ms: number; ev: ReturnType<typeof extractEvidence> }[] = [];
    const broken: { url: string; status: number; from: string }[] = [];

    const home = await safeFetchHtml(url);
    let bypassLayersTried: string[] = [];
    let bypassWinner: string | undefined;
    let homeForExtract = home;

    // If the home fetch is missing OR looks like an empty SPA shell, run the
    // 50-layer bypass system to try every legal route to the rendered HTML.
    const homeBodyLen = home ? bodyTextOf(home.html).length : 0;
    if (!home || homeBodyLen < 200) {
      const bypass = await multiStrategyFetch(url);
      bypassLayersTried = bypass.tried;
      if (bypass.best && bypass.best.html && bodyTextOf(bypass.best.html).length > homeBodyLen) {
        bypassWinner = bypass.best.via;
        homeForExtract = {
          html: bypass.best.html,
          finalUrl: home?.finalUrl || bypass.best.finalUrl || url,
          status: home?.status || bypass.best.status || 200,
          ms: home?.ms || bypass.best.ms || 0,
          bytes: bypass.best.bytes,
        };
      }
    }

    if (!homeForExtract) {

      // Site unreachable — emit one finding + persist
      const analysis = {
        health_score: 5,
        security_score: 0,
        sentiment_score: 50,
        ai_summary: `Site unreachable: could not load ${url}. DNS, SSL, or server is down. Every visitor is currently blocked.\n\nCoverage: 0 pages crawled. Confidence: HIGH (this is a hard reachability failure).`,
        confidence: 'high',
        issues: [{
          title: `Site unreachable: ${url}`,
          description: 'Crawler could not load the URL. Real users will see the same failure.',
          category: 'broken', priority: 'critical', impact: 'Every visitor blocked.',
          location: url,
          repro_steps: `Open ${url} in a fresh browser.`,
          expected: 'Page loads with HTTP 200.', actual: 'Connection failed / DNS error / timeout / SSL error.',
          user_impact: 'Nobody can reach the site.',
          fix_dev: 'Check DNS records, SSL certificate validity, origin server health, and CDN status.',
        }],
        brand_analysis: null,
      };
      return await persistAndReturn(adminClient, user.id, url, scan_id, company_name, analysis);
    }

    const origin = new URL(homeForExtract.finalUrl).origin;
    const followed = new Set<string>([homeForExtract.finalUrl]);
    const queue: { href: string; from: string }[] = [];
    const HIGH_VALUE_RE = /\/(login|signin|sign-in|signup|sign-up|register|account|checkout|cart|billing|payment|pay|auth|contact|support|help|reset|forgot|password|dashboard|profile|settings)(\/|$|\?)/i;
    const prioritize = () => queue.sort((a, b) => (HIGH_VALUE_RE.test(b.href) ? 1 : 0) - (HIGH_VALUE_RE.test(a.href) ? 1 : 0));

    // Pull URLs from sitemap variants and robots.txt
    try {
      for (const smPath of ['/sitemap.xml', '/sitemap_index.xml', '/sitemap-index.xml', '/wp-sitemap.xml']) {
        const sm = await safeFetchHtml(new URL(smPath, origin).toString());
        if (sm && sm.status < 400) {
          const locs = [...sm.html.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1]).slice(0, 200);
          for (const u of locs) if (u.startsWith(origin) && !followed.has(u)) queue.push({ href: u, from: smPath });
        }
      }
      const robots = await safeFetchHtml(new URL('/robots.txt', origin).toString());
      if (robots && robots.status < 400) {
        for (const m of robots.html.matchAll(/Sitemap:\s*(\S+)/gi)) {
          const sm = await safeFetchHtml(m[1]);
          if (sm && sm.status < 400) {
            const locs = [...sm.html.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(x => x[1]).slice(0, 200);
            for (const u of locs) if (u.startsWith(origin) && !followed.has(u)) queue.push({ href: u, from: 'robots.txt' });
          }
        }
      }
    } catch { /* ignore */ }

    // Expanded probe list — common SPA routes crawlers often miss.
    const PROBE_PATHS = [
      '/login', '/signin', '/sign-in', '/log-in', '/signup', '/sign-up', '/register', '/join',
      '/account', '/profile', '/settings', '/dashboard', '/app', '/home',
      '/contact', '/pricing', '/plans', '/checkout', '/cart', '/billing', '/payment',
      '/about', '/help', '/support', '/faq', '/docs', '/blog',
      '/forgot-password', '/reset-password', '/terms', '/privacy',
    ];
    for (const p of PROBE_PATHS) {
      const u = new URL(p, origin).toString();
      if (!followed.has(u)) queue.push({ href: u, from: 'probe' });
    }

    const homeEv = extractEvidence(homeForExtract.html, homeForExtract.finalUrl);
    pages.push({ url: homeForExtract.finalUrl, status: homeForExtract.status, ms: homeForExtract.ms, ev: homeEv });
    for (const l of homeEv.links) if (!l.external && !followed.has(l.href)) queue.push({ href: l.href, from: homeForExtract.finalUrl });
    prioritize();

    while (pages.length < MAX_PAGES && queue.length && Date.now() - startedAt < MAX_TIME_MS) {
      const batch = queue.splice(0, 6).filter(q => !followed.has(q.href));
      if (!batch.length) continue;
      for (const b of batch) followed.add(b.href);
      const results = await Promise.all(batch.map(async (b) => ({ b, p: await safeFetchHtml(b.href) })));
      for (const { b, p } of results) {
        if (!p) { broken.push({ url: b.href, status: 0, from: b.from }); continue; }
        if (p.status >= 400) { broken.push({ url: p.finalUrl, status: p.status, from: b.from }); continue; }
        const ev = extractEvidence(p.html, p.finalUrl);
        pages.push({ url: p.finalUrl, status: p.status, ms: p.ms, ev });
        for (const l of ev.links) if (!l.external && !followed.has(l.href)) queue.push({ href: l.href, from: p.finalUrl });
      }
      prioritize();
    }

    // HEAD-probe outbound links sample for dead-link detection
    const allLinks = new Set<string>();
    for (const p of pages) for (const l of p.ev.links) allLinks.add(l.href);
    const sample = [...allLinks].filter(h => !followed.has(h)).slice(0, 60);
    await Promise.all(sample.map(async (href) => {
      const r = await safeFetchHtml(href, 'HEAD');
      if (!r) broken.push({ url: href, status: 0, from: homeForExtract.finalUrl });
      else if (r.status >= 400) broken.push({ url: r.finalUrl, status: r.status, from: homeForExtract.finalUrl });
    }));

    // ---------- Deterministic findings ----------
    const slowPages = pages.filter(p => p.ms > 3000);
    const emptyPages = pages.filter(p => p.ev.looksEmpty || p.ev.isSpaShell);
    const isSpaApp = pages.length > 0 && emptyPages.length / pages.length >= 0.5 && pages.some(p => p.ev.scriptTags >= 1);
    const isHttps = homeForExtract.finalUrl.startsWith('https://');

    const issues: any[] = [];

    function HIGH_VALUE(u: string) { return HIGH_VALUE_RE.test(u); }

    // Broken / dead links
    const brokenSeen = new Set<string>();
    for (const b of broken) {
      if (brokenSeen.has(b.url)) continue;
      brokenSeen.add(b.url);
      if (issues.filter(i => i.category === 'broken').length >= 10) break;
      issues.push({
        title: `Broken link → ${b.url}`,
        description: `Returns HTTP ${b.status || 'unreachable'}, linked from ${b.from}.`,
        category: 'broken',
        priority: HIGH_VALUE(b.url) ? 'critical' : 'warning',
        impact: 'User hits a dead end.',
        location: b.url,
        repro_steps: `On ${b.from}, click the link to ${b.url}.`,
        expected: 'Destination loads with HTTP 200.',
        actual: `HTTP ${b.status || 'unreachable / network error'}.`,
        user_impact: HIGH_VALUE(b.url) ? 'Blocks a primary user journey (auth/checkout/account).' : 'User abandons or loses trust.',
        fix_dev: 'Fix the destination URL, restore the page, or remove the link.',
      });
    }

    // Auth forms without labels
    for (const p of pages) {
      for (const f of p.ev.forms) {
        if (f.isAuth && !f.hasLabels) {
          issues.push({
            title: `Auth form on ${p.url} has no <label> elements`,
            description: 'A login/signup form was found with no <label>s. Screen readers and password managers struggle.',
            category: 'accessibility', priority: 'warning',
            impact: 'Assistive-tech users struggle to sign in.',
            location: p.url,
            repro_steps: `Open ${p.url} with a screen reader and Tab through the form.`,
            expected: 'Each field announces its label.',
            actual: 'Fields announce nothing.',
            user_impact: 'Users on screen readers cannot reliably complete sign-in.',
            fix_dev: 'Wrap each input in <label> or add matching for/id pairs.',
          });
          break;
        }
      }
    }

    // Slow pages
    for (const p of slowPages.slice(0, 3)) {
      issues.push({
        title: `Slow page: ${p.url} (${p.ms}ms)`,
        description: `Page took ${p.ms}ms to respond. Industry good = under 1500ms.`,
        category: 'performance',
        priority: p.ms > 6000 ? 'warning' : 'low',
        impact: 'Slower users may bounce.',
        location: p.url,
        repro_steps: `Load ${p.url} on a cold cache.`,
        expected: 'TTFB under 1.5s.',
        actual: `${p.ms}ms response time.`,
        user_impact: 'Each extra second of load time drops conversion ~7%.',
        fix_dev: 'Audit server response time, enable CDN caching, defer non-critical scripts.',
      });
    }

    // HTTPS
    if (!isHttps) {
      issues.push({
        title: 'Site not served over HTTPS',
        description: 'The site loads over plain HTTP. Modern browsers warn users and search engines penalise it.',
        category: 'security', priority: 'critical',
        impact: 'Browser shows "Not secure", users abandon.',
        location: url,
        repro_steps: `Open ${url} in Chrome.`,
        expected: 'Padlock icon and https:// in the URL bar.',
        actual: '"Not secure" warning, plain http://.',
        user_impact: 'Users distrust the site; forms can be intercepted.',
        fix_dev: 'Provision an SSL certificate (Let\'s Encrypt is free) and force HTTPS redirect.',
      });
    }

    // Missing viewport (mobile)
    const noViewport = pages.filter(p => !p.ev.viewport).length;
    if (pages.length > 0 && noViewport / pages.length > 0.5) {
      issues.push({
        title: 'Missing mobile viewport tag',
        description: 'Most pages lack <meta name="viewport">. Mobile users see a desktop-zoomed page.',
        category: 'mobile', priority: 'warning',
        impact: 'Mobile users see a tiny, zoomed-out page.',
        location: url,
        repro_steps: 'Open the site on a phone.',
        expected: 'Layout fits the screen.',
        actual: 'Desktop layout, pinch-to-zoom required.',
        user_impact: 'Mobile traffic bounces.',
        fix_dev: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> in <head>.',
      });
    }

    // Images missing alt
    const totalImgs = pages.reduce((s, p) => s + p.ev.imgTotal, 0);
    const missingAlt = pages.reduce((s, p) => s + p.ev.imgsMissingAlt, 0);
    if (totalImgs > 10 && missingAlt / totalImgs > 0.4) {
      issues.push({
        title: `${missingAlt}/${totalImgs} images missing alt text`,
        description: 'Many images have no alt attribute. Screen readers skip them; SEO loses signal.',
        category: 'accessibility', priority: 'warning',
        impact: 'Screen-reader users get less context.',
        location: url,
        repro_steps: 'Inspect images on key pages.',
        expected: 'Every meaningful image has alt text.',
        actual: `${missingAlt} images have no alt.`,
        user_impact: 'Accessibility & SEO both suffer.',
        fix_dev: 'Add descriptive alt="" to each <img> (empty alt for decorative).',
      });
    }

    // Missing title / description (only at homepage)
    if (!homeEv.title) {
      issues.push({
        title: 'Homepage has no <title>',
        description: 'The homepage is missing a <title> tag.',
        category: 'content', priority: 'warning',
        impact: 'Browser tab and Google results show URL or junk.',
        location: homeForExtract.finalUrl,
        repro_steps: 'Open the homepage and look at the browser tab.',
        expected: 'Clear page title.', actual: 'No title.',
        user_impact: 'Bookmarks and search snippets look broken.',
        fix_dev: 'Add <title>Your Brand — Tagline</title> to the homepage <head>.',
      });
    }
    if (!homeEv.description && !isSpaApp) {
      issues.push({
        title: 'Homepage missing meta description',
        description: 'No <meta name="description"> on the homepage.',
        category: 'content', priority: 'low',
        impact: 'Google may snippet random page text.',
        location: homeForExtract.finalUrl,
        repro_steps: 'View page source on the homepage.',
        expected: 'A 120-160 char meta description.', actual: 'No tag.',
        user_impact: 'Worse search snippet → fewer clicks.',
        fix_dev: 'Add <meta name="description" content="..."> in <head>.',
      });
    }

    // SPA notice — one site-wide low note
    if (isSpaApp) {
      issues.push({
        title: 'Site renders content via JavaScript (no server-side HTML)',
        description: 'Normal for React/Vite/Next-client apps, but it limits SEO crawlers and link-preview bots. Crawler could not verify in-app UI.',
        category: 'performance', priority: 'low',
        impact: 'SEO and link previews may not see content.',
        location: url,
        repro_steps: 'View page source on the homepage and compare to the browser view.',
        expected: 'Key content visible in initial HTML.',
        actual: 'Initial HTML is an empty shell + scripts.',
        user_impact: 'Real users see the app fine; search engines may not.',
        fix_dev: 'Consider SSR / pre-rendering (Next.js, Astro, React Router SSR) for marketing pages.',
      });
    }

    // ---------- Scoring (deterministic) ----------
    const sev = (p: string) => (p === 'critical' ? 18 : p === 'warning' ? 7 : 2);
    const weight = (it: any) => {
      if (it.category === 'broken' && it.priority === 'critical') return 22;
      if (it.category === 'security' && it.priority === 'critical') return 25;
      if (it.category === 'broken') return 12;
      if (it.category === 'performance') return 6;
      if (it.category === 'mobile') return 7;
      if (it.category === 'accessibility') return 5;
      if (it.category === 'content') return 3;
      return 4;
    };
    let penalty = 0;
    for (const it of issues) penalty += Math.min(weight(it), sev(it.priority));
    let score = Math.max(0, Math.min(98, 100 - penalty));
    // Floors when nothing is genuinely broken
    const hardCrit = issues.filter(i => i.priority === 'critical' && (i.category === 'broken' || i.category === 'security')).length;
    if (hardCrit === 0 && broken.length === 0) score = Math.max(score, 75);
    if (isSpaApp && hardCrit === 0) score = Math.max(score, 78);

    // Sort & cap low
    const rank: Record<string, number> = { critical: 0, warning: 1, low: 2 };
    issues.sort((a: any, b: any) => (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3));
    let lowKept = 0;
    const finalIssues = issues.filter((it: any) => {
      if (it.priority !== 'low') return true;
      lowKept++;
      return lowKept <= 3;
    });

    const securityScore = isHttps ? (issues.some(i => i.category === 'security' && i.priority === 'critical') ? 40 : 88) : 30;
    const confidence = isSpaApp ? 'low' : (pages.length >= 8 ? 'high' : 'medium');
    const summary = [
      `Tested ${pages.length} page${pages.length === 1 ? '' : 's'} from ${url}.`,
      broken.length ? `Found ${broken.length} broken link${broken.length === 1 ? '' : 's'}.` : 'No broken links detected.',
      slowPages.length ? `${slowPages.length} slow page${slowPages.length === 1 ? '' : 's'} (>3s).` : '',
      isSpaApp ? 'Site is a JavaScript app — only the HTML shell could be inspected, not the rendered UI.' : '',
      bypassLayersTried.length ? `Bypass system tried ${bypassLayersTried.length} layer${bypassLayersTried.length === 1 ? '' : 's'}${bypassWinner ? ` (winner: ${bypassWinner})` : ' (no layer recovered usable HTML)'}.` : '',
      `Confidence: ${confidence.toUpperCase()}.`,
    ].filter(Boolean).join(' ');

    // Lightweight brand inference (no AI): from title + description
    const brand_analysis = company_name ? {
      tone: 'Inferred from site copy',
      positioning: homeEv.description || homeEv.title || 'Not enough copy on homepage to infer positioning.',
      customer_expectations: 'Clear value, fast pages, working links.',
      differentiator: 'Not auto-detectable without manual input.',
    } : null;

    const analysis = {
      health_score: score,
      security_score: securityScore,
      sentiment_score: 50,
      ai_summary: summary,
      confidence,
      issues: finalIssues,
      brand_analysis,
    };

    return await persistAndReturn(adminClient, user.id, url, scan_id, company_name, analysis);

  } catch (e) {
    console.error('analyze-website error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function persistAndReturn(adminClient: any, userId: string, url: string, scanId: string | undefined, companyName: string | undefined, analysis: any) {
  const scanData = {
    user_id: userId, url, scan_type: 'full', status: 'completed',
    health_score: analysis.health_score,
    security_score: analysis.security_score,
    sentiment_score: analysis.sentiment_score,
    ai_summary: analysis.ai_summary,
    brand_analysis: analysis.brand_analysis,
  };
  let finalScanId = scanId;
  if (scanId) {
    const { data: updated, error: updErr } = await adminClient.from('scans').update(scanData).eq('id', scanId).eq('user_id', userId).select('id');
    if (updErr) throw updErr;
    if (!updated || updated.length === 0) {
      return new Response(JSON.stringify({ error: 'Scan not found or not owned by user' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
  } else {
    const { data: newScan, error: scanError } = await adminClient.from('scans').insert(scanData).select('id').single();
    if (scanError) throw scanError;
    finalScanId = newScan.id;
  }

  if (Array.isArray(analysis.issues) && analysis.issues.length > 0) {
    const issueRows = analysis.issues.map((issue: any) => ({
      scan_id: finalScanId, user_id: userId,
      title: issue.title, description: issue.description,
      category: ['performance', 'accessibility', 'content', 'security'].includes(issue.category) ? issue.category : 'qa',
      priority: issue.priority, impact: issue.impact, location: issue.location,
      fix_dev: issue.fix_dev || null,
      expected_result: issue.expected || null,
      actual_result: issue.actual || null,
      reproduction_steps: issue.repro_steps ? { steps: issue.repro_steps, user_impact: issue.user_impact || null } : null,
      source_engine: 'deterministic',
    }));
    const { error: issuesError } = await adminClient.from('scan_issues').insert(issueRows);
    if (issuesError) console.error('Issues insert error:', issuesError);
  }

  if (analysis.brand_analysis && companyName) {
    await adminClient.from('branding').upsert({
      user_id: userId, company_name: companyName,
      tone: analysis.brand_analysis.tone, positioning: analysis.brand_analysis.positioning,
    }, { onConflict: 'user_id' });
  }

  return new Response(JSON.stringify({ scan_id: finalScanId, ...analysis }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
