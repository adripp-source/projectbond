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
  { vendor: 'intercom', label: 'Intercom chat widget', patterns: [/widget\.intercom\.io/i, /intercomSettings/i, /intercom-frame/i] },
  { vendor: 'drift', label: 'Drift chat widget', patterns: [/js\.driftt?\.com/i, /drift\.load\(/i, /window\.drift/i] },
  { vendor: 'crisp', label: 'Crisp chat widget', patterns: [/client\.crisp\.chat/i, /\$crisp/i, /CRISP_WEBSITE_ID/i] },
  { vendor: 'tawk', label: 'Tawk.to chat widget', patterns: [/embed\.tawk\.to/i, /Tawk_API/i] },
  { vendor: 'tidio', label: 'Tidio chat widget', patterns: [/code\.tidio\.co/i, /tidioChatApi/i] },
  { vendor: 'zendesk', label: 'Zendesk Web Widget', patterns: [/static\.zdassets\.com/i, /zEmbed/i, /zE\(/i] },
  { vendor: 'hubspot', label: 'HubSpot chat / chatflow', patterns: [/js\.hs-scripts\.com/i, /HubSpotConversations/i, /hubspot-messages-iframe/i] },
  { vendor: 'livechat', label: 'LiveChat widget', patterns: [/cdn\.livechatinc\.com/i, /__lc\s*=/i] },
  { vendor: 'olark', label: 'Olark chat widget', patterns: [/static\.olark\.com/i, /olark\(/i] },
  { vendor: 'freshchat', label: 'Freshchat widget', patterns: [/wchat\.freshchat\.com/i, /fcWidget/i] },
  { vendor: 'gorgias', label: 'Gorgias chat widget', patterns: [/config\.gorgias\.chat/i, /gorgias-chat-container/i] },
  { vendor: 'voiceflow', label: 'Voiceflow AI assistant', patterns: [/general-runtime\.voiceflow\.com/i, /voiceflow.*widget/i] },
  { vendor: 'landbot', label: 'Landbot AI bot', patterns: [/static\.landbot\.io/i, /landbot\.io\/u\//i] },
  { vendor: 'tars', label: 'Tars chatbot', patterns: [/chatbot\.hellotars\.com/i, /hellotars\.com/i] },
  { vendor: 'botpress', label: 'Botpress AI bot', patterns: [/cdn\.botpress\.cloud/i, /botpress-webchat/i] },
  { vendor: 'manychat', label: 'ManyChat widget', patterns: [/manychat\.com\/.*widget/i, /widget\.manychat\.com/i] },
  { vendor: 'chatbase', label: 'Chatbase AI bot', patterns: [/chatbase\.co/i, /chatbase-bubble/i] },
  { vendor: 'kommunicate', label: 'Kommunicate AI bot', patterns: [/kommunicate\.io/i, /kommunicate-widget/i] },
  { vendor: 'replai', label: 'Custom GPT bubble', patterns: [/chatgpt-widget/i, /openai\.com.*widget/i] },
];

// AI input field heuristics (textarea / input that looks like an AI prompt box)
const AI_INPUT_RE = /<(?:input|textarea)\b[^>]*placeholder=["']([^"']*?(?:ask|chat|message|prompt|ai|assistant|how can i help|question)[^"']*)["'][^>]*>/gi;
const AI_BUTTON_RE = /<button\b[^>]*>([^<]*?(?:ask\s*ai|ai\s*assistant|chat with ai|ask anything|talk to ai)[^<]*?)<\/button>/gi;

type Detected = {
  type: 'chat_widget' | 'ai_form' | 'ai_button';
  vendor: string | null;
  label: string;
  evidence: string;
};

function detectInHtml(html: string): Detected[] {
  const found: Detected[] = [];
  for (const sig of SIGNATURES) {
    for (const p of sig.patterns) {
      const m = html.match(p);
      if (m) {
        found.push({
          type: 'chat_widget',
          vendor: sig.vendor,
          label: sig.label,
          evidence: m[0].slice(0, 200),
        });
        break;
      }
    }
  }

  let im: RegExpExecArray | null;
  const inputMatches: string[] = [];
  while ((im = AI_INPUT_RE.exec(html)) && inputMatches.length < 5) {
    if (!inputMatches.includes(im[1])) {
      inputMatches.push(im[1]);
      found.push({
        type: 'ai_form',
        vendor: null,
        label: `AI input field: "${im[1].slice(0, 60)}"`,
        evidence: im[0].slice(0, 200),
      });
    }
  }

  let bm: RegExpExecArray | null;
  const btnMatches: string[] = [];
  while ((bm = AI_BUTTON_RE.exec(html)) && btnMatches.length < 5) {
    const t = bm[1].replace(/\s+/g, ' ').trim();
    if (t && !btnMatches.includes(t)) {
      btnMatches.push(t);
      found.push({
        type: 'ai_button',
        vendor: null,
        label: `AI button: "${t.slice(0, 60)}"`,
        evidence: bm[0].slice(0, 200),
      });
    }
  }

  return found;
}

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

    for (const t of targets.slice(0, 10)) {
      const page = await safeFetchHtml(t.url);
      if (!page) continue;
      scanned++;
      const found = detectInHtml(page.html);
      for (const f of found) {
        // Upsert: if same user+source_url+vendor+label exists, skip
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
    }

    return new Response(JSON.stringify({ detected: allFound, scanned, total_targets: targets.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('ai-tester-detect error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
