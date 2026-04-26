import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    const { url, mode = 'docs', login_url, login_notes, audience_role, depth, technicality, github_repo_url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let formatted = url.trim();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = `https://${formatted}`;
    }

    // Light fetch (timeboxed) — enough HTML to give Gemini real context
    let html = '';
    let pageTitle = '';
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(formatted, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 ProjectBondBot/1.0' } });
      clearTimeout(t);
      if (res.ok) {
        const text = await res.text();
        html = text.slice(0, 25000);
        const m = text.match(/<title[^>]*>([^<]+)<\/title>/i);
        pageTitle = m?.[1]?.trim() || '';
      }
    } catch (e) {
      console.warn('Fetch failed (will rely on URL only):', e);
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const tools = [
      mode === 'features' ? {
        type: "function",
        function: {
          name: "extract_features",
          description: "Return a structured list of detected features and missing/recommended features.",
          parameters: {
            type: "object",
            properties: {
              detected: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    category: { type: "string", enum: ["auth", "commerce", "content", "marketing", "social", "analytics", "support", "navigation", "ui", "other"] },
                    confidence: { type: "string", enum: ["high", "medium", "low"] },
                  },
                  required: ["name", "description", "category", "confidence"],
                  additionalProperties: false,
                },
              },
              recommended: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    why: { type: "string" },
                    impact: { type: "string", enum: ["high", "medium", "low"] },
                  },
                  required: ["name", "why", "impact"],
                  additionalProperties: false,
                },
              },
              summary: { type: "string" },
            },
            required: ["detected", "recommended", "summary"],
            additionalProperties: false,
          },
        },
      } : {
        type: "function",
        function: {
          name: "generate_docs",
          description: "Return a developer onboarding document broken into readable sections.",
          parameters: {
            type: "object",
            properties: {
              project_overview: { type: "string", description: "1-2 paragraph plain-English overview." },
              tech_stack_guess: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    why_we_think_so: { type: "string" },
                  },
                  required: ["name", "why_we_think_so"],
                  additionalProperties: false,
                },
              },
              architecture: { type: "string", description: "How the system likely fits together (frontend, backend, services)." },
              architecture_diagram: {
                type: "array",
                description: "Component nodes for an architecture overview diagram.",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    role: { type: "string", description: "What this component does (1 sentence)." },
                    layer: { type: "string", enum: ["frontend", "backend", "data", "integration", "infra"] },
                    connects_to: { type: "array", items: { type: "string" } },
                  },
                  required: ["name", "role", "layer", "connects_to"],
                  additionalProperties: false,
                },
              },
              database_schema_guess: {
                type: "array",
                description: "Likely tables/collections with key fields (best-guess from visible signals).",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    purpose: { type: "string" },
                    key_fields: { type: "array", items: { type: "string" } },
                  },
                  required: ["name", "purpose", "key_fields"],
                  additionalProperties: false,
                },
              },
              user_workflows: {
                type: "array",
                description: "Common end-to-end user journeys on this site.",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    steps: { type: "array", items: { type: "string" } },
                  },
                  required: ["name", "steps"],
                  additionalProperties: false,
                },
              },
              integrations: {
                type: "array",
                description: "Detected third-party integrations (analytics, payments, auth, CRM, etc.).",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    purpose: { type: "string" },
                  },
                  required: ["name", "purpose"],
                  additionalProperties: false,
                },
              },
              key_pages: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    path: { type: "string" },
                    purpose: { type: "string" },
                  },
                  required: ["path", "purpose"],
                  additionalProperties: false,
                },
              },
              local_setup: {
                type: "array",
                description: "Steps a new dev should follow to start contributing.",
                items: { type: "string" },
              },
              env_vars_likely: {
                type: "array",
                items: { type: "string" },
              },
              gotchas: {
                type: "array",
                description: "Things a new dev typically trips over on this site.",
                items: { type: "string" },
              },
              first_week_checklist: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["project_overview", "tech_stack_guess", "architecture", "architecture_diagram", "database_schema_guess", "user_workflows", "integrations", "key_pages", "local_setup", "env_vars_likely", "gotchas", "first_week_checklist"],
            additionalProperties: false,
          },
        },
      },
    ];

    const depthHint = depth === 'quick'
      ? 'Keep it brief — a snapshot a non-technical teammate could read in 2 minutes.'
      : depth === 'deep'
        ? 'Go thorough — a full handoff with setup, pitfalls, and a real first-week checklist.'
        : depth === 'custom'
          ? 'Follow the user notes below precisely.'
          : 'Balanced depth — practical and complete without being exhausting.';

    const audienceHint = audience_role
      ? `Tailor the language, examples, and depth for this audience: "${audience_role}". Avoid jargon they wouldn't know. If they're non-technical, skip code-level setup and focus on what each part of the site does and why.`
      : 'Write for a general new-hire audience — friendly, plain English, useful across roles.';

    const techHint = (() => {
      const t = Number(technicality) || 3;
      if (t <= 1) return 'TECHNICALITY = 1/5 (Plain English): Zero jargon. No code. Use everyday analogies. Skip env vars and architecture diagrams unless explained in plain words.';
      if (t === 2) return 'TECHNICALITY = 2/5 (Friendly): Light tech words, always explained the first time. Avoid code blocks unless trivial.';
      if (t === 3) return 'TECHNICALITY = 3/5 (Balanced): Mix plain English and accurate technical terms. Short code snippets where they help.';
      if (t === 4) return 'TECHNICALITY = 4/5 (Technical): Use real terms, code snippets, configs, and dependency names. Assume the reader can read code.';
      return 'TECHNICALITY = 5/5 (Deeply technical): Architecture, edge cases, scaling notes, internals. Assume a senior engineer.';
    })();

    const systemPrompt = mode === 'features'
      ? `You are an expert product analyst. Given a website's HTML and URL, extract concrete features that exist on the site (auth, search, cart, blog, contact form, etc.) and a short list of high-impact recommended features it's missing. Be specific to what you see. ${audienceHint} ${techHint}`
      : `You are a senior team lead writing an onboarding guide for a new hire joining the team that owns this website. ${audienceHint} ${depthHint} ${techHint} Be concrete, friendly, and practical. Avoid generic boilerplate. Use the HTML signals (frameworks, scripts, meta tags, page structure) to make specific guesses. If you're not sure, say "likely" — never invent versions or files that don't exist. For architecture_diagram, give 4–8 nodes spanning frontend/backend/data/integration layers with the connects_to graph filled in. For database_schema_guess, infer 3–8 likely tables from visible features (users, sessions, orders, posts, etc.). For user_workflows, list the 3–5 most important journeys end-to-end.`;

    const userPrompt = `Website URL: ${formatted}
Page title: ${pageTitle || '(unknown)'}
Audience / role: ${audience_role || '(general new hire)'}
Depth: ${depth || 'standard'}
${technicality ? `Technicality level: ${technicality}/5` : ''}
${github_repo_url ? `Public GitHub repo (use as additional signal): ${github_repo_url}` : ''}
${login_url ? `Login URL provided: ${login_url}` : ''}
${login_notes ? `Extra instructions from the user: ${login_notes}` : ''}

HTML sample (first 25KB):
${html || '(could not fetch — work from URL alone)'}

${mode === 'features' ? 'Extract detected features and recommend high-impact missing ones.' : 'Generate the onboarding doc with all sections filled in.'}`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools,
        tool_choice: { type: "function", function: { name: mode === 'features' ? 'extract_features' : 'generate_docs' } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) return new Response(JSON.stringify({ error: 'Rate limited, please try again later' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      if (aiResponse.status === 402) return new Response(JSON.stringify({ error: 'AI credits exhausted. Add funds in Settings > Workspace > Usage.' }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: any = {};
    try { parsed = toolCall ? JSON.parse(toolCall.function.arguments) : {}; } catch (e) { console.error('Tool arg parse failed', e); }

    return new Response(JSON.stringify({ mode, url: formatted, data: parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('generate-tech-docs error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
