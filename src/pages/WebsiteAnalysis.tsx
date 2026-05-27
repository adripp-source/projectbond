import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Globe, Shield, Play, RefreshCw, Plus, Loader2, Trash2, Gauge, Eye, Accessibility, Search, Zap, AlertTriangle, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ActionItem from "@/components/ui/action-item";
import ScoreCard from "@/components/ui/score-card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import WebsiteAuthFlowDialog from "@/components/WebsiteAuthFlowDialog";
import SuggestedWebsites from "@/components/SuggestedWebsites";
import SmartUrlError from "@/components/SmartUrlError";
import EmptyState from "@/components/EmptyState";
import { useConfirm } from "@/components/ConfirmDialog";
import { isProbablyValidUrl, normalizeUrl } from "@/lib/urlSuggest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface WebsiteRow { id: string; url: string; name: string | null; }
interface IssueData {
  id: string; title: string; description: string; category: string;
  priority: string; impact: string | null; location: string | null;
  fix_dev: string | null; fix_code: string | null; fix_nocode: string | null;
  fix_content: string | null; fix_visual: string | null;
}

interface PageSpeedScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}

interface PageSpeedMetrics {
  fcp: string;
  lcp: string;
  tbt: string;
  cls: string;
  si: string;
  tti: string;
}

const WebsiteAnalysis = () => {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [websites, setWebsites] = useState<WebsiteRow[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [qaIssues, setQaIssues] = useState<IssueData[]>([]);
  const [securityIssues, setSecurityIssues] = useState<IssueData[]>([]);
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [securityScore, setSecurityScore] = useState<number | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [psScores, setPsScores] = useState<PageSpeedScores | null>(null);
  const [psMetrics, setPsMetrics] = useState<PageSpeedMetrics | null>(null);
  const [loadingPageSpeed, setLoadingPageSpeed] = useState(false);
  const [authFlowOpen, setAuthFlowOpen] = useState(false);
  const [pendingWebsite, setPendingWebsite] = useState<WebsiteRow | null>(null);
  const [scanHistory, setScanHistory] = useState<Array<{ created_at: string; health_score: number | null; security_score: number | null }>>([]);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "performance" | "issues">("overview");

  const loadData = async () => {
    if (!user) return;
    const [websiteRes, scanRes, historyRes] = await Promise.all([
      supabase.from("websites").select("id, url, name").eq("user_id", user.id),
      supabase.from("scans").select("id, health_score, security_score").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).single(),
      supabase.from("scans").select("created_at, health_score, security_score").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
    ]);
    if (websiteRes.data) setWebsites(websiteRes.data);
    if (historyRes.data) setScanHistory(historyRes.data);
    if (scanRes.data) {
      setHealthScore(scanRes.data.health_score);
      setSecurityScore(scanRes.data.security_score);
      const { data: issues } = await supabase.from("scan_issues").select("*").eq("scan_id", scanRes.data.id);
      if (issues) {
        setQaIssues(issues.filter(i => ["qa", "performance", "accessibility", "content"].includes(i.category)));
        setSecurityIssues(issues.filter(i => i.category === "security"));
      }
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { count } = await supabase.from("scans").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", today.toISOString());
    setScanCount(count || 0);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const addWebsite = async () => {
    if (adding) return; // prevent double-submit
    if (!newUrl.trim() || !user) {
      setUrlError("__empty__");
      return;
    }
    const trimmed = newUrl.trim();
    if (!isProbablyValidUrl(trimmed)) {
      setUrlError(trimmed);
      return;
    }
    setAdding(true);
    try {
      const url = normalizeUrl(trimmed);
      const { data, error } = await supabase.from("websites").insert({ user_id: user.id, url, section: "analysis" }).select("id, url, name").single();
      if (error) throw error;
      if (data) {
        setWebsites(prev => [...prev, data]);
        setPendingWebsite(data);
        setAuthFlowOpen(true);
      }
      setNewUrl("");
      setUrlError(null);
    } catch (e: any) { toast.error(e.message); } finally { setAdding(false); }
  };

  const removeWebsite = async (id: string, url: string) => {
    if (removingId) return;
    const ok = await confirm({
      title: "Remove this website?",
      description: `${url} will be removed from monitoring. Past scan history is kept.`,
      confirmText: "Remove",
      destructive: true,
    });
    if (!ok) return;
    setRemovingId(id);
    try {
      await supabase.from("websites").delete().eq("id", id);
      setWebsites(prev => prev.filter(w => w.id !== id));
      toast.success("Website removed");
    } catch (e: any) {
      toast.error(e.message || "Failed to remove");
    } finally {
      setRemovingId(null);
    }
  };

  const runScan = async () => {
    const urlToScan = websites[0]?.url || newUrl.trim();
    if (!urlToScan) { toast.error("Add a website first"); return; }
    if (scanCount >= 15) { toast.error("Daily scan limit reached (15/15)"); return; }
    setScanning(true);
    try {
      // Run analysis and PageSpeed in parallel
      const [aiResult] = await Promise.all([
        api.analyzeWebsite(urlToScan),
        fetchPageSpeed(urlToScan),
      ]);
      
      // Create alerts for critical issues
      if (aiResult?.issues) {
        const criticals = aiResult.issues.filter((i: any) => i.priority === "critical");
        if (criticals.length > 0) {
          const alertRows = criticals.slice(0, 3).map((issue: any) => ({
            user_id: user!.id,
            title: `Critical: ${issue.title}`,
            message: issue.description,
            severity: "critical",
            category: issue.category === "security" ? "security" : "issue",
            scan_id: aiResult.scan_id,
          }));
          await supabase.from("alerts" as any).insert(alertRows as any);
        }
      }
      
      toast.success("Scan complete!");
      await loadData();
    } catch (e: any) { toast.error(e.message || "Scan failed"); } finally { setScanning(false); }
  };

  const fetchPageSpeed = async (url: string) => {
    setLoadingPageSpeed(true);
    try {
      const data = await api.getPageSpeed(url);
      if (data?.scores) setPsScores(data.scores);
      if (data?.metrics) setPsMetrics(data.metrics);
    } catch (e: any) {
      console.error("PageSpeed error:", e);
    } finally {
      setLoadingPageSpeed(false);
    }
  };

  const getFixTypes = (issue: IssueData) => {
    const types: Array<"dev" | "code" | "no-code" | "content" | "visual"> = [];
    if (issue.fix_dev) types.push("dev");
    if (issue.fix_code) types.push("code");
    if (issue.fix_nocode) types.push("no-code");
    if (issue.fix_content) types.push("content");
    if (issue.fix_visual) types.push("visual");
    if (types.length === 0) types.push(issue.category === "security" ? "dev" : "code");
    return types;
  };

  if (loading) {
    return <div className="p-8 flex items-center justify-center min-h-[50vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto w-full relative">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between border-b border-border pb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-secondary border border-border flex items-center justify-center">
              <Globe className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground tracking-tight">Production reliability</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Behavioral QA · PageSpeed · Security checks</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{scanCount}/15 scans today</span>
            <Button size="sm" variant="outline" className="border-border text-foreground hover:bg-secondary" onClick={runScan} disabled={scanning}>
              {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}Start behavioral scan
            </Button>
          </div>
        </div>
      </motion.div>

      <SuggestedWebsites section="analysis" onAdopted={(w) => setWebsites(prev => [...prev, { id: w.id, url: w.url, name: w.name }])} />

      {/* Add website */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6 shadow-card">
        <h3 className="text-sm font-semibold text-foreground mb-3">Monitored Websites</h3>
        <div className="flex gap-2 mb-3">
          <Input placeholder="https://yourwebsite.com" value={newUrl} onChange={(e) => { setNewUrl(e.target.value); setUrlError(null); }} className="bg-secondary border-border text-foreground"
            onKeyDown={e => e.key === "Enter" && addWebsite()} />
          <Button onClick={addWebsite} disabled={adding || !newUrl.trim()} size="sm" className="bg-gradient-primary text-primary-foreground">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>
        {urlError === "__empty__" && (
          <p className="text-xs text-destructive mb-3" role="alert">Please enter a website URL before adding.</p>
        )}
        {urlError && urlError !== "__empty__" && (
          <div className="mb-3">
            <SmartUrlError attemptedUrl={urlError} onPick={(u) => { setNewUrl(u); setUrlError(null); }} />
          </div>
        )}
        {websites.length > 0 && (
          <div className="space-y-1">
            {websites.map(w => (
              <div key={w.id} className="flex items-center justify-between px-3 py-1.5 bg-secondary rounded text-sm">
                <span className="text-foreground font-mono text-xs">{w.url}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setPendingWebsite(w); setAuthFlowOpen(true); }}
                    aria-label={`Configure ${w.url}`}
                    className="text-muted-foreground hover:text-primary text-xs">Configure</button>
                  <button
                    onClick={() => removeWebsite(w.id, w.url)}
                    disabled={removingId === w.id}
                    aria-label={`Remove ${w.url}`}
                    className="text-muted-foreground hover:text-destructive disabled:opacity-50"
                  >
                    {removingId === w.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Google PageSpeed Scores */}
      {(psScores || loadingPageSpeed) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-primary" />
            Google PageSpeed Insights
            {loadingPageSpeed && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
          </h2>
          {psScores && (
            <>
              <div className="grid grid-cols-4 gap-3 mb-3">
                {[
                  { label: "Performance", score: psScores.performance, icon: Zap },
                  { label: "Accessibility", score: psScores.accessibility, icon: Accessibility },
                  { label: "Best Practices", score: psScores.bestPractices, icon: Shield },
                  { label: "SEO", score: psScores.seo, icon: Search },
                ].map(item => {
                  const color = item.score >= 90 ? "text-success" : item.score >= 50 ? "text-warning" : "text-destructive";
                  return (
                    <div key={item.label} className="bg-card border border-border rounded-lg p-4 shadow-card text-center">
                      <item.icon className="w-4 h-4 text-muted-foreground mx-auto mb-2" />
                      <div className={`text-2xl font-bold ${color}`}>{item.score}</div>
                      <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
                    </div>
                  );
                })}
              </div>
              {psMetrics && (
                <div className="grid grid-cols-6 gap-2">
                  {[
                    { label: "FCP", val: psMetrics.fcp },
                    { label: "LCP", val: psMetrics.lcp },
                    { label: "TBT", val: psMetrics.tbt },
                    { label: "CLS", val: psMetrics.cls },
                    { label: "Speed Index", val: psMetrics.si },
                    { label: "TTI", val: psMetrics.tti },
                  ].map(m => (
                    <div key={m.label} className="bg-secondary/50 rounded-md p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">{m.label}</p>
                      <p className="text-xs font-mono font-medium text-foreground">{m.val}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </motion.div>
      )}

      {/* QA & Security Scores */}
      {(healthScore !== null || securityScore !== null) && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <ScoreCard label="QA Score" score={healthScore ?? 0} icon={Play} />
          <ScoreCard label="Security Score" score={securityScore ?? 0} icon={Shield} />
        </div>
      )}

      {/* Scan History Trend */}
      {scanHistory.length > 1 && (
        <div className="bg-card border border-border rounded-lg p-4 mb-6 shadow-card">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Scan History
          </h3>
          <div className="flex items-end gap-1 h-16">
            {scanHistory.slice().reverse().map((s, i) => {
              const score = s.health_score ?? 0;
              const h = Math.max(4, (score / 100) * 60);
              const color = score >= 75 ? "bg-success" : score >= 50 ? "bg-warning" : "bg-destructive";
              return (
                <div key={i} className="flex flex-col items-center gap-1 flex-1">
                  <div className={`w-full rounded-t ${color}`} style={{ height: `${h}px` }} title={`${score}/100 — ${new Date(s.created_at).toLocaleDateString()}`} />
                  <span className="text-[8px] text-muted-foreground">{score}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Safe Testing Mode */}
      {websites.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 mb-6">
          <Eye className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-foreground">Safe Testing Mode Active</p>
            <p className="text-[10px] text-muted-foreground">Bond will not make purchases, submit forms, or modify data unless explicitly allowed.</p>
          </div>
        </div>
      )}

      {/* QA Issues */}
      {qaIssues.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Play className="w-4 h-4 text-primary" />QA Issues<span className="text-xs text-muted-foreground font-normal">({qaIssues.length})</span>
          </h2>
          <div className="space-y-2">
            {qaIssues.map((issue, i) => (
              <ActionItem key={issue.id} title={issue.title} description={issue.description} priority={issue.priority as any}
                impact={issue.impact || ""} location={issue.location || ""} fixTypes={getFixTypes(issue)} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* Security */}
      {securityIssues.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-destructive" />Security Findings<span className="text-xs text-muted-foreground font-normal">({securityIssues.length})</span>
          </h2>
          <div className="space-y-2">
            {securityIssues.map((issue, i) => (
              <ActionItem key={issue.id} title={issue.title} description={issue.description} priority={issue.priority as any}
                impact={issue.impact || ""} location={issue.location || ""} fixTypes={getFixTypes(issue)} index={i} />
            ))}
          </div>
        </div>
      )}

      {qaIssues.length === 0 && securityIssues.length === 0 && !psScores && (
        <EmptyState
          icon={Globe}
          title={websites.length === 0 ? "Add your first website" : "Run your first scan"}
          description={
            websites.length === 0
              ? "Drop in a URL above to start tracking QA, PageSpeed, and security in one place."
              : "Click 'Run Scan' to generate QA findings, performance metrics, and security checks."
          }
          action={websites.length > 0 ? { label: scanning ? "Scanning…" : "Run Scan", onClick: runScan } : undefined}
        />
      )}

      {/* Auth Flow Dialog */}
      {pendingWebsite && (
        <WebsiteAuthFlowDialog
          open={authFlowOpen}
          onOpenChange={setAuthFlowOpen}
          websiteId={pendingWebsite.id}
          websiteUrl={pendingWebsite.url}
          onComplete={() => {
            setPendingWebsite(null);
            toast.success("Website configured! Run a scan to start analysis.");
          }}
        />
      )}

      
    </div>
  );
};

export default WebsiteAnalysis;
