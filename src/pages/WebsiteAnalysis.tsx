import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Globe, Shield, Play, RefreshCw, Plus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ActionItem from "@/components/ui/action-item";
import ScoreCard from "@/components/ui/score-card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface WebsiteRow {
  id: string;
  url: string;
  name: string | null;
}

interface IssueData {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  impact: string | null;
  location: string | null;
  fix_dev: string | null;
  fix_code: string | null;
  fix_nocode: string | null;
  fix_content: string | null;
  fix_visual: string | null;
}

const WebsiteAnalysis = () => {
  const { user } = useAuth();
  const [websites, setWebsites] = useState<WebsiteRow[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [qaIssues, setQaIssues] = useState<IssueData[]>([]);
  const [securityIssues, setSecurityIssues] = useState<IssueData[]>([]);
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [securityScore, setSecurityScore] = useState<number | null>(null);
  const [scanCount, setScanCount] = useState(0);

  const loadData = async () => {
    if (!user) return;

    const [websiteRes, scanRes] = await Promise.all([
      supabase.from("websites").select("id, url, name").eq("user_id", user.id),
      supabase.from("scans").select("id, health_score, security_score").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).single(),
    ]);

    if (websiteRes.data) setWebsites(websiteRes.data);

    if (scanRes.data) {
      setHealthScore(scanRes.data.health_score);
      setSecurityScore(scanRes.data.security_score);

      const { data: issues } = await supabase
        .from("scan_issues")
        .select("*")
        .eq("scan_id", scanRes.data.id);

      if (issues) {
        setQaIssues(issues.filter(i => ["qa", "performance", "accessibility", "content"].includes(i.category)));
        setSecurityIssues(issues.filter(i => i.category === "security"));
      }
    }

    // Count today's scans
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("scans")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", today.toISOString());
    setScanCount(count || 0);

    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const addWebsite = async () => {
    if (!newUrl.trim() || !user) return;
    setAdding(true);
    try {
      const { data, error } = await supabase
        .from("websites")
        .insert({ user_id: user.id, url: newUrl.trim(), section: "analysis" })
        .select("id, url, name")
        .single();
      if (error) throw error;
      if (data) setWebsites(prev => [...prev, data]);
      setNewUrl("");
      toast.success("Website added");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAdding(false);
    }
  };

  const removeWebsite = async (id: string) => {
    await supabase.from("websites").delete().eq("id", id);
    setWebsites(prev => prev.filter(w => w.id !== id));
  };

  const runScan = async () => {
    const urlToScan = websites[0]?.url || newUrl.trim();
    if (!urlToScan) {
      toast.error("Add a website first");
      return;
    }
    setScanning(true);
    try {
      await api.analyzeWebsite(urlToScan);
      toast.success("Scan complete!");
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const getFixTypes = (issue: IssueData) => {
    const types: Array<"dev" | "code" | "no-code" | "content" | "visual"> = [];
    if (issue.fix_dev) types.push("dev");
    if (issue.fix_code) types.push("code");
    if (issue.fix_nocode) types.push("no-code");
    if (issue.fix_content) types.push("content");
    if (issue.fix_visual) types.push("visual");
    if (types.length === 0) {
      if (issue.category === "security") types.push("dev");
      else types.push("code");
    }
    return types;
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Globe className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Website Analysis</h1>
              <p className="text-sm text-muted-foreground">QA testing + security scanning</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{scanCount}/15 scans today</span>
            <Button
              size="sm"
              variant="outline"
              className="border-border text-foreground hover:bg-secondary"
              onClick={runScan}
              disabled={scanning}
            >
              {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              Run Scan
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Add website */}
      <div className="bg-card border border-border rounded-lg p-4 mb-6 shadow-card">
        <h3 className="text-sm font-semibold text-foreground mb-3">Monitored Websites</h3>
        <div className="flex gap-2 mb-3">
          <Input
            placeholder="https://yourwebsite.com"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            className="bg-secondary border-border text-foreground"
          />
          <Button onClick={addWebsite} disabled={adding || !newUrl.trim()} size="sm" className="bg-gradient-primary text-primary-foreground">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>
        {websites.length > 0 && (
          <div className="space-y-1">
            {websites.map(w => (
              <div key={w.id} className="flex items-center justify-between px-3 py-1.5 bg-secondary rounded text-sm">
                <span className="text-foreground font-mono text-xs">{w.url}</span>
                <button onClick={() => removeWebsite(w.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scores */}
      {(healthScore !== null || securityScore !== null) && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <ScoreCard label="QA Score" score={healthScore ?? 0} icon={Play} />
          <ScoreCard label="Security Score" score={securityScore ?? 0} icon={Shield} />
        </div>
      )}

      {/* QA Issues */}
      {qaIssues.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Play className="w-4 h-4 text-primary" />
            QA Issues
            <span className="text-xs text-muted-foreground font-normal">({qaIssues.length})</span>
          </h2>
          <div className="space-y-2">
            {qaIssues.map((issue, i) => (
              <ActionItem
                key={issue.id}
                title={issue.title}
                description={issue.description}
                priority={issue.priority as any}
                impact={issue.impact || ""}
                location={issue.location || ""}
                fixTypes={getFixTypes(issue)}
                index={i}
              />
            ))}
          </div>
        </div>
      )}

      {/* Security */}
      {securityIssues.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-destructive" />
            Security Findings
            <span className="text-xs text-muted-foreground font-normal">({securityIssues.length})</span>
          </h2>
          <div className="space-y-2">
            {securityIssues.map((issue, i) => (
              <ActionItem
                key={issue.id}
                title={issue.title}
                description={issue.description}
                priority={issue.priority as any}
                impact={issue.impact || ""}
                location={issue.location || ""}
                fixTypes={getFixTypes(issue)}
                index={i}
              />
            ))}
          </div>
        </div>
      )}

      {qaIssues.length === 0 && securityIssues.length === 0 && (
        <div className="bg-card border border-border rounded-lg p-8 text-center shadow-card">
          <p className="text-sm text-muted-foreground">No issues found yet. Run a scan to analyze your website.</p>
        </div>
      )}
    </div>
  );
};

export default WebsiteAnalysis;
