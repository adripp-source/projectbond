import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ---- SSRF-safe fetcher (mirrors pagespeed-analyze) ----
function isPrivate(ip: string): boolean {
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
    const records = await Promise.allSettled([
      Deno.resolveDns(host, 'A'),
      Deno.resolveDns(host, 'AAAA'),
    ]);
    for (const r of records) {
      if (r.status === 'fulfilled') for (const ip of r.value) if (isPrivate(ip)) return null;
    }
  } catch { /* DNS may fail for some hosts; allow fetch to try */ }

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(target.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 ProjectBondFlow/1.0' },
    });
    clearTimeout(tid);
    if (!res.ok) return null;
    const text = await res.text();
    return { html: text.slice(0, 250_000), finalUrl: res.url };
  } catch {
    clearTimeout(tid);
    return null;
  }
}

function extractSiteContext(html: string, baseUrl: string) {
  const origin = new URL(baseUrl).origin;
  const title = (html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '').trim().slice(0, 200);
  const description = (html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i)?.[1] || '').slice(0, 300);

  const links = new Set<string>();
  const linkRe = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const internal: { href: string; text: string }[] = [];
  const external: { href: string; text: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) && internal.length + external.length < 80) {
    const href = m[1].trim();
    const text = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;
    let abs: string;
    try { abs = new URL(href, baseUrl).toString(); } catch { continue; }
    if (links.has(abs)) continue;
    links.add(abs);
    const sameOrigin = abs.startsWith(origin);
    (sameOrigin ? internal : external).push({ href: abs, text: text || abs });
  }

  const forms: { action: string; method: string; fields: string[] }[] = [];
  const formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let fm: RegExpExecArray | null;
  while ((fm = formRe.exec(html)) && forms.length < 10) {
    const attrs = fm[1];
    const body = fm[2];
    const action = attrs.match(/action=["']([^"']+)["']/i)?.[1] || baseUrl;
    const method = (attrs.match(/method=["']([^"']+)["']/i)?.[1] || 'get').toLowerCase();
    const fields: string[] = [];
    const inputRe = /<(?:input|select|textarea)\b[^>]*name=["']([^"']+)["'][^>]*>/gi;
    let ifm: RegExpExecArray | null;
    while ((ifm = inputRe.exec(body)) && fields.length < 10) fields.push(ifm[1]);
    forms.push({ action, method, fields });
  }

  const buttonRe = /<button\b[^>]*>([\s\S]*?)<\/button>/gi;
  const buttons: string[] = [];
  let bm: RegExpExecArray | null;
  while ((bm = buttonRe.exec(html)) && buttons.length < 15) {
    const t = bm[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (t && t.length < 50) buttons.push(t);
  }

  return { title, description, internal: internal.slice(0, 40), external: external.slice(0, 15), forms, buttons };
}

function autoLayout(nodes: any[], edges: any[]) {
  // Build depth from edges (BFS from nodes with no incoming)
  const incoming: Record<string, number> = {};
  nodes.forEach(n => { incoming[n.id] = 0; });
  edges.forEach(e => { if (incoming[e.to] !== undefined) incoming[e.to]++; });
  const depth: Record<string, number> = {};
  const queue: string[] = nodes.filter(n => (incoming[n.id] || 0) === 0).map(n => n.id);
  queue.forEach(id => { depth[id] = 0; });
  if (queue.length === 0 && nodes[0]) { queue.push(nodes[0].id); depth[nodes[0].id] = 0; }
  const adj: Record<string, string[]> = {};
  edges.forEach(e => { (adj[e.from] = adj[e.from] || []).push(e.to); });
  while (queue.length) {
    const id = queue.shift()!;
    (adj[id] || []).forEach(to => {
      if (depth[to] === undefined) { depth[to] = (depth[id] || 0) + 1; queue.push(to); }
    });
  }
  // Group by depth column
  const cols: Record<number, string[]> = {};
  nodes.forEach(n => {
    const d = depth[n.id] ?? 0;
    (cols[d] = cols[d] || []).push(n.id);
  });
  const COL_W = 300, ROW_H = 110, X0 = 80, Y0 = 60;
  nodes.forEach(n => {
    const d = depth[n.id] ?? 0;
    const row = cols[d].indexOf(n.id);
    n.x = X0 + d * COL_W;
    n.y = Y0 + row * ROW_H;
  });
  return nodes;
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

    const { url, annotations, mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    // ============ FLOW MODE ============
    if (mode === 'flow') {
      if (!url) {
        return new Response(JSON.stringify({ error: 'URL is required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 1. Crawl the homepage + a few internal links to build context
      const home = await safeFetchHtml(url);
      const pages: { url: string; ctx: ReturnType<typeof extractSiteContext> }[] = [];
      if (home) {
        const homeCtx = extractSiteContext(home.html, home.finalUrl);
        pages.push({ url: home.finalUrl, ctx: homeCtx });
        // Follow up to 4 unique internal links
        const followed = new Set<string>([home.finalUrl]);
        const candidates = homeCtx.internal.slice(0, 6).map(l => l.href).filter(h => !followed.has(h));
        for (const href of candidates.slice(0, 4)) {
          if (followed.has(href)) continue;
          followed.add(href);
          const page = await safeFetchHtml(href);
          if (page) pages.push({ url: page.finalUrl, ctx: extractSiteContext(page.html, page.finalUrl) });
        }
      }

      const siteSummary = pages.length
        ? pages.map(p => `URL: ${p.url}
Title: ${p.ctx.title}
Description: ${p.ctx.description}
Internal links (${p.ctx.internal.length}): ${p.ctx.internal.slice(0, 12).map(l => `"${l.text}" → ${l.href}`).join(' | ')}
External: ${p.ctx.external.slice(0, 6).map(l => l.href).join(', ')}
Forms: ${p.ctx.forms.map(f => `[${f.method.toUpperCase()} ${f.action} fields=${f.fields.join(',')}]`).join(' ') || 'none'}
Buttons: ${p.ctx.buttons.slice(0, 10).join(' | ') || 'none'}`).join('\n\n---\n\n')
        : `(Site could not be crawled. Reason about ${url} from its URL alone.)`;

      // 2. Ask AI with strict tool-calling so output is always valid JSON.
      const flowResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: `You are a senior software architect. You receive a crawl summary of a real website and must produce a clean, accurate flow & logic map.

Rules:
- Use the crawl evidence (titles, links, forms, buttons) to identify real pages and real user flows.
- Group logically: entry (homepage / landing) → key pages → conversion actions → backend/APIs → external services.
- Include decision points (e.g. "Logged in?") only when justified by the crawl (login form, auth links).
- Each node label must be a short human phrase (max 4 words), not a URL or raw HTML.
- Include 8-18 nodes and meaningful edges with action labels ("Click sign up", "Submits form", "POST /api/checkout").
- Do NOT invent features that aren't supported by the crawl.`
            },
            {
              role: 'user',
              content: `Website: ${url}\n\nCRAWL EVIDENCE:\n${siteSummary}\n\nProduce the flow & logic map now.`
            }
          ],
          tools: [{
            type: 'function',
            function: {
              name: 'emit_flow',
              description: 'Return the website flow & logic map',
              parameters: {
                type: 'object',
                properties: {
                  summary: { type: 'string', description: '2-3 sentence plain description of the site architecture, evidence-based.' },
                  nodes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        label: { type: 'string' },
                        type: { type: 'string', enum: ['page', 'action', 'api', 'decision', 'external'] },
                        detail: { type: 'string', description: 'Optional 1-line note: URL, endpoint, or rationale.' }
                      },
                      required: ['id', 'label', 'type']
                    }
                  },
                  edges: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        from: { type: 'string' },
                        to: { type: 'string' },
                        label: { type: 'string' }
                      },
                      required: ['from', 'to']
                    }
                  }
                },
                required: ['summary', 'nodes', 'edges']
              }
            }
          }],
          tool_choice: { type: 'function', function: { name: 'emit_flow' } }
        }),
      });

      if (!flowResponse.ok) {
        if (flowResponse.status === 429) return new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        if (flowResponse.status === 402) return new Response(JSON.stringify({ error: 'AI credits exhausted' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        const t = await flowResponse.text();
        console.error('AI flow error', flowResponse.status, t);
        throw new Error(`AI gateway error: ${flowResponse.status}`);
      }

      const flowData = await flowResponse.json();
      const toolCall = flowData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error('AI returned no flow structure');
      let parsed: any;
      try { parsed = JSON.parse(toolCall.function.arguments); }
      catch (e) { throw new Error('AI returned malformed flow JSON'); }

      // 3. Auto-layout server-side so the canvas always looks clean.
      const nodes = (parsed.nodes || []).map((n: any) => ({
        id: String(n.id),
        label: String(n.label || '').slice(0, 60) || 'Node',
        type: ['page', 'action', 'api', 'decision', 'external'].includes(n.type) ? n.type : 'action',
        detail: n.detail ? String(n.detail).slice(0, 200) : undefined,
        x: 0, y: 0,
      }));
      const validIds = new Set(nodes.map((n: any) => n.id));
      const edges = (parsed.edges || [])
        .filter((e: any) => validIds.has(String(e.from)) && validIds.has(String(e.to)))
        .map((e: any) => ({ from: String(e.from), to: String(e.to), label: e.label ? String(e.label).slice(0, 40) : undefined }));
      autoLayout(nodes, edges);

      const flowResult = { nodes, edges, summary: String(parsed.summary || '').slice(0, 600), crawled_pages: pages.length };
      return new Response(JSON.stringify({ output: JSON.stringify(flowResult), mode: 'flow' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============ NON-FLOW MODES (unchanged) ============
    if (!url || !annotations || annotations.length === 0) {
      return new Response(JSON.stringify({ error: 'URL and annotations are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: profile } = await adminClient
      .from('profiles').select('user_type').eq('user_id', user.id).single();

    const userType = profile?.user_type || 'developer';

    const userTypePrompt = userType === 'dev_team'
      ? 'Generate detailed technical implementation steps for a development team. Include architecture considerations, testing requirements, and deployment notes.'
      : userType === 'developer'
      ? 'Generate ready-to-use code (HTML, CSS, JavaScript, React, Tailwind CSS). Provide complete, copy-paste-ready code snippets.'
      : 'Generate step-by-step visual instructions for non-technical users using website builders like Wix, Webflow, WordPress, or Shopify. Include specific menu paths and button names.';

    const modePrompt = mode === 'code' ? 'Output format: code snippets with comments.' : 'Output format: numbered step-by-step instructions.';

    const annotationDescriptions = annotations.map((a: any, i: number) => {
      let desc = `Annotation ${i + 1}: `;
      if (a.type === 'box') desc += `Draw a box/section at position (${a.x}, ${a.y}) with size ${a.width}x${a.height}px.`;
      else if (a.type === 'text') desc += `Add/change text at position (${a.x}, ${a.y}): "${a.text}"`;
      else if (a.type === 'move') desc += `Move element from (${a.fromX}, ${a.fromY}) to (${a.toX}, ${a.toY}).`;
      else if (a.type === 'select') desc += `Selected area at (${a.x}, ${a.y}) size ${a.width}x${a.height}px. Note: "${a.note || 'Change this element'}"`;
      return desc;
    }).join('\n');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: `You are an expert web developer and designer. A user has annotated changes they want to make to their website at ${url}. Based on their annotations, generate implementation guidance.\n\n${userTypePrompt}\n${modePrompt}` },
          { role: 'user', content: `Website: ${url}\n\nThe user has made the following visual annotations on their website:\n\n${annotationDescriptions}\n\nGenerate the implementation for all these changes. Be specific and actionable.` }
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) return new Response(JSON.stringify({ error: 'Rate limited, please try again later' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (aiResponse.status === 402) return new Response(JSON.stringify({ error: 'AI credits exhausted. Add funds in Settings > Workspace > Usage.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const output = aiData.choices?.[0]?.message?.content;
    return new Response(JSON.stringify({ output, mode, user_type: userType }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('generate-editor-code error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
