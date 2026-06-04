// Generate fix — deterministic templates by category & target type. No AI.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function buildFix(title: string, description: string, target: string): string {
  const t = `${title} ${description}`.toLowerCase();

  // Detect issue type from title/description
  const isBroken = /broken|404|500|5xx|dead link|unreachable|redirect loop/.test(t);
  const isAuth = /login|signin|signup|register|password|auth/.test(t);
  const isPerf = /slow|speed|performance|ttfb|load time|lcp|cls/.test(t);
  const isA11y = /accessibility|alt text|label|screen reader|contrast|aria/.test(t);
  const isMobile = /mobile|viewport|responsive/.test(t);
  const isHttps = /https|ssl|tls|certificate/.test(t);
  const isSeo = /title|meta|description|seo|og:|schema/.test(t);

  if (target === 'replication') {
    return [
      '**Steps to Reproduce:**',
      `1. Open the affected page (see "${title}").`,
      '2. Follow the user flow described in the issue.',
      '3. Observe the failure.',
      '',
      '**Expected Behavior:**',
      'Page loads, action completes, no error shown.',
      '',
      '**Actual Behavior:**',
      description,
      '',
      '**Environment:** Latest Chrome on desktop and mobile.',
    ].join('\n');
  }

  if (target === 'nocode') {
    if (isBroken) return 'Open your site editor (Webflow / Wix / WordPress / Framer). Find the link or page mentioned. Either (a) update the link to point to a working page, (b) restore the missing page, or (c) remove the link entirely. Publish and verify.';
    if (isHttps) return 'In your hosting dashboard (Vercel, Netlify, Cloudflare, GoDaddy, etc.) enable SSL / "Always use HTTPS". Most providers offer free Let\'s Encrypt certificates in one click.';
    if (isSeo) return 'In your CMS page settings, fill in the SEO title (50-60 chars) and meta description (120-160 chars). Add a social-share image (1200x630px). Save and republish.';
    if (isMobile) return 'In your site builder, switch to mobile view. Make sure the responsive layout is enabled. If not, toggle "Mobile responsive" on for each page and adjust any oversized elements.';
    if (isA11y) return 'In your CMS image library, add alt text to every image (describe what it shows). For forms, make sure every field has a visible label, not just placeholder text.';
    return `Open your CMS and locate the page or element mentioned in "${title}". Apply the change described and republish. If you\'re unsure, contact your web developer or post the issue title in your platform\'s support chat.`;
  }

  if (target === 'content') {
    if (isSeo) return `Suggested title: "${title.slice(0, 55)}".\nSuggested meta description: "${description.slice(0, 155)}".`;
    return `Improved copy: rewrite the affected section in plain English. Aim for one clear value statement (under 12 words), one supporting line, and one explicit call-to-action verb (Start, Get, Try, See).`;
  }

  if (target === 'code') {
    if (isHttps) return '```nginx\nserver {\n  listen 80;\n  return 301 https://$host$request_uri;\n}\n```\nOr in a Node/Express app:\n```js\napp.use((req, res, next) => {\n  if (req.header(\'x-forwarded-proto\') !== \'https\') return res.redirect(`https://${req.header(\'host\')}${req.url}`);\n  next();\n});\n```';
    if (isMobile) return '```html\n<meta name="viewport" content="width=device-width, initial-scale=1">\n```\nAdd this inside the <head> of every page.';
    if (isA11y) return '```html\n<!-- before -->\n<input type="email" placeholder="Email">\n<!-- after -->\n<label for="email">Email</label>\n<input id="email" type="email" autocomplete="email" required>\n```';
    if (isSeo) return `\`\`\`html\n<title>${title.slice(0, 55)}</title>\n<meta name="description" content="${description.slice(0, 155)}">\n<meta property="og:title" content="${title.slice(0, 55)}">\n<meta property="og:image" content="https://yoursite.com/og.png">\n\`\`\``;
    if (isBroken) return '```js\n// Audit links on a page\ndocument.querySelectorAll(\'a[href]\').forEach(async a => {\n  try { const r = await fetch(a.href, { method: \'HEAD\' }); if (!r.ok) console.warn(\'broken\', a.href, r.status); }\n  catch (e) { console.warn(\'unreachable\', a.href); }\n});\n```';
    return `// Apply the fix described in "${title}" to the affected component.\n// See dev steps in the same issue for the implementation plan.`;
  }

  if (target === 'visual') {
    return [
      '**Layout:** keep the affected section above the fold on desktop; collapse to a single column on mobile (<768px).',
      '**Spacing:** use 8px / 16px / 24px / 32px rhythm; avoid arbitrary values.',
      '**Color:** primary action uses brand accent at full opacity; secondary actions use neutral border + transparent fill.',
      '**Typography:** headings 24-32px / 600 weight; body 16px / 1.5 line-height.',
      '**Hierarchy:** one clear primary CTA per screen — never two equal-weight buttons next to each other.',
    ].join('\n');
  }

  // dev (default)
  if (isBroken) return `1. Crawl the site for the broken target URL.\n2. Identify whether the page should exist (restore it) or has moved (add a 301 redirect).\n3. If it should not exist, remove all internal links pointing to it.\n4. Add a monitoring check (e.g. Statuscake, UptimeRobot) on critical paths.`;
  if (isAuth) return `1. Reproduce in an incognito window.\n2. Check the network tab for the failing auth request and its response.\n3. Verify the backend endpoint returns the expected status + cookie / token.\n4. Confirm CORS, secure-cookie, and same-site settings on the auth response.\n5. Add an E2E test (Playwright) that covers the full login → dashboard path.`;
  if (isPerf) return `1. Run Lighthouse and PageSpeed Insights on the affected URL.\n2. Identify the largest contentful paint element and lazy-load anything below the fold.\n3. Compress images (WebP / AVIF) and serve via CDN.\n4. Defer non-critical JS; preload critical fonts.\n5. Re-measure and confirm TTFB < 1.5s, LCP < 2.5s.`;
  if (isA11y) return `1. Audit with axe-core or Lighthouse accessibility.\n2. Add <label for> + matching id on every form input.\n3. Add descriptive alt text on every meaningful image.\n4. Ensure focus styles are visible and tab order is logical.\n5. Test with VoiceOver / NVDA.`;
  if (isMobile) return `1. Add the viewport meta tag.\n2. Set max-width: 100% on images and embeds.\n3. Use a responsive grid (CSS grid / flex) — avoid fixed pixel widths.\n4. Test on a real device, not just devtools emulation.`;
  if (isHttps) return `1. Issue a certificate via Let\'s Encrypt (free) or your hosting provider.\n2. Configure the web server to listen on 443.\n3. Add a permanent 301 redirect from http:// to https:// for every path.\n4. Update internal links and canonical tags to https://.\n5. Enable HSTS once verified.`;
  if (isSeo) return `1. Add a unique <title> (50-60 chars) per page.\n2. Add <meta name="description"> (120-160 chars) per page.\n3. Add Open Graph (og:title, og:description, og:image) for social previews.\n4. Submit an updated sitemap.xml to Google Search Console.`;
  return `1. Reproduce the issue described in "${title}".\n2. Identify the affected component / route.\n3. Apply the change implied by the issue description.\n4. Add a regression test.\n5. Verify in staging, then ship.`;
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

    const { issue_id, issue_title, issue_description, target_type } = await req.json();
    if (!issue_title || !issue_description) return new Response(JSON.stringify({ error: 'Issue details required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const fix = buildFix(issue_title, issue_description, target_type || 'dev');

    if (issue_id) {
      const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const updateField = target_type === 'dev' ? 'fix_dev'
        : target_type === 'code' ? 'fix_code'
        : target_type === 'nocode' ? 'fix_nocode'
        : target_type === 'content' ? 'fix_content'
        : 'fix_visual';
      await adminClient.from('scan_issues').update({ [updateField]: fix }).eq('id', issue_id).eq('user_id', user.id);
    }

    return new Response(JSON.stringify({ fix, target_type, source: 'deterministic' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('generate-fix error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
