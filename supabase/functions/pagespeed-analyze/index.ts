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

    // Google PageSpeed Insights API (free, no key required for basic usage)
    const categories = ['performance', 'accessibility', 'best-practices', 'seo'];
    const params = new URLSearchParams({
      url: formattedUrl,
      strategy: 'mobile',
    });
    categories.forEach(c => params.append('category', c));

    console.log('Fetching PageSpeed data for:', formattedUrl);

    const psResponse = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`
    );

    if (!psResponse.ok) {
      const errText = await psResponse.text();
      console.error('PageSpeed API error:', psResponse.status, errText);
      return new Response(JSON.stringify({ 
        error: `PageSpeed API error: ${psResponse.status}`,
        details: errText 
      }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const psData = await psResponse.json();
    const lighthouse = psData.lighthouseResult;

    if (!lighthouse) {
      return new Response(JSON.stringify({ error: 'No Lighthouse data returned' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract scores (0-100)
    const scores = {
      performance: Math.round((lighthouse.categories?.performance?.score || 0) * 100),
      accessibility: Math.round((lighthouse.categories?.accessibility?.score || 0) * 100),
      bestPractices: Math.round((lighthouse.categories?.['best-practices']?.score || 0) * 100),
      seo: Math.round((lighthouse.categories?.seo?.score || 0) * 100),
    };

    // Extract key metrics
    const audits = lighthouse.audits || {};
    const metrics = {
      fcp: audits['first-contentful-paint']?.displayValue || 'N/A',
      lcp: audits['largest-contentful-paint']?.displayValue || 'N/A',
      tbt: audits['total-blocking-time']?.displayValue || 'N/A',
      cls: audits['cumulative-layout-shift']?.displayValue || 'N/A',
      si: audits['speed-index']?.displayValue || 'N/A',
      tti: audits['interactive']?.displayValue || 'N/A',
    };

    // Extract failed audits as issues
    const failedAudits: any[] = [];
    for (const [key, audit] of Object.entries(audits)) {
      const a = audit as any;
      if (a.score !== null && a.score !== undefined && a.score < 0.9 && a.title) {
        failedAudits.push({
          id: key,
          title: a.title,
          description: a.description || '',
          displayValue: a.displayValue || '',
          score: a.score,
          category: categorizeAudit(key),
        });
      }
    }

    // Sort by score (worst first)
    failedAudits.sort((a, b) => a.score - b.score);

    return new Response(JSON.stringify({
      scores,
      metrics,
      failedAudits: failedAudits.slice(0, 30),
      fetchedUrl: lighthouse.finalUrl || formattedUrl,
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

function categorizeAudit(key: string): string {
  if (key.includes('aria') || key.includes('label') || key.includes('contrast') || key.includes('alt') || key.includes('tabindex')) return 'accessibility';
  if (key.includes('security') || key.includes('https') || key.includes('csp') || key.includes('xss')) return 'security';
  if (key.includes('render') || key.includes('blocking') || key.includes('speed') || key.includes('time') || key.includes('paint') || key.includes('layout') || key.includes('cache') || key.includes('compress') || key.includes('minif')) return 'performance';
  if (key.includes('meta') || key.includes('viewport') || key.includes('robot') || key.includes('canonical') || key.includes('crawl') || key.includes('link')) return 'seo';
  return 'qa';
}
