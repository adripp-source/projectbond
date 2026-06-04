// Media footprint — deterministic, no AI. Returns honest empty/heuristic data
// based only on what the user provided. No fake reviews/sentiment.
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
    if (!authHeader) return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { company_name, social_twitter, social_linkedin, social_facebook, social_instagram } = await req.json();
    if (!company_name) return new Response(JSON.stringify({ error: 'Company name is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const handles = [
      social_twitter && { platform: 'X / Twitter', handle: `@${social_twitter}`, url: `https://x.com/${social_twitter}` },
      social_linkedin && { platform: 'LinkedIn', handle: social_linkedin, url: social_linkedin.startsWith('http') ? social_linkedin : `https://linkedin.com/company/${social_linkedin}` },
      social_facebook && { platform: 'Facebook', handle: social_facebook, url: social_facebook.startsWith('http') ? social_facebook : `https://facebook.com/${social_facebook}` },
      social_instagram && { platform: 'Instagram', handle: `@${social_instagram}`, url: `https://instagram.com/${social_instagram}` },
    ].filter(Boolean) as any[];

    const suggestions: any[] = [];
    if (!social_twitter) suggestions.push({ title: 'Claim an X / Twitter handle', description: 'No X handle provided. Customer-support questions and product news flow through X first.', category: 'marketing', priority: 'medium' });
    if (!social_linkedin) suggestions.push({ title: 'Add LinkedIn company page', description: 'B2B trust signal. Recruiters, partners and journalists check LinkedIn first.', category: 'marketing', priority: 'medium' });
    if (!social_instagram) suggestions.push({ title: 'Add Instagram presence', description: 'Best channel for product visuals and lifestyle audiences.', category: 'content', priority: 'low' });
    if (handles.length === 0) suggestions.push({ title: 'No social handles provided', description: 'Add at least one social handle in the form above to enable footprint tracking.', category: 'marketing', priority: 'high' });
    if (handles.length >= 3) suggestions.push({ title: 'Set up cross-posting', description: `You have ${handles.length} active channels. Schedule with Buffer/Hootsuite/native scheduling to stay consistent without burnout.`, category: 'content', priority: 'medium' });

    const analysis = {
      sentiment: { positive: 0, neutral: 0, negative: 0 },
      sentiment_note: 'Sentiment scoring requires real platform data. Connect each platform\'s API or upload mention exports to populate this.',
      overall_score: handles.length === 0 ? 20 : Math.min(85, 40 + handles.length * 12),
      complaints: [],
      customer_groups: [],
      key_customers: [],
      suggestions,
      improvements: handles.length === 0
        ? ['Add at least one social handle to enable analysis.']
        : [`Tracking ${handles.length} channel${handles.length === 1 ? '' : 's'}: ${handles.map(h => h.platform).join(', ')}.`],
      sentiment_over_time: [],
      handles,
      source: 'deterministic',
    };

    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: latestScan } = await adminClient
      .from('scans').select('id').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(1).single();
    if (latestScan) {
      await adminClient.from('scans').update({
        media_analysis: analysis,
        sentiment_score: analysis.overall_score,
      }).eq('id', latestScan.id);
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    console.error('analyze-media error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
