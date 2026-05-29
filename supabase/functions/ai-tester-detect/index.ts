import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ---- SSRF-safe HTML fetcher ----
function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === '::1' || ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true;
  const parts = ip.split('.').map(n => parseInt(n, 10));
  if (parts.length !== 4 || parts.some(n => isNaN(n))) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}
async function safeFetchHtml(rawUrl: string): Promise<{ html: string; finalUrl: string } | null> {
  let target: URL;
  try { target = new URL(rawUrl); } catch { return null; }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') return null;
  const host = target.hostname.toLowerCase();
  if (['localhost', 'metadata.google.internal'].includes(host) || host.endsWith('.local') || host.endsWith('.internal')) return null;
  try {
    const records = await Promise.allSettled([Deno.resolveDns(host, 'A'), Deno.resolveDns(host, 'AAAA')]);
    for (const r of records) if (r.status === 'fulfilled') for (const ip of r.value) if (isPrivateIp(ip)) return null;
  } catch { /* allow */ }
  const ctl = new AbortController();
  const tid = setTimeout(() => ctl.abort(), 12000);
  try {
    const res = await fetch(target.toString(), {
      redirect: 'follow', signal: ctl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 ProjectBondAITester/1.0' },
    });
    clearTimeout(tid);
    const text = await res.text();
    return { html: text.slice(0, 400_000), finalUrl: res.url };
  } catch { clearTimeout(tid); return null; }
}

// ---- Chatbot / AI input signatures ----
type Signature = { vendor: string; label: string; patterns: RegExp[]; type?: string };
const SIGNATURES: Signature[] = [
  { vendor: 'intercom', label: 'Intercom chat widget', patterns: [/widget\.intercom\.io/i, /intercomSettings/i, /intercom-frame/i, /js\.intercomcdn\.com/i] },
  { vendor: 'drift', label: 'Drift chat widget', patterns: [/js\.driftt?\.com/i, /drift\.load\(/i, /window\.drift/i, /drift-frame-controller/i] },
  { vendor: 'crisp', label: 'Crisp chat widget', patterns: [/client\.crisp\.chat/i, /\$crisp/i, /CRISP_WEBSITE_ID/i] },
  { vendor: 'tawk', label: 'Tawk.to chat widget', patterns: [/embed\.tawk\.to/i, /Tawk_API/i] },
  { vendor: 'tidio', label: 'Tidio chat widget', patterns: [/code\.tidio\.co/i, /tidioChatApi/i, /tidio-chat/i] },
  { vendor: 'zendesk', label: 'Zendesk Web Widget / AI Answer Bot', patterns: [/static\.zdassets\.com/i, /zEmbed/i, /\bzE\(/i, /zopim/i] },
  { vendor: 'hubspot', label: 'HubSpot chat / chatflow', patterns: [/js\.hs-scripts\.com/i, /HubSpotConversations/i, /hubspot-messages-iframe/i, /js\.usemessages\.com/i] },
  { vendor: 'livechat', label: 'LiveChat widget', patterns: [/cdn\.livechatinc\.com/i, /__lc\s*=/i] },
  { vendor: 'olark', label: 'Olark chat widget', patterns: [/static\.olark\.com/i, /olark\(/i] },
  { vendor: 'freshchat', label: 'Freshchat / Freshdesk AI', patterns: [/wchat\.freshchat\.com/i, /fcWidget/i, /freshworks-frame/i] },
  { vendor: 'gorgias', label: 'Gorgias chat widget', patterns: [/config\.gorgias\.chat/i, /gorgias-chat-container/i] },
  { vendor: 'voiceflow', label: 'Voiceflow AI assistant', patterns: [/general-runtime\.voiceflow\.com/i, /voiceflow.*widget/i, /cdn\.voiceflow\.com/i] },
  { vendor: 'landbot', label: 'Landbot AI bot', patterns: [/static\.landbot\.io/i, /landbot\.io\/u\//i, /landbot-container/i] },
  { vendor: 'tars', label: 'Tars chatbot', patterns: [/chatbot\.hellotars\.com/i, /hellotars\.com/i] },
  { vendor: 'botpress', label: 'Botpress AI bot', patterns: [/cdn\.botpress\.cloud/i, /botpress-webchat/i, /botpress\.io/i] },
  { vendor: 'manychat', label: 'ManyChat widget', patterns: [/manychat\.com\/.*widget/i, /widget\.manychat\.com/i] },
  { vendor: 'chatbase', label: 'Chatbase AI bot', patterns: [/chatbase\.co/i, /chatbase-bubble/i, /www\.chatbase\.co\/embed/i] },
  { vendor: 'kommunicate', label: 'Kommunicate AI bot', patterns: [/kommunicate\.io/i, /kommunicate-widget/i] },
  { vendor: 'ada', label: 'Ada AI customer-service bot', patterns: [/static\.ada\.support/i, /adaEmbed/i, /\bada-chat\b/i] },
  { vendor: 'chaport', label: 'Chaport chat', patterns: [/app\.chaport\.com/i, /chaportConfig/i] },
  { vendor: 'userlike', label: 'Userlike messenger', patterns: [/userlike-cdn-widgets/i, /userlike\.com/i] },
  { vendor: 'smartsupp', label: 'Smartsupp chat', patterns: [/www\.smartsuppchat\.com/i, /_smartsupp/i] },
  { vendor: 'jivochat', label: 'JivoChat widget', patterns: [/code\.jivosite\.com/i, /jivo_api/i] },
  { vendor: 'reamaze', label: 'Re:amaze chat', patterns: [/cdn\.reamaze\.com/i, /reamaze-widget/i] },
  { vendor: 'helpshift', label: 'Helpshift chat', patterns: [/helpshift\.com/i, /HelpshiftConfig/i] },
  { vendor: 'sendbird', label: 'Sendbird AI chatbot', patterns: [/sendbird\.com/i, /sb_widget/i] },
  { vendor: 'typebot', label: 'Typebot AI form', patterns: [/typebot\.io/i, /typebot-standard/i, /typebot-bubble/i] },
  { vendor: 'wonderchat', label: 'Wonderchat AI bot', patterns: [/wonderchat\.io/i, /wonderchat-widget/i] },
  { vendor: 'botsonic', label: 'Botsonic / Writesonic AI bot', patterns: [/botsonic\.com/i, /widget\.writesonic\.com/i] },
  { vendor: 'stackai', label: 'Stack AI assistant', patterns: [/stack-ai\.com/i, /stackai/i] },
  { vendor: 'cal-ai', label: 'Cal.com AI scheduler', patterns: [/cal\.com\/embed/i] },
  { vendor: 'openai', label: 'OpenAI Assistant / GPT embed', patterns: [/chat\.openai\.com\/share/i, /platform\.openai\.com\/.*assistant/i, /openai\.com.*chat/i] },
  { vendor: 'anthropic', label: 'Anthropic Claude widget', patterns: [/claude\.ai\/embed/i, /anthropic.*widget/i] },
  { vendor: 'perplexity', label: 'Perplexity AI search embed', patterns: [/perplexity\.ai\/embed/i] },
  { vendor: 'replai', label: 'Custom GPT bubble', patterns: [/chatgpt-widget/i, /openai\.com.*widget/i] },
];

// AI input field heuristics — broadened
const AI_INPUT_RE = /<(?:input|textarea)\b[^>]*(?:placeholder|aria-label|name|id)=["']([^"']*?(?:ask|chat|message|prompt|ai|assistant|how can i help|how may i help|question|query|search anything|ask anything)[^"']*)["'][^>]*>/gi;
const AI_BUTTON_RE = /<(?:button|a)\b[^>]*>([^<]*?(?:ask\s*ai|ai\s*assistant|chat\s*with\s*ai|ask\s*anything|talk\s*to\s*ai|chat\s*now|open\s*chat|start\s*chat|chat\s*with\s*us|message\s*us)[^<]*?)<\/(?:button|a)>/gi;
// Generic AI markers in code / data attributes / iframes / fetch URLs
const GENERIC_AI_MARKERS: { label: string; re: RegExp }[] = [
  { label: 'iframe pointing at chat/AI host', re: /<iframe\b[^>]*src=["'][^"']*(?:chat|bot|assistant|ai-widget|copilot)[^"']*["']/i },
  { label: 'data-* attribute referencing chat/AI', re: /\bdata-(?:chat|bot|ai|assistant|widget-id|chatbot)[^=>\s]*=["'][^"']+["']/i },
  { label: 'fetch/XHR to /api/chat or /api/assistant', re: /["'](\/api\/(?:chat|assistant|ai|message|completion|completions))["']/i },
  { label: 'inline reference to OpenAI/Anthropic/Gemini SDK', re: /(?:openai|anthropic|@google\/generative-ai|googleapis\.com\/.*generativelanguage|mistral|cohere|x\.ai\/grok)/i },
  { label: 'model string (gpt-/claude-/gemini-)', re: /["'](?:gpt-[0-9]|claude-[0-9]|gemini-[0-9]|mistral-|llama-?[0-9])/i },
  { label: 'chat bubble container class', re: /class=["'][^"']*(?:chat-bubble|chat-widget|chatbot-container|ai-assistant|chat-launcher)[^"']*["']/i },
];

type Detected = {
  type: 'chat_widget' | 'ai_form' | 'ai_button';
  vendor: string | null;
  label: string;
  evidence: string;
};

function detectInHtml(html: string): Detected[] {
  const found: Detected[] = [];
  const seenLabels = new Set<string>();
  const push = (d: Detected) => { if (!seenLabels.has(d.label)) { seenLabels.add(d.label); found.push(d); } };

  for (const sig of SIGNATURES) {
    for (const p of sig.patterns) {
      const m = html.match(p);
      if (m) {
        push({ type: 'chat_widget', vendor: sig.vendor, label: sig.label, evidence: m[0].slice(0, 200) });
        break;
      }
    }
  }

  let im: RegExpExecArray | null;
  while ((im = AI_INPUT_RE.exec(html))) {
    push({ type: 'ai_form', vendor: null, label: `AI input field: "${im[1].slice(0, 60)}"`, evidence: im[0].slice(0, 200) });
    if (found.filter(f => f.type === 'ai_form').length >= 5) break;
  }

  let bm: RegExpExecArray | null;
  while ((bm = AI_BUTTON_RE.exec(html))) {
    const t = bm[1].replace(/\s+/g, ' ').trim();
    if (t) push({ type: 'ai_button', vendor: null, label: `AI button: "${t.slice(0, 60)}"`, evidence: bm[0].slice(0, 200) });
    if (found.filter(f => f.type === 'ai_button').length >= 5) break;
  }

  for (const g of GENERIC_AI_MARKERS) {
    const m = html.match(g.re);
    if (m) push({ type: 'chat_widget', vendor: null, label: `Generic AI marker — ${g.label}`, evidence: m[0].slice(0, 200) });
  }

  return found;
}

// Pages most likely to host an AI/chat surface even if the homepage doesn't
const PROBE_PATHS = ['/', '/contact', '/support', '/help', '/chat', '/ai', '/assistant', '/demo', '/pricing', '/docs', '/login'];


serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json().catch(() => ({}));
    const manualUrl: string | undefined = body?.url;

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Build URL list: manual URL takes priority; otherwise scan all user websites
    let targets: { url: string; website_id: string | null }[] = [];
    if (manualUrl) {
      targets.push({ url: manualUrl, website_id: null });
    } else {
      const { data: websites } = await admin
        .from('websites')
        .select('id, url')
        .eq('user_id', user.id);
      targets = (websites || []).map(w => ({ url: w.url, website_id: w.id }));
    }

    if (targets.length === 0) {
      return new Response(JSON.stringify({ detected: [], scanned: 0, message: 'No websites to scan' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const allFound: any[] = [];
    let scanned = 0;

    let probedPages = 0;
    const MAX_PAGES_PER_SITE = 300;
    const MAX_TIME_PER_SITE_MS = 60_000;

    for (const t of targets.slice(0, 10)) {
      let origin: URL;
      try { origin = new URL(t.url); } catch { continue; }
      const originStr = origin.origin;
      const startedAt = Date.now();
      const followed = new Set<string>();
      const queue: string[] = [];

      // 1. Seed: user URL + common AI/chat probe paths
      queue.push(t.url);
      for (const p of PROBE_PATHS) {
        try { queue.push(new URL(p, originStr).toString()); } catch { /* ignore */ }
      }

      // 2. Seed from sitemap.xml
      try {
        const sm = await safeFetchHtml(new URL('/sitemap.xml', originStr).toString());
        if (sm) {
          const locs = [...sm.html.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1]).slice(0, MAX_PAGES_PER_SITE * 2);
          for (const u of locs) if (u.startsWith(originStr)) queue.push(u);
        }
      } catch { /* ignore */ }

      let foundAnyForTarget = false;
      let pagesVisited = 0;

      while (pagesVisited < MAX_PAGES_PER_SITE && queue.length && Date.now() - startedAt < MAX_TIME_PER_SITE_MS) {
        const batch = queue.splice(0, 4).filter(u => !followed.has(u));
        if (!batch.length) continue;
        for (const u of batch) followed.add(u);
        const results = await Promise.all(batch.map(async (u) => ({ u, page: await safeFetchHtml(u) })));
        for (const { u, page } of results) {
          if (!page) continue;
          probedPages++; pagesVisited++;
          const found = detectInHtml(page.html);
          if (found.length) foundAnyForTarget = true;
          for (const f of found) {
            const { data: existing } = await admin
              .from('ai_endpoints')
              .select('id')
              .eq('user_id', user.id)
              .eq('source_url', page.finalUrl)
              .eq('label', f.label)
              .maybeSingle();
            if (existing) continue;
            const { data: inserted } = await admin.from('ai_endpoints').insert({
              user_id: user.id,
              website_id: t.website_id,
              source_url: page.finalUrl,
              type: f.type,
              vendor: f.vendor,
              label: f.label,
              evidence: f.evidence,
            }).select('*').single();
            if (inserted) allFound.push(inserted);
          }
          // BFS — discover more internal links from this page
          if (pagesVisited < MAX_PAGES_PER_SITE) {
            const linkMatches = [...page.html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].slice(0, 200);
            for (const m of linkMatches) {
              try {
                const abs = new URL(m[1], page.finalUrl).toString();
                if (abs.startsWith(originStr) && !followed.has(abs) && queue.length < MAX_PAGES_PER_SITE * 3) {
                  queue.push(abs);
                }
              } catch { /* ignore */ }
            }
          }
        }
      }
      if (foundAnyForTarget) scanned++;
    }



    const noneFoundHint = allFound.length === 0
      ? 'No AI chatbots or AI inputs were detected on the crawled pages. Many widgets are loaded after JS execution — if you know the URL of a chatbot or AI page on your site, paste it directly to test it.'
      : null;

    return new Response(JSON.stringify({ detected: allFound, scanned, probed_pages: probedPages, total_targets: targets.length, hint: noneFoundHint }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('ai-tester-detect error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
