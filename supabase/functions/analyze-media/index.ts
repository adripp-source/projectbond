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

    const { company_name, social_twitter, social_linkedin, social_facebook, social_instagram } = await req.json();
    if (!company_name) {
      return new Response(JSON.stringify({ error: 'Company name is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

    const socials = [
      social_twitter && `Twitter/X: @${social_twitter}`,
      social_linkedin && `LinkedIn: ${social_linkedin}`,
      social_facebook && `Facebook: ${social_facebook}`,
      social_instagram && `Instagram: @${social_instagram}`,
    ].filter(Boolean).join(', ');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: 'You are an expert brand and media analyst. Analyze companies based on their name and social presence, providing realistic and insightful sentiment analysis, complaint patterns, customer groups, and actionable improvement suggestions.'
          },
          {
            role: 'user',
            content: `Analyze the media footprint and brand perception for: ${company_name}${socials ? `\nSocial handles: ${socials}` : ''}

Based on what you can infer about this company and industry, provide a realistic media sentiment analysis including common customer complaints, audience segments, and specific actionable improvements.`
          }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'media_analysis',
            description: 'Return structured media footprint analysis',
            parameters: {
              type: 'object',
              properties: {
                sentiment: {
                  type: 'object',
                  properties: {
                    positive: { type: 'integer', description: 'Positive sentiment percentage 0-100' },
                    neutral: { type: 'integer', description: 'Neutral sentiment percentage 0-100' },
                    negative: { type: 'integer', description: 'Negative sentiment percentage 0-100' }
                  },
                  required: ['positive', 'neutral', 'negative']
                },
                overall_score: { type: 'integer', description: 'Overall sentiment score 0-100' },
                complaints: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      topic: { type: 'string' },
                      mentions: { type: 'integer' },
                      trend: { type: 'string', enum: ['rising', 'stable', 'declining'] }
                    },
                    required: ['topic', 'mentions', 'trend']
                  }
                },
                customer_groups: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      description: { type: 'string' },
                      percentage: { type: 'integer' }
                    },
                    required: ['name', 'description', 'percentage']
                  }
                },
                key_customers: {
                  type: 'array',
                  description: 'Notable individual customers, influencers, or brand advocates with public profiles',
                  items: {
                    type: 'object',
                    properties: {
                      full_name: { type: 'string' },
                      title: { type: 'string', description: 'Job title or role' },
                      company: { type: 'string' },
                      linkedin_url: { type: 'string', description: 'LinkedIn profile URL if available' },
                      twitter_handle: { type: 'string' },
                      avatar_url: { type: 'string', description: 'Public profile picture URL if known' },
                      relevance: { type: 'string', description: 'Why this person is relevant to the brand' }
                    },
                    required: ['full_name', 'title', 'relevance']
                  }
                },
                improvements: {
                  type: 'array',
                  items: { type: 'string' }
                },
                sentiment_over_time: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      period: { type: 'string' },
                      positive: { type: 'integer' },
                      neutral: { type: 'integer' },
                      negative: { type: 'integer' }
                    },
                    required: ['period', 'positive', 'neutral', 'negative']
                  }
                }
              },
              required: ['sentiment', 'overall_score', 'complaints', 'customer_groups', 'improvements', 'sentiment_over_time']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'media_analysis' } }
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited, try again later' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('No analysis returned');

    const analysis = JSON.parse(toolCall.function.arguments);

    // Store in latest scan's media_analysis
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Update latest scan with media analysis
    const { data: latestScan } = await adminClient
      .from('scans')
      .select('id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

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
