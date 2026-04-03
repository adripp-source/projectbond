import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Shield, HeartPulse, MessageCircle, TrendingUp, Loader2, RefreshCw,
  CheckCircle2, AlertTriangle, XCircle, ArrowUpRight, ArrowDownRight,
  Minus, BarChart3, Clock, Zap, Globe, Palette, Newspaper, Paintbrush
} from "lucide-react";
import { Link } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ScanData {
  id: string;
  url: string;
  health_score: number | null;
  security_score: number | null;
  sentiment_score: number | null;
  ai_summary: string | null;
  created_at: string;
  status: string;
}

interface IssueData {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  impact: string | null;
  location: string | null;
  status: string;
  created_at: string;
}

const getVerdict = (health: number, security: number) => {
  const avg = (health + security) / 2;
  if (avg >= 75) return { icon: CheckCircle2, label: "Your site is good", color: "text-success", bg: "bg-success/10", border: "border-success/30" };
  if (avg >= 50) return { icon: AlertTriangle, label: "Needs improvement", color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" };
  return { icon: XCircle, label: "Critical issues found", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" };
};

const Home = () => {
  const { user } = useAuth();
  const [scan, setScan] = useState<ScanData | null>(null);
  const [prevScan, setPrevScan] = useState<ScanData | null>(null);
  const [issues, setIssues] = useState<IssueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescanning, setRescanning] = useState(false);
  const [scanHistory, setScanHistory] = useState<Array<{ date: string; issues: number; fixed: number }>>([]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    const { data: scans } = await supabase
      .from("scans")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (scans && scans.length > 0) {
      setScan(scans[0]);
      if (scans.length > 1) setPrevScan(scans[1]);

      // Build scan history for chart
      const history = scans.slice(0, 7).reverse().map(s => ({
        date: new Date(s.created_at).toLocaleDateString("en", { month: "short", day: "numeric" }),
        health: s.health_score ?? 0,
        security: s.security_score ?? 0,
      }));
      setScanHistory(history as any);

      const { data: scanIssues } = await supabase
        .from("scan_issues")
        .select("*")
        .eq("scan_id", scans[0].id)
        .order("created_at", { ascending: true });

      if (scanIssues) setIssues(scanIssues);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const handleRescan = async () => {
    if (!scan?.url) return;
    setRescanning(true);
    try {
      await api.analyzeWebsite(scan.url);
      toast.success("Rescan complete!");
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Rescan failed");
    } finally {
      setRescanning(false);
    }
  };

  const criticalIssues = issues.filter(i => i.priority === "critical");
  const warningIssues = issues.filter(i => i.priority === "warning");
  const fixedIssues = issues.filter(i => i.status === "fixed");
  const top3 = [...criticalIssues, ...warningIssues].slice(0, 3);

  const getScoreDelta = (current: number | null, prev: number | null) => {
    if (current == null || prev == null) return null;
    return current - prev;
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!scan) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="bg-card border border-border rounded-lg p-8 text-center shadow-card">
          <HeartPulse className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">No scans yet</h2>
          <p className="text-sm text-muted-foreground mb-4">Add a website to start your first analysis.</p>
          <Link to="/onboarding">
            <Button className="bg-gradient-primary text-primary-foreground">Add Website</Button>
          </Link>
        </div>
      </div>
    );
  }

  const verdict = getVerdict(scan.health_score ?? 0, scan.security_score ?? 0);
  const VerdictIcon = verdict.icon;
  const healthDelta = getScoreDelta(scan.health_score, prevScan?.health_score ?? null);
  const securityDelta = getScoreDelta(scan.security_score, prevScan?.security_score ?? null);

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Today's Focus
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="text-foreground font-mono">{scan.url}</span>
              {" · "}
              <Clock className="w-3 h-3 inline" /> {new Date(scan.created_at).toLocaleString()}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={handleRescan} disabled={rescanning}
            className="border-border text-foreground hover:bg-secondary">
            {rescanning ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            Rescan
          </Button>
        </div>
      </motion.div>

      {/* Site Verdict */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className={`${verdict.bg} border ${verdict.border} rounded-xl p-5 mb-6`}>
        <div className="flex items-center gap-3">
          <VerdictIcon className={`w-8 h-8 ${verdict.color}`} />
          <div>
            <h2 className={`text-lg font-bold ${verdict.color}`}>{verdict.label}</h2>
            <p className="text-sm text-secondary-foreground">
              {criticalIssues.length} critical · {warningIssues.length} warnings · {fixedIssues.length} fixed
            </p>
          </div>
        </div>
      </motion.div>

      {/* Score Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Health", score: scan.health_score ?? 0, icon: HeartPulse, delta: healthDelta },
          { label: "Security", score: scan.security_score ?? 0, icon: Shield, delta: securityDelta },
          { label: "Sentiment", score: scan.sentiment_score ?? 0, icon: MessageCircle, delta: null },
        ].map((item, i) => {
          const pct = item.score / 100;
          const scoreColor = pct >= 0.75 ? "text-success" : pct >= 0.5 ? "text-warning" : "text-destructive";
          return (
            <motion.div key={item.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="bg-card border border-border rounded-lg p-5 shadow-card cursor-pointer hover:border-primary/30 transition-colors">
              <Link to="/analysis">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground font-medium">{item.label}</span>
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex items-end gap-2">
                  <span className={`text-3xl font-bold tracking-tight ${scoreColor}`}>{item.score}</span>
                  <span className="text-sm text-muted-foreground mb-1">/ 100</span>
                </div>
                {item.delta !== null && (
                  <div className="mt-2 flex items-center gap-1">
                    {item.delta > 0 ? (
                      <ArrowUpRight className="w-3 h-3 text-success" />
                    ) : item.delta < 0 ? (
                      <ArrowDownRight className="w-3 h-3 text-destructive" />
                    ) : (
                      <Minus className="w-3 h-3 text-muted-foreground" />
                    )}
                    <span className={`text-xs font-medium ${
                      item.delta > 0 ? "text-success" : item.delta < 0 ? "text-destructive" : "text-muted-foreground"
                    }`}>
                      {item.delta > 0 ? "+" : ""}{item.delta} vs last scan
                    </span>
                  </div>
                )}
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* AI Summary */}
      {scan.ai_summary && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-lg p-5 mb-6 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-gradient-primary flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">AI Summary</h3>
          </div>
          <p className="text-sm text-secondary-foreground leading-relaxed">{scan.ai_summary}</p>
        </motion.div>
      )}

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Top 3 Critical Fixes */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-card border border-border rounded-lg p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Top 3 Fixes
            </h3>
            <Link to="/actions" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          {top3.length > 0 ? (
            <div className="space-y-3">
              {top3.map((issue, i) => (
                <div key={issue.id} className="flex items-start gap-3 group">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5 ${
                    issue.priority === "critical" ? "bg-destructive" : "bg-warning"
                  }`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{issue.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{issue.description}</p>
                    {issue.impact && (
                      <p className="text-xs text-primary mt-1">{issue.impact}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No critical issues! 🎉</p>
          )}
        </motion.div>

        {/* What Changed */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-lg p-5 shadow-card">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-primary" />
            What Changed Since Last Scan
          </h3>
          {prevScan ? (
            <div className="space-y-3">
              {[
                { label: "Health Score", current: scan.health_score ?? 0, prev: prevScan.health_score ?? 0 },
                { label: "Security Score", current: scan.security_score ?? 0, prev: prevScan.security_score ?? 0 },
                { label: "Sentiment", current: scan.sentiment_score ?? 0, prev: prevScan.sentiment_score ?? 0 },
              ].map(item => {
                const delta = item.current - item.prev;
                return (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-foreground">{item.prev} → {item.current}</span>
                      <span className={`text-xs font-bold ${
                        delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground"
                      }`}>
                        {delta > 0 ? `+${delta}` : delta === 0 ? "—" : delta}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Run another scan to see changes.</p>
          )}
        </motion.div>
      </div>

      {/* Performance Trends Chart */}
      {scanHistory.length > 1 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-card border border-border rounded-lg p-5 shadow-card mb-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Performance Trends</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={scanHistory}>
              <defs>
                <linearGradient id="healthG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="secG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: "hsl(215, 14%, 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215, 14%, 50%)", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: "hsl(220, 13%, 9%)", border: "1px solid hsl(220, 13%, 16%)", borderRadius: "6px", fontSize: "12px" }} />
              <Area type="monotone" dataKey="health" name="Health" stroke="hsl(142, 71%, 45%)" fill="url(#healthG)" strokeWidth={2} />
              <Area type="monotone" dataKey="security" name="Security" stroke="hsl(217, 91%, 60%)" fill="url(#secG)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Issue Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Critical", count: criticalIssues.length, dot: "bg-destructive", color: "text-destructive" },
          { label: "Warnings", count: warningIssues.length, dot: "bg-warning", color: "text-warning" },
          { label: "Total Issues", count: issues.length, dot: "bg-primary", color: "text-primary" },
          { label: "Fixed", count: fixedIssues.length, dot: "bg-success", color: "text-success" },
        ].map(item => (
          <div key={item.label} className="bg-card border border-border rounded-lg p-4 shadow-card">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${item.dot}`} />
              <span className="text-sm text-muted-foreground">{item.label}</span>
            </div>
            <span className={`text-2xl font-bold ${item.color}`}>{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;
