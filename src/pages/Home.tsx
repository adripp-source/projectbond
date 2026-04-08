import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Shield, HeartPulse, MessageCircle, TrendingUp, Loader2, RefreshCw,
  CheckCircle2, AlertTriangle, XCircle, ArrowUpRight, ArrowDownRight,
  Minus, Clock, Zap, ArrowRight, Palette, Globe, Target, Paintbrush, Newspaper
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import AIChatBar from "@/components/AIChatBar";

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
  status: string;
}

const getVerdict = (health: number, security: number) => {
  const avg = (health + security) / 2;
  if (avg >= 75) return { icon: CheckCircle2, label: "Your website is in good shape", color: "text-success", bg: "bg-success/10", border: "border-success/30" };
  if (avg >= 50) return { icon: AlertTriangle, label: "Your website needs some attention", color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" };
  return { icon: XCircle, label: "Your website has critical issues", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" };
};

const quickActions = [
  { label: "Run a new scan", description: "Check your website for issues", icon: Globe, path: "/analysis", color: "text-primary" },
  { label: "Fix top issues", description: "See what needs fixing now", icon: Target, path: "/actions", color: "text-warning" },
  { label: "Improve branding", description: "Strengthen your brand identity", icon: Palette, path: "/branding", color: "text-purple-400" },
  { label: "Edit visually", description: "Make visual changes to your site", icon: Paintbrush, path: "/editor", color: "text-success" },
  { label: "Check media presence", description: "See how people talk about you", icon: Newspaper, path: "/media", color: "text-blue-400" },
];

const Home = () => {
  const { user } = useAuth();
  const [scan, setScan] = useState<ScanData | null>(null);
  const [prevScan, setPrevScan] = useState<ScanData | null>(null);
  const [issues, setIssues] = useState<IssueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescanning, setRescanning] = useState(false);
  const [displayName, setDisplayName] = useState("");

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    const [scansRes, profileRes] = await Promise.all([
      supabase.from("scans").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(2),
      supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle(),
    ]);

    if (profileRes.data) setDisplayName((profileRes.data as any).display_name || "");

    if (scansRes.data && scansRes.data.length > 0) {
      setScan(scansRes.data[0]);
      if (scansRes.data.length > 1) setPrevScan(scansRes.data[1]);

      const { data: scanIssues } = await supabase
        .from("scan_issues").select("*").eq("scan_id", scansRes.data[0].id)
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

  // No scans yet — show welcome + guidance
  if (!scan) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground tracking-tight mb-1">
            Welcome{displayName ? `, ${displayName}` : ""} 👋
          </h1>
          <p className="text-muted-foreground text-sm mb-8">
            Let's understand how your website is doing and help you improve it.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Link to="/onboarding">
            <div className="bg-card border border-primary/30 rounded-xl p-8 text-center hover:border-primary/60 transition-colors cursor-pointer mb-8">
              <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center mx-auto mb-4 shadow-glow">
                <Globe className="w-6 h-6 text-primary-foreground" />
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Add Your Website</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Paste your URL and we'll analyze your website's health, security, branding, and more.
              </p>
              <Button className="bg-gradient-primary text-primary-foreground">
                Get Started <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </Link>
        </motion.div>

        <h3 className="text-sm font-semibold text-muted-foreground mb-4">WHAT PROJECT BOND CAN DO</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quickActions.slice(0, 4).map((action, i) => (
            <motion.div key={action.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.05 }}>
              <div className="bg-card border border-border rounded-lg p-4 opacity-60">
                <div className="flex items-center gap-3">
                  <action.icon className={`w-5 h-5 ${action.color}`} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  const verdict = getVerdict(scan.health_score ?? 0, scan.security_score ?? 0);
  const VerdictIcon = verdict.icon;
  const healthDelta = getScoreDelta(scan.health_score, prevScan?.health_score ?? null);
  const securityDelta = getScoreDelta(scan.security_score, prevScan?.security_score ?? null);

  return (
    <div className="p-8 max-w-5xl">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {displayName ? `Hey ${displayName}` : "Welcome back"} 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Here's how <span className="text-foreground font-mono">{scan.url}</span> is doing
              {" · "}
              <Clock className="w-3 h-3 inline" /> {new Date(scan.created_at).toLocaleDateString()}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={handleRescan} disabled={rescanning}
            className="border-border text-foreground hover:bg-secondary">
            {rescanning ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            Rescan
          </Button>
        </div>
      </motion.div>

      {/* Verdict */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className={`${verdict.bg} border ${verdict.border} rounded-xl p-5 mb-6`}>
        <div className="flex items-center gap-3">
          <VerdictIcon className={`w-8 h-8 ${verdict.color}`} />
          <div className="flex-1">
            <h2 className={`text-lg font-bold ${verdict.color}`}>{verdict.label}</h2>
            <p className="text-sm text-secondary-foreground">
              {criticalIssues.length} critical · {warningIssues.length} warnings · {fixedIssues.length} fixed
            </p>
          </div>
          <Link to="/actions">
            <Button size="sm" variant="outline" className="border-current/20 text-foreground">
              View All Issues <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Score Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Health", score: scan.health_score ?? 0, icon: HeartPulse, delta: healthDelta, path: "/analysis" },
          { label: "Security", score: scan.security_score ?? 0, icon: Shield, delta: securityDelta, path: "/analysis" },
          { label: "Sentiment", score: scan.sentiment_score ?? 0, icon: MessageCircle, delta: null, path: "/media" },
        ].map((item, i) => {
          const pct = item.score / 100;
          const scoreColor = pct >= 0.75 ? "text-success" : pct >= 0.5 ? "text-warning" : "text-destructive";
          return (
            <motion.div key={item.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}>
              <Link to={item.path}>
                <div className="bg-card border border-border rounded-lg p-5 shadow-card hover:border-primary/30 transition-colors">
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
                      {item.delta > 0 ? <ArrowUpRight className="w-3 h-3 text-success" /> :
                       item.delta < 0 ? <ArrowDownRight className="w-3 h-3 text-destructive" /> :
                       <Minus className="w-3 h-3 text-muted-foreground" />}
                      <span className={`text-xs font-medium ${
                        item.delta > 0 ? "text-success" : item.delta < 0 ? "text-destructive" : "text-muted-foreground"
                      }`}>
                        {item.delta > 0 ? "+" : ""}{item.delta} vs last scan
                      </span>
                    </div>
                  )}
                </div>
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
        {/* Top 3 – What to improve */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-card border border-border rounded-lg p-5 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              What to Improve
            </h3>
            <Link to="/actions" className="text-xs text-primary hover:underline">Fix now →</Link>
          </div>
          {top3.length > 0 ? (
            <div className="space-y-3">
              {top3.map((issue, i) => (
                <Link key={issue.id} to="/actions">
                  <div className="flex items-start gap-3 group hover:bg-secondary/30 rounded-lg p-2 -m-2 transition-colors cursor-pointer">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5 ${
                      issue.priority === "critical" ? "bg-destructive" : "bg-warning"
                    }`}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{issue.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{issue.description}</p>
                      {issue.impact && <p className="text-xs text-primary mt-1">{issue.impact}</p>}
                    </div>
                    <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 mt-1 flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No critical issues! 🎉</p>
          )}
        </motion.div>

        {/* Quick Actions */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-lg p-5 shadow-card">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            What would you like to do?
          </h3>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <Link key={action.label} to={action.path}>
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer group">
                  <action.icon className={`w-4 h-4 ${action.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </div>
                  <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      </div>

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

      <AIChatBar context="home" placeholder="What would you like to improve?" />
    </div>
  );
};

export default Home;
