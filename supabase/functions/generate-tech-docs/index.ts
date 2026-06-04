// Tech docs / feature extraction — deterministic, no AI.
// Detects frameworks, integrations, and likely architecture from raw HTML signals.
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

function detectStack(html: string, headers: Headers) {
  const stack: { name: string; why_we_think_so: string }[] = [];
  const integrations: { name: string; purpose: string }[] = [];
  const h = html.toLowerCase();
  const server = headers.get('server') || '';
  const xPoweredBy = headers.get('x-powered-by') || '';

  // Frameworks
  if (/__next_data__|_next\//i.test(html)) stack.push({ name: 'Next.js', why_we_think_so: 'Found __NEXT_DATA__ / _next/ assets.' });
  else if (/<div[^>]+id=["']__nuxt["']/i.test(html)) stack.push({ name: 'Nuxt.js', why_we_think_so: 'Found __nuxt mount.' });
  else if (/<div[^>]+id=["']root["']/i.test(html) && /react/i.test(h)) stack.push({ name: 'React', why_we_think_so: 'Found <div id="root"> + React references.' });
  else if (/<div[^>]+id=["']app["']/i.test(html) && /vue/i.test(h)) stack.push({ name: 'Vue', why_we_think_so: 'Found <div id="app"> + Vue references.' });
  if (/svelte/i.test(h)) stack.push({ name: 'Svelte', why_we_think_so: 'Svelte runtime detected.' });
  if (/wp-content|wp-includes/i.test(h)) stack.push({ name: 'WordPress', why_we_think_so: 'wp-content/wp-includes paths in HTML.' });
  if (/shopify/i.test(h)) stack.push({ name: 'Shopify', why_we_think_so: 'Shopify CDN or script references.' });
  if (/wix\.com|static\.wixstatic/i.test(h)) stack.push({ name: 'Wix', why_we_think_so: 'Wix assets in HTML.' });
  if (/webflow/i.test(h)) stack.push({ name: 'Webflow', why_we_think_so: 'Webflow assets in HTML.' });
  if (/framer/i.test(h)) stack.push({ name: 'Framer', why_we_think_so: 'Framer references in HTML.' });
  if (server) stack.push({ name: `Server: ${server}`, why_we_think_so: 'From HTTP Server header.' });
  if (xPoweredBy) stack.push({ name: `Powered by: ${xPoweredBy}`, why_we_think_so: 'From X-Powered-By header.' });
  if (/tailwind/i.test(h)) stack.push({ name: 'Tailwind CSS', why_we_think_so: 'tailwind class patterns.' });

  // Integrations
  if (/googletagmanager\.com/i.test(h)) integrations.push({ name: 'Google Tag Manager', purpose: 'Marketing tag orchestration' });
  if (/google-analytics|gtag\.js|ga\.js/i.test(h)) integrations.push({ name: 'Google Analytics', purpose: 'Web analytics' });
  if (/segment\.com|cdn\.segment\.io/i.test(h)) integrations.push({ name: 'Segment', purpose: 'Customer data pipeline' });
  if (/intercom/i.test(h)) integrations.push({ name: 'Intercom', purpose: 'Live chat / support' });
  if (/hubspot/i.test(h)) integrations.push({ name: 'HubSpot', purpose: 'CRM / marketing' });
  if (/stripe\.com|js\.stripe/i.test(h)) integrations.push({ name: 'Stripe', purpose: 'Payments' });
  if (/paypal/i.test(h)) integrations.push({ name: 'PayPal', purpose: 'Payments' });
  if (/supabase/i.test(h)) integrations.push({ name: 'Supabase', purpose: 'Auth + database backend' });
  if (/firebase/i.test(h)) integrations.push({ name: 'Firebase', purpose: 'Auth + database backend' });
  if (/sentry/i.test(h)) integrations.push({ name: 'Sentry', purpose: 'Error monitoring' });
  if (/cloudflare/i.test(h) || /cloudflare/i.test(server)) integrations.push({ name: 'Cloudflare', purpose: 'CDN / DDoS protection' });
  if (/vercel/i.test(h) || /vercel/i.test(server)) integrations.push({ name: 'Vercel', purpose: 'Hosting / edge network' });
  if (/netlify/i.test(h) || /netlify/i.test(server)) integrations.push({ name: 'Netlify', purpose: 'Hosting' });
  if (/typeform/i.test(h)) integrations.push({ name: 'Typeform', purpose: 'Forms' });
  if (/mailchimp/i.test(h)) integrations.push({ name: 'Mailchimp', purpose: 'Email marketing' });

  return { stack, integrations };
}

function detectFeatures(html: string) {
  const f: any[] = [];
  const h = html.toLowerCase();
  if (/<input[^>]+type=["']password["']/i.test(html)) f.push({ name: 'User authentication', description: 'Password field detected — login or signup form present.', category: 'auth', confidence: 'high' });
  if (/<input[^>]+type=["']email["']/i.test(html) && !/password/i.test(h)) f.push({ name: 'Email capture', description: 'Email input field without password — likely newsletter or contact form.', category: 'marketing', confidence: 'high' });
  if (/cart|checkout|add to bag|add to basket/i.test(h)) f.push({ name: 'E-commerce / cart', description: 'Cart or checkout language detected.', category: 'commerce', confidence: /\$|usd|eur|gbp/i.test(h) ? 'high' : 'medium' });
  if (/search/i.test(h) && /<input[^>]+(type=["']search["']|name=["']q["'])/i.test(html)) f.push({ name: 'Site search', description: 'Search input detected.', category: 'navigation', confidence: 'high' });
  if (/<nav\b/i.test(html)) f.push({ name: 'Top navigation', description: 'Standard <nav> element present.', category: 'navigation', confidence: 'high' });
  if (/<footer\b/i.test(html)) f.push({ name: 'Footer', description: '<footer> element present.', category: 'navigation', confidence: 'high' });
  if (/blog|article|post/i.test(h)) f.push({ name: 'Blog / content', description: 'Blog / article language detected.', category: 'content', confidence: 'medium' });
  if (/contact/i.test(h)) f.push({ name: 'Contact', description: 'Contact form or page referenced.', category: 'support', confidence: 'medium' });

  const recommended: any[] = [];
  if (!f.some(x => x.category === 'auth')) recommended.push({ name: 'User accounts', why: 'Lets you personalise, retain users and gate features.', impact: 'high' });
  if (!f.some(x => x.name === 'Site search')) recommended.push({ name: 'Site search', why: 'Visitors who use search convert 2-4x higher.', impact: 'medium' });
  if (!f.some(x => x.name === 'Blog / content')) recommended.push({ name: 'Blog / content hub', why: 'Drives organic SEO traffic over time.', impact: 'medium' });
  if (!/og:image/i.test(html)) recommended.push({ name: 'Social share previews', why: 'og:image / og:title make links look professional when shared.', impact: 'low' });
  return { detected: f, recommended };
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

    const { url, mode = 'docs', audience_role, github_repo_url } = await req.json();
    if (!url) return new Response(JSON.stringify({ error: 'URL is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    let formatted = url.trim();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) formatted = `https://${formatted}`;
    let parsedUrl: URL;
    try { parsedUrl = new URL(formatted); } catch {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (parsedUrl.protocol !== 'https:') return new Response(JSON.stringify({ error: 'Only https:// URLs are allowed' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const hostname = parsedUrl.hostname.toLowerCase();
    if (['localhost', 'metadata.google.internal'].includes(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return new Response(JSON.stringify({ error: 'Blocked hostname' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    try {
      const records = await Promise.allSettled([Deno.resolveDns(hostname, 'A').catch(() => []), Deno.resolveDns(hostname, 'AAAA').catch(() => [])]);
      const ips: string[] = [];
      for (const r of records) if (r.status === 'fulfilled') ips.push(...(r.value as string[]));
      if (ips.some(isPrivateIp)) return new Response(JSON.stringify({ error: 'Blocked: private/internal IP' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } catch { /* ignore */ }

    let html = '';
    let pageTitle = '';
    let headers = new Headers();
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(formatted, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 ProjectBondBot/2.0' } });
      clearTimeout(t);
      headers = res.headers;
      if (res.ok) {
        const text = await res.text();
        html = text.slice(0, 60000);
        pageTitle = text.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || '';
      }
    } catch (e) { console.warn('Fetch failed:', e); }

    if (mode === 'features') {
      const { detected, recommended } = detectFeatures(html);
      return new Response(JSON.stringify({
        mode, url: formatted,
        data: {
          detected, recommended,
          summary: `Detected ${detected.length} feature(s) on ${pageTitle || formatted}. ${recommended.length} recommended addition(s).`,
        },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // mode === 'docs'
    const { stack, integrations } = detectStack(html, headers);

    const isShopify = stack.some(s => s.name === 'Shopify');
    const isWordPress = stack.some(s => s.name === 'WordPress');
    const isReact = stack.some(s => /react|next/i.test(s.name));

    const dbGuess: any[] = [];
    if (isShopify) {
      dbGuess.push({ name: 'products', purpose: 'Storefront catalog', key_fields: ['id', 'title', 'price', 'variants'] });
      dbGuess.push({ name: 'orders', purpose: 'Customer purchases', key_fields: ['id', 'customer_id', 'line_items', 'total', 'status'] });
      dbGuess.push({ name: 'customers', purpose: 'Buyer accounts', key_fields: ['id', 'email', 'addresses'] });
    } else if (isWordPress) {
      dbGuess.push({ name: 'wp_posts', purpose: 'Pages + blog posts', key_fields: ['ID', 'post_title', 'post_content', 'post_status'] });
      dbGuess.push({ name: 'wp_users', purpose: 'Editors and admins', key_fields: ['ID', 'user_login', 'user_email'] });
      dbGuess.push({ name: 'wp_options', purpose: 'Site settings', key_fields: ['option_name', 'option_value'] });
    } else {
      if (/password/i.test(html)) dbGuess.push({ name: 'users', purpose: 'Authentication', key_fields: ['id', 'email', 'password_hash', 'created_at'] });
      if (/cart|checkout/i.test(html.toLowerCase())) {
        dbGuess.push({ name: 'products', purpose: 'Catalog', key_fields: ['id', 'name', 'price'] });
        dbGuess.push({ name: 'orders', purpose: 'Purchases', key_fields: ['id', 'user_id', 'total', 'status'] });
      }
      if (/blog|article/i.test(html.toLowerCase())) dbGuess.push({ name: 'posts', purpose: 'Blog content', key_fields: ['id', 'title', 'body', 'author_id', 'published_at'] });
      if (!dbGuess.length) dbGuess.push({ name: '(unknown)', purpose: 'No clear data model visible from public HTML.', key_fields: [] });
    }

    const architecture_diagram: any[] = [
      { name: 'Browser', role: 'End-user device rendering the site.', layer: 'frontend', connects_to: ['Web app'] },
      { name: 'Web app', role: stack[0]?.name || 'Static or server-rendered site.', layer: 'frontend', connects_to: ['API / Backend', 'CDN'] },
      { name: 'CDN', role: 'Static asset delivery.', layer: 'infra', connects_to: ['Web app'] },
      { name: 'API / Backend', role: 'Business logic and data access.', layer: 'backend', connects_to: ['Database'] },
      { name: 'Database', role: 'Persistent storage for users / content / orders.', layer: 'data', connects_to: [] },
    ];
    for (const it of integrations) architecture_diagram.push({ name: it.name, role: it.purpose, layer: 'integration', connects_to: ['Web app'] });

    const workflows = [
      /password/i.test(html) ? { name: 'Sign up & sign in', steps: ['Visit /signup', 'Enter email + password', 'Verify email', 'Land on dashboard'] } : null,
      /cart|checkout/i.test(html.toLowerCase()) ? { name: 'Browse → buy', steps: ['Browse catalog', 'Add product to cart', 'Go to checkout', 'Enter payment', 'Receive confirmation'] } : null,
      { name: 'Visit & explore', steps: ['Land on homepage', 'Click main CTA', 'Read product/feature page', 'Convert via form or signup'] },
      /contact/i.test(html.toLowerCase()) ? { name: 'Contact / support', steps: ['Open contact page', 'Fill form', 'Submit', 'Team receives email or ticket'] } : null,
    ].filter(Boolean);

    const key_pages = [
      { path: '/', purpose: 'Homepage — main value pitch.' },
      /pricing/i.test(html) ? { path: '/pricing', purpose: 'Pricing plans.' } : null,
      /password/i.test(html) ? { path: '/login', purpose: 'Existing-user sign-in.' } : null,
      /password/i.test(html) ? { path: '/signup', purpose: 'New-user signup.' } : null,
      /contact/i.test(html.toLowerCase()) ? { path: '/contact', purpose: 'Contact form / support.' } : null,
    ].filter(Boolean);

    const env_vars: string[] = [];
    if (integrations.some(i => i.name === 'Stripe')) env_vars.push('STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET');
    if (integrations.some(i => i.name === 'Supabase')) env_vars.push('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY');
    if (integrations.some(i => i.name === 'Firebase')) env_vars.push('FIREBASE_API_KEY', 'FIREBASE_PROJECT_ID');
    if (integrations.some(i => i.name === 'Sentry')) env_vars.push('SENTRY_DSN');

    const tech_stack_guess = stack.length ? stack : [{ name: '(no clear signals)', why_we_think_so: 'Site is mostly static HTML or hides its stack.' }];

    const data = {
      project_overview: `Onboarding doc for ${pageTitle || formatted}. ${audience_role ? `Tailored for: ${audience_role}.` : ''} Generated automatically from public HTML signals (no AI).`,
      tech_stack_guess,
      architecture: `Frontend: ${stack[0]?.name || 'unknown'}. Backend: ${stack.find(s => /server:/i.test(s.name))?.name || 'unknown / hosted service'}. ${integrations.length ? `Integrations: ${integrations.map(i => i.name).join(', ')}.` : 'No third-party integrations detected in public HTML.'}`,
      architecture_diagram,
      database_schema_guess: dbGuess,
      user_workflows: workflows,
      integrations,
      key_pages,
      local_setup: [
        '1. Clone the repository' + (github_repo_url ? ` (${github_repo_url})` : ''),
        '2. Install dependencies (npm install / yarn / pnpm).',
        '3. Copy .env.example to .env and fill in the values.',
        '4. Run the dev server (npm run dev or equivalent).',
        '5. Open the local URL printed in the terminal.',
      ],
      env_vars_likely: env_vars.length ? env_vars : ['(no obvious env vars from public signals)'],
      gotchas: [
        isReact ? 'SPA routing — refreshing a deep link may 404 unless server fallback to index.html is configured.' : 'Cache-busting — static assets may need versioned filenames.',
        'Public env vars (VITE_*, NEXT_PUBLIC_*) are shipped to the browser. Never put secrets there.',
        'HTTPS-only cookies break local http://localhost dev unless explicitly relaxed.',
      ],
      first_week_checklist: [
        'Clone the repo and run it locally.',
        'Read this doc end-to-end.',
        'Shadow a teammate on a real ticket.',
        'Ship one tiny PR (typo, copy fix, dependency bump).',
        'Map the user journey from landing page to primary conversion.',
      ],
    };

    return new Response(JSON.stringify({ mode, url: formatted, data, source: 'deterministic' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('generate-tech-docs error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
