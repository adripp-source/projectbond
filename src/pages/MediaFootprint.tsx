import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Newspaper, ThumbsUp, ThumbsDown, Minus, Lightbulb, Loader2, Users } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface MediaAnalysis {
  sentiment: { positive: number; neutral: number; negative: number };
  overall_score: number;
  complaints: Array<{ topic: string; mentions: number; trend: string }>;
  customer_groups: Array<{ name: string; description: string; percentage: number }>;
  improvements: string[];
  sentiment_over_time: Array<{ period: string; positive: number; neutral: number; negative: number }>;
}

const MediaFootprint = () => {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<MediaAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [twitter, setTwitter] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [instagram, setInstagram] = useState("");

  useEffect(() => {
    if (!user) return;
    // Load existing analysis and branding
    Promise.all([
      supabase.from("scans").select("media_analysis").eq("user_id", user.id)
        .not("media_analysis", "is", null)
        .order("created_at", { ascending: false }).limit(1).single(),
      supabase.from("branding").select("*").eq("user_id", user.id).maybeSingle(),
    ]).then(([scanRes, brandingRes]) => {
      if (scanRes.data?.media_analysis) {
        setAnalysis(scanRes.data.media_analysis as unknown as MediaAnalysis);
      }
      if (brandingRes.data) {
        setCompanyName(brandingRes.data.company_name || "");
        setTwitter(brandingRes.data.social_twitter || "");
        setLinkedin(brandingRes.data.social_linkedin || "");
        setInstagram(brandingRes.data.social_instagram || "");
      }
      setLoading(false);
    });
  }, [user]);

  const runAnalysis = async () => {
    if (!companyName.trim()) {
      toast.error("Enter a company name first");
      return;
    }
    setAnalyzing(true);
    try {
      // Save socials to branding
      if (user) {
        await supabase.from("branding").upsert({
          user_id: user.id,
          company_name: companyName.trim(),
          social_twitter: twitter.trim() || null,
          social_linkedin: linkedin.trim() || null,
          social_instagram: instagram.trim() || null,
        }, { onConflict: "user_id" });
      }

      const result = await api.analyzeMedia(companyName.trim(), {
        twitter: twitter.trim() || undefined,
        linkedin: linkedin.trim() || undefined,
        instagram: instagram.trim() || undefined,
      });
      setAnalysis(result);
      toast.success("Media analysis complete!");
    } catch (e: any) {
      toast.error(e.message || "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Newspaper className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Media Footprint</h1>
            <p className="text-sm text-muted-foreground">Brand perception and customer sentiment</p>
          </div>
        </div>
      </motion.div>

      {/* Input Section */}
      <div className="bg-card border border-border rounded-lg p-5 mb-6 shadow-card">
        <h3 className="text-sm font-semibold text-foreground mb-3">Company & Social Handles</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Input
            placeholder="Company name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="bg-secondary border-border text-foreground"
          />
          <Input
            placeholder="@twitter handle"
            value={twitter}
            onChange={(e) => setTwitter(e.target.value)}
            className="bg-secondary border-border text-foreground"
          />
          <Input
            placeholder="LinkedIn company page"
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            className="bg-secondary border-border text-foreground"
          />
          <Input
            placeholder="@instagram handle"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            className="bg-secondary border-border text-foreground"
          />
        </div>
        <Button
          onClick={runAnalysis}
          disabled={analyzing || !companyName.trim()}
          className="bg-gradient-primary text-primary-foreground hover:opacity-90"
        >
          {analyzing ? (
            <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</span>
          ) : (
            "Run Media Analysis"
          )}
        </Button>
      </div>

      {analysis && (
        <>
          {/* Sentiment Summary */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "Positive", value: `${analysis.sentiment.positive}%`, icon: ThumbsUp, color: "text-success" },
              { label: "Neutral", value: `${analysis.sentiment.neutral}%`, icon: Minus, color: "text-muted-foreground" },
              { label: "Negative", value: `${analysis.sentiment.negative}%`, icon: ThumbsDown, color: "text-destructive" },
            ].map((item) => (
              <motion.div key={item.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-lg p-5 shadow-card">
                <div className="flex items-center gap-2 mb-2">
                  <item.icon className={`w-4 h-4 ${item.color}`} />
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                </div>
                <span className={`text-2xl font-bold ${item.color}`}>{item.value}</span>
              </motion.div>
            ))}
          </div>

          {/* Chart */}
          {analysis.sentiment_over_time?.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-lg p-5 mb-8 shadow-card">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">Sentiment Over Time</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={analysis.sentiment_over_time}>
                  <defs>
                    <linearGradient id="posGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="negGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="period" tick={{ fill: "hsl(215, 14%, 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(215, 14%, 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(220, 13%, 9%)", border: "1px solid hsl(220, 13%, 16%)", borderRadius: "6px", fontSize: "12px" }} />
                  <Area type="monotone" dataKey="positive" stroke="hsl(142, 71%, 45%)" fill="url(#posGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="negative" stroke="hsl(0, 72%, 51%)" fill="url(#negGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* Complaints */}
            <div className="bg-card border border-border rounded-lg p-5 shadow-card">
              <h3 className="text-sm font-semibold text-foreground mb-4">Top Complaints</h3>
              <div className="space-y-3">
                {analysis.complaints?.map((c, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-secondary-foreground">{c.topic}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{c.mentions} mentions</span>
                      <span className={`text-xs ${c.trend === "rising" ? "text-destructive" : c.trend === "declining" ? "text-success" : "text-muted-foreground"}`}>
                        {c.trend === "rising" ? "↑" : c.trend === "declining" ? "↓" : "→"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Improvements */}
            <div className="bg-card border border-border rounded-lg p-5 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-4 h-4 text-warning" />
                <h3 className="text-sm font-semibold text-foreground">How to Improve</h3>
              </div>
              <ul className="space-y-3 text-sm text-secondary-foreground">
                {analysis.improvements?.map((imp, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">→</span>
                    {imp}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Customer Groups */}
          {analysis.customer_groups?.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-5 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Customer Groups</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {analysis.customer_groups.map((group, i) => (
                  <div key={i} className="bg-secondary rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">{group.name}</span>
                      <span className="text-xs text-primary font-mono">{group.percentage}%</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{group.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MediaFootprint;
