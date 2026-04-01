import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Newspaper, ThumbsUp, ThumbsDown, Minus, Lightbulb, Loader2, Users, Plus, Trash2, Globe, User, ExternalLink, Sparkles, ArrowRight } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface KeyCustomer {
  full_name: string;
  title: string;
  company?: string;
  linkedin_url?: string;
  twitter_handle?: string;
  avatar_url?: string;
  relevance: string;
}

interface Suggestion {
  title: string;
  description: string;
  category: string;
  priority: string;
  linked_complaint?: string;
}

interface MediaAnalysis {
  sentiment: { positive: number; neutral: number; negative: number };
  overall_score: number;
  complaints: Array<{ topic: string; mentions: number; trend: string; platform?: string }>;
  customer_groups: Array<{ name: string; description: string; percentage: number }>;
  key_customers?: KeyCustomer[];
  suggestions?: Suggestion[];
  improvements: string[];
  sentiment_over_time: Array<{ period: string; positive: number; neutral: number; negative: number }>;
}

interface WebsiteRow { id: string; url: string; name: string | null; }

const AVATAR_COLORS = [
  "hsl(217, 91%, 60%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 50%)",
  "hsl(280, 70%, 55%)", "hsl(0, 72%, 51%)", "hsl(190, 80%, 45%)",
];

const getInitials = (name: string) => name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

const MediaFootprint = () => {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<MediaAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [twitter, setTwitter] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [instagram, setInstagram] = useState("");
  const [facebook, setFacebook] = useState("");
  const [youtube, setYoutube] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [reddit, setReddit] = useState("");
  const [websites, setWebsites] = useState<WebsiteRow[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("scans").select("media_analysis").eq("user_id", user.id)
        .not("media_analysis", "is", null).order("created_at", { ascending: false }).limit(1).single(),
      supabase.from("branding").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("websites").select("id, url, name").eq("user_id", user.id).eq("section", "media"),
    ]).then(([scanRes, brandingRes, websiteRes]) => {
      if (scanRes.data?.media_analysis) setAnalysis(scanRes.data.media_analysis as unknown as MediaAnalysis);
      if (brandingRes.data) {
        setCompanyName(brandingRes.data.company_name || "");
        setTwitter(brandingRes.data.social_twitter || "");
        setLinkedin(brandingRes.data.social_linkedin || "");
        setInstagram(brandingRes.data.social_instagram || "");
        setFacebook(brandingRes.data.social_facebook || "");
      }
      if (websiteRes.data) setWebsites(websiteRes.data);
      setLoading(false);
    });
  }, [user]);

  const addWebsite = async () => {
    if (!newUrl.trim() || !user) return;
    setAdding(true);
    try {
      const { data, error } = await supabase.from("websites").insert({ user_id: user.id, url: newUrl.trim(), section: "media" }).select("id, url, name").single();
      if (error) throw error;
      if (data) setWebsites(prev => [...prev, data]);
      setNewUrl(""); toast.success("URL added");
    } catch (e: any) { toast.error(e.message); } finally { setAdding(false); }
  };

  const removeWebsite = async (id: string) => {
    await supabase.from("websites").delete().eq("id", id);
    setWebsites(prev => prev.filter(w => w.id !== id));
  };

  const runAnalysis = async () => {
    if (!companyName.trim()) { toast.error("Enter a company name first"); return; }
    setAnalyzing(true);
    try {
      if (user) {
        await supabase.from("branding").upsert({
          user_id: user.id, company_name: companyName.trim(),
          social_twitter: twitter.trim() || null, social_linkedin: linkedin.trim() || null,
          social_instagram: instagram.trim() || null, social_facebook: facebook.trim() || null,
        }, { onConflict: "user_id" });
      }
      const result = await api.analyzeMedia(companyName.trim(), {
        twitter: twitter.trim() || undefined, linkedin: linkedin.trim() || undefined,
        instagram: instagram.trim() || undefined, facebook: facebook.trim() || undefined,
      });
      setAnalysis(result);
      toast.success("Media analysis complete!");
    } catch (e: any) { toast.error(e.message || "Analysis failed"); } finally { setAnalyzing(false); }
  };

  if (loading) {
    return <div className="p-8 flex items-center justify-center min-h-[50vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
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

      {/* Tracked URLs */}
      <div className="bg-card border border-border rounded-lg p-5 mb-6 shadow-card">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Tracked URLs</h3>
        </div>
        <div className="flex gap-2 mb-3">
          <Input placeholder="https://yourwebsite.com" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className="bg-secondary border-border text-foreground text-sm" />
          <Button onClick={addWebsite} disabled={adding || !newUrl.trim()} size="sm" className="bg-gradient-primary text-primary-foreground">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>
        {websites.length > 0 && (
          <div className="space-y-1">
            {websites.map(w => (
              <div key={w.id} className="flex items-center justify-between px-3 py-1.5 bg-secondary rounded text-sm">
                <span className="text-foreground font-mono text-xs">{w.url}</span>
                <button onClick={() => removeWebsite(w.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-card border border-border rounded-lg p-5 mb-6 shadow-card">
        <h3 className="text-sm font-semibold text-foreground mb-3">Company & Social Handles</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <Input placeholder="Company name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="bg-secondary border-border text-foreground" />
          <Input placeholder="@twitter / X handle" value={twitter} onChange={(e) => setTwitter(e.target.value)} className="bg-secondary border-border text-foreground" />
          <Input placeholder="LinkedIn company page" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} className="bg-secondary border-border text-foreground" />
          <Input placeholder="@instagram handle" value={instagram} onChange={(e) => setInstagram(e.target.value)} className="bg-secondary border-border text-foreground" />
          <Input placeholder="Facebook page" value={facebook} onChange={(e) => setFacebook(e.target.value)} className="bg-secondary border-border text-foreground" />
          <Input placeholder="YouTube channel" value={youtube} onChange={(e) => setYoutube(e.target.value)} className="bg-secondary border-border text-foreground" />
          <Input placeholder="TikTok handle" value={tiktok} onChange={(e) => setTiktok(e.target.value)} className="bg-secondary border-border text-foreground" />
          <Input placeholder="Reddit subreddit / profile" value={reddit} onChange={(e) => setReddit(e.target.value)} className="bg-secondary border-border text-foreground" />
        </div>
        <Button onClick={runAnalysis} disabled={analyzing || !companyName.trim()} className="bg-gradient-primary text-primary-foreground hover:opacity-90">
          {analyzing ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</span> : "Run Media Analysis"}
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
                    <span className="text-primary mt-0.5">→</span>{imp}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Key Customers / Notable People */}
          {analysis.key_customers && analysis.key_customers.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-5 mb-8 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Key Customers & Advocates</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {analysis.key_customers.map((customer, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-3 bg-secondary rounded-lg p-3">
                    {/* Avatar */}
                    {customer.avatar_url ? (
                      <img src={customer.avatar_url} alt={customer.full_name}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2 border-border"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
                    ) : null}
                    <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${customer.avatar_url ? 'hidden' : ''}`}
                      style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                      {getInitials(customer.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{customer.full_name}</span>
                        {customer.linkedin_url && (
                          <a href={customer.linkedin_url} target="_blank" rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80 flex-shrink-0">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {customer.title}{customer.company ? ` · ${customer.company}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{customer.relevance}</p>
                      {customer.twitter_handle && (
                        <span className="text-[10px] text-primary font-mono">@{customer.twitter_handle}</span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

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
