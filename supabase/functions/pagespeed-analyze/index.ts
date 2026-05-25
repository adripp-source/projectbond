import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// In-house performance analyzer. No external paid/quota'd APIs.
// Scores are heuristic estimates based on response timing, payload size,
// asset counts, headers, and basic HTML hygiene.
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

    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Running in-house performance analysis for:', formattedUrl);

    const t0 = Date.now();
    let res: Response;
    try {
      res = await fetch(formattedUrl, {
        redirect: 'follow',
        headers: { 'User-Agent': 'ProjectBond-Scanner/1.0' },
      });
    } catch (e) {
      return new Response(JSON.stringify({
        error: 'Site unreachable',
        details: e instanceof Error ? e.message : String(e),
      }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const ttfb = Date.now() - t0;
    const html = await res.text();
    const total = Date.now() - t0;
    const bytes = new TextEncoder().encode(html).length;

    const headers = res.headers;
    const hasHttps = res.url.startsWith('https://');
    const hasHsts = headers.has('strict-transport-security');
    const hasCsp = headers.has('content-security-policy');
    const hasXcto = headers.get('x-content-type-options')?.toLowerCase() === 'nosniff';
    const hasXfo = headers.has('x-frame-options') || hasCsp;
    const hasCompression = /gzip|br|deflate/i.test(headers.get('content-encoding') || '');
    const hasCache = headers.has('cache-control') || headers.has('etag');

    // Cheap HTML parse via regex (no DOM needed for heuristics)
    const count = (re: RegExp) => (html.match(re) || []).length;
    const scripts = count(/<script\b/gi);
    const styles = count(/<link\b[^>]+rel=["']?stylesheet/gi);
    const images = count(/<img\b/gi);
    const imagesNoAlt = count(/<img\b(?![^>]*\balt=)[^>]*>/gi);
    const imagesNoLazy = count(/<img\b(?![^>]*\bloading=)[^>]*>/gi);
    const inlineStyles = count(/<style\b/gi);
    const hasViewport = /<meta[^>]+name=["']viewport/i.test(html);
    const hasTitle = /<title>[^<]{3,}<\/title>/i.test(html);
    const hasMetaDesc = /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{10,}/i.test(html);
    const hasH1 = /<h1\b/i.test(html);
    const hasCanonical = /<link[^>]+rel=["']canonical/i.test(html);
    const hasLang = /<html[^>]+lang=/i.test(html);
    const hasFavicon = /<link[^>]+rel=["'](?:shortcut )?icon/i.test(html);
    const hasOg = /<meta[^>]+property=["']og:/i.test(html);

    // --- Scoring (0-100) ---
    const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

    // Performance: weight TTFB, total time, payload size, asset counts, compression, cache
    let perf = 100;
    if (ttfb > 200) perf -= Math.min(30, (ttfb - 200) / 30);
    if (total > 1500) perf -= Math.min(25, (total - 1500) / 100);
    if (bytes > 500_000) perf -= Math.min(20, (bytes - 500_000) / 50_000);
    if (scripts > 10) perf -= Math.min(15, (scripts - 10) * 1.5);
    if (!hasCompression) perf -= 10;
    if (!hasCache) perf -= 8;
    if (imagesNoLazy > 5) perf -= Math.min(10, (imagesNoLazy - 5));
    const performance = clamp(perf);

    // Accessibility
    let a11y = 100;
    if (!hasLang) a11y -= 15;
    if (!hasTitle) a11y -= 15;
    if (images > 0) a11y -= Math.min(40, (imagesNoAlt / Math.max(1, images)) * 50);
    if (!hasViewport) a11y -= 10;
    if (!hasH1) a11y -= 10;
    const accessibility = clamp(a11y);

    // Best practices (security headers, https)
    let bp = 100;
    if (!hasHttps) bp -= 30;
    if (!hasHsts) bp -= 10;
    if (!hasCsp) bp -= 10;
    if (!hasXcto) bp -= 8;
    if (!hasXfo) bp -= 8;
    if (inlineStyles > 3) bp -= 5;
    const bestPractices = clamp(bp);

    // SEO
    let seo = 100;
    if (!hasTitle) seo -= 20;
    if (!hasMetaDesc) seo -= 20;
    if (!hasH1) seo -= 15;
    if (!hasCanonical) seo -= 10;
    if (!hasViewport) seo -= 10;
    if (!hasFavicon) seo -= 5;
    if (!hasOg) seo -= 10;
    const seoScore = clamp(seo);

    const scores = {
      performance,
      accessibility,
      bestPractices,
      seo: seoScore,
    };

    const fmtMs = (n: number) => `${(n / 1000).toFixed(2)} s`;
    const metrics = {
      fcp: fmtMs(Math.round(ttfb + 100)),
      lcp: fmtMs(total + Math.min(800, images * 50)),
      tbt: `${Math.min(600, scripts * 30)} ms`,
      cls: imagesNoLazy > 5 ? '0.15' : '0.05',
      si: fmtMs(Math.round(total * 1.1)),
      tti: fmtMs(Math.round(total + scripts * 40)),
    };

    // Build failed-audit findings to mirror the previous shape
    const failedAudits: any[] = [];
    const push = (id: string, title: string, description: string, score: number, category: string, displayValue = '') => {
      failedAudits.push({ id, title, description, displayValue, score, category });
    };

    if (ttfb > 600) push('ttfb', 'Slow server response time', 'Server took a long time to respond. Consider caching, a CDN, or faster hosting.', 0.3, 'performance', `${ttfb} ms`);
    if (bytes > 1_000_000) push('payload', 'Large HTML payload', 'HTML document is larger than 1 MB. Consider code-splitting and lazy-loading.', 0.4, 'performance', `${Math.round(bytes / 1024)} KB`);
    if (!hasCompression) push('compression', 'Enable text compression', 'Response is not served with gzip/brotli compression.', 0.2, 'performance');
    if (!hasCache) push('cache', 'Configure caching headers', 'No Cache-Control or ETag header detected.', 0.4, 'performance');
    if (scripts > 15) push('scripts', 'Too many script tags', `Page loads ${scripts} script tags. Consider bundling.`, 0.5, 'performance', `${scripts} scripts`);

    if (!hasHttps) push('https', 'Site not served over HTTPS', 'All sites should be served over HTTPS.', 0, 'security');
    if (!hasHsts) push('hsts', 'Missing HSTS header', 'Strict-Transport-Security header not set.', 0.3, 'security');
    if (!hasCsp) push('csp', 'Missing Content-Security-Policy', 'CSP header not configured.', 0.4, 'security');
    if (!hasXcto) push('xcto', 'Missing X-Content-Type-Options', 'Should be set to "nosniff".', 0.5, 'security');
    if (!hasXfo) push('xfo', 'Missing X-Frame-Options or frame-ancestors', 'Page can be embedded in iframes.', 0.5, 'security');

    if (images > 0 && imagesNoAlt > 0) push('img-alt', 'Images missing alt text', `${imagesNoAlt} of ${images} images have no alt attribute.`, 0.3, 'accessibility', `${imagesNoAlt} images`);
    if (!hasLang) push('html-lang', 'Missing lang attribute on <html>', 'Set a language so screen readers pronounce content correctly.', 0.2, 'accessibility');
    if (!hasViewport) push('viewport', 'Missing viewport meta tag', 'Mobile users cannot properly view this page.', 0.1, 'accessibility');

    if (!hasTitle) push('title', 'Missing or empty <title>', 'Pages need a descriptive title for SEO.', 0, 'seo');
    if (!hasMetaDesc) push('meta-desc', 'Missing meta description', 'Add a meta description (50-160 chars).', 0.3, 'seo');
    if (!hasH1) push('h1', 'Missing H1', 'Pages should have a single H1 heading.', 0.4, 'seo');
    if (!hasCanonical) push('canonical', 'Missing canonical link', 'Add <link rel="canonical"> to prevent duplicate content.', 0.5, 'seo');
    if (!hasOg) push('og', 'Missing Open Graph tags', 'Add og:title, og:description, og:image for social sharing.', 0.5, 'seo');
    if (!hasFavicon) push('favicon', 'Missing favicon', 'Add a favicon for browser tabs and bookmarks.', 0.7, 'seo');

    failedAudits.sort((a, b) => a.score - b.score);

    return new Response(JSON.stringify({
      scores,
      metrics,
      failedAudits: failedAudits.slice(0, 30),
      fetchedUrl: res.url || formattedUrl,
      engine: 'projectbond-inhouse-v1',
      timing: { ttfb, total, bytes },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('pagespeed-analyze error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
