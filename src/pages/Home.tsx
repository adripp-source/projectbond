import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Shield, HeartPulse, MessageCircle, TrendingUp, Loader2, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import ScoreCard from "@/components/ui/score-card";
import ActionItem from "@/components/ui/action-item";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
  fix_dev: string | null;
  fix_code: string | null;
  fix_nocode: string | null;
  fix_content: string | null;
  fix_visual: string | null;
  status: string;
}

const Home = () => {
  const { user } = useAuth();
  const [scan, setScan] = useState<ScanData | null>(null);
  const [issues, setIssues] = useState<IssueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescanning, setRescanning] = useState(false);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    const { data: latestScan } = await supabase
      .from("scans")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (latestScan) {
      setScan(latestScan);
      const { data: scanIssues } = await supabase
        .from("scan_issues")
        .select("*")
        .eq("scan_id", latestScan.id)
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
  const lowIssues = issues.filter(i => i.priority === "low");
  const topActions = [...criticalIssues, ...warningIssues, ...lowIssues].slice(0, 5);

  const getFixTypes = (issue: IssueData) => {
    const types: Array<"dev" | "code" | "no-code" | "content" | "visual"> = [];
    if (issue.fix_dev) types.push("dev");
    if (issue.fix_code) types.push("code");
    if (issue.fix_nocode) types.push("no-code");
    if (issue.fix_content) types.push("content");
    if (issue.fix_visual) types.push("visual");
    if (types.length === 0) {
      if (issue.category === "security") types.push("dev");
      else if (issue.category === "content") types.push("content");
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

  if (!scan) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="bg-card border border-border rounded-lg p-8 text-center shadow-card">
          <HeartPulse className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">No scans yet</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Add a website to start your first analysis.
          </p>
          <Link to="/onboarding">
            <Button className="bg-gradient-primary text-primary-foreground">Add Website</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Analyzing: <span className="text-foreground font-mono">{scan.url}</span>
              {" · "}Last scan: {new Date(scan.created_at).toLocaleString()}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRescan}
            disabled={rescanning}
            className="border-border text-foreground hover:bg-secondary"
          >
            {rescanning ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            Rescan
          </Button>
        </div>
      </motion.div>

      {/* Scores */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <ScoreCard label="Website Health" score={scan.health_score ?? 0} icon={HeartPulse} />
        <ScoreCard label="Security Risk" score={scan.security_score ?? 0} icon={Shield} />
        <ScoreCard label="Customer Sentiment" score={scan.sentiment_score ?? 0} icon={MessageCircle} />
      </div>

      {/* AI Summary */}
      {scan.ai_summary && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card border border-border rounded-lg p-5 mb-8 shadow-card"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-md bg-gradient-primary flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">AI Summary</h3>
          </div>
          <p className="text-sm text-secondary-foreground leading-relaxed">{scan.ai_summary}</p>
        </motion.div>
      )}

      {/* Issue stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-card border border-border rounded-lg p-4 shadow-card">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-destructive" />
            <span className="text-sm text-muted-foreground">Critical</span>
          </div>
          <span className="text-2xl font-bold text-destructive">{criticalIssues.length}</span>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 shadow-card">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-warning" />
            <span className="text-sm text-muted-foreground">Warnings</span>
          </div>
          <span className="text-2xl font-bold text-warning">{warningIssues.length}</span>
        </div>
        <div className="bg-card border border-border rounded-lg p-4 shadow-card">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-success" />
            <span className="text-sm text-muted-foreground">Low Priority</span>
          </div>
          <span className="text-2xl font-bold text-success">{lowIssues.length}</span>
        </div>
      </div>

      {/* Top Actions */}
      {topActions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Priority Actions</h3>
            <Link to="/actions" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <div className="space-y-2">
            {topActions.map((issue, i) => (
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
        </motion.div>
      )}
    </div>
  );
};

export default Home;
