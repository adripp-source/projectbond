import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Loader2, ArrowRight, ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type Priority = "critical" | "warning" | "low";

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
  scan_id: string;
}

const priorityOrder: Record<string, number> = { critical: 0, warning: 1, low: 2 };
const priorityLabels: Record<string, { label: string; dot: string; bg: string }> = {
  critical: { label: "Critical", dot: "bg-destructive", bg: "bg-destructive/10 border-destructive/30" },
  warning: { label: "Needs Attention", dot: "bg-warning", bg: "bg-warning/10 border-warning/30" },
  low: { label: "Minor", dot: "bg-success", bg: "bg-success/10 border-success/30" },
};

const StandardActionCenter = () => {
  const { user } = useAuth();
  const [issues, setIssues] = useState<IssueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [generatingFix, setGeneratingFix] = useState<string | null>(null);
  const [fixResult, setFixResult] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"focus" | "list">("focus");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("scan_issues")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) {
          // Sort by priority
          const sorted = [...data].sort((a, b) =>
            (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
          );
          setIssues(sorted);
        }
        setLoading(false);
      });
  }, [user]);

  const handleGenerateFix = async (issue: IssueData, targetType: string) => {
    const key = `${issue.id}-${targetType}`;
    setGeneratingFix(key);
    setFixResult(null);
    try {
      const result = await api.generateFix(issue.id, issue.title, issue.description, targetType);
      setFixResult(result.fix);
      toast.success("Fix generated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate fix");
    } finally {
      setGeneratingFix(null);
    }
  };

  const currentIssue = issues[currentIndex];
  const goNext = () => { setCurrentIndex(i => Math.min(i + 1, issues.length - 1)); setFixResult(null); };
  const goPrev = () => { setCurrentIndex(i => Math.max(i - 1, 0)); setFixResult(null); };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-card border border-border rounded-lg p-8 text-center shadow-card">
          <Target className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">No issues found yet</h2>
          <p className="text-sm text-muted-foreground mb-4">Run a website analysis to find things to improve.</p>
          <Link to="/analysis">
            <Button className="bg-gradient-primary text-primary-foreground">Analyze a Website</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Target className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Action Center</h1>
              <p className="text-sm text-muted-foreground">
                {issues.filter(i => i.priority === "critical").length} critical · {issues.length} total issues
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={viewMode === "focus" ? "default" : "outline"}
              onClick={() => setViewMode("focus")}
              className={viewMode === "focus" ? "bg-gradient-primary text-primary-foreground" : "border-border text-foreground"}>
              Focus View
            </Button>
            <Button size="sm" variant={viewMode === "list" ? "default" : "outline"}
              onClick={() => setViewMode("list")}
              className={viewMode === "list" ? "bg-gradient-primary text-primary-foreground" : "border-border text-foreground"}>
              All Issues
            </Button>
          </div>
        </div>
      </motion.div>

      {viewMode === "focus" && currentIssue ? (
        /* Focus View - One issue at a time */
        <div>
          {/* Progress bar */}
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs text-muted-foreground font-mono">{currentIndex + 1} / {issues.length}</span>
            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-gradient-primary rounded-full transition-all"
                style={{ width: `${((currentIndex + 1) / issues.length) * 100}%` }} />
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={currentIssue.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              
              {/* Priority badge */}
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium mb-4 ${
                priorityLabels[currentIssue.priority]?.bg || "bg-secondary border-border"
              }`}>
                <div className={`w-2 h-2 rounded-full ${priorityLabels[currentIssue.priority]?.dot || "bg-muted"}`} />
                {priorityLabels[currentIssue.priority]?.label || currentIssue.priority}
                {currentIssue.category && (
                  <span className="text-muted-foreground">· {currentIssue.category}</span>
                )}
              </div>

              {/* Issue content */}
              <div className="bg-card border border-border rounded-xl p-6 shadow-card mb-4">
                <h2 className="text-lg font-semibold text-foreground mb-3">{currentIssue.title}</h2>
                <p className="text-sm text-secondary-foreground leading-relaxed mb-4">{currentIssue.description}</p>
                
                {currentIssue.impact && (
                  <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 mb-4">
                    <p className="text-xs font-semibold text-primary mb-1">Why it matters</p>
                    <p className="text-sm text-foreground">{currentIssue.impact}</p>
                  </div>
                )}

                {currentIssue.location && (
                  <p className="text-xs text-muted-foreground font-mono bg-secondary px-3 py-1.5 rounded inline-block mb-4">
                    📍 {currentIssue.location}
                  </p>
                )}

                {/* How to fix */}
                <div className="border-t border-border pt-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3">How would you like to fix this?</h3>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {[
                      { type: "code", label: "Show me the code fix" },
                      { type: "nocode", label: "No-code instructions" },
                      { type: "content", label: "Content suggestion" },
                      { type: "visual", label: "Visual fix" },
                    ].map(({ type, label }) => (
                      <Button key={type} size="sm" variant="outline"
                        className="border-border text-foreground hover:bg-secondary text-xs"
                        disabled={!!generatingFix}
                        onClick={() => handleGenerateFix(currentIssue, type)}>
                        {generatingFix === `${currentIssue.id}-${type}` ? (
                          <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                        ) : null}
                        {label}
                      </Button>
                    ))}
                  </div>

                  {fixResult && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-secondary rounded-lg p-4">
                      <pre className="text-xs text-secondary-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
                        {fixResult}
                      </pre>
                    </motion.div>
                  )}

                  {/* Existing fixes */}
                  {[
                    { key: "fix_code", label: "Code Fix", value: currentIssue.fix_code },
                    { key: "fix_nocode", label: "No-Code Steps", value: currentIssue.fix_nocode },
                    { key: "fix_content", label: "Content Fix", value: currentIssue.fix_content },
                  ].filter(f => f.value && !fixResult).map(({ key, label, value }) => (
                    <div key={key} className="mt-3 bg-secondary rounded-lg p-3">
                      <h6 className="text-xs font-semibold text-foreground mb-2">{label}</h6>
                      <pre className="text-xs text-secondary-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                        {value}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <Button size="sm" variant="outline" onClick={goPrev} disabled={currentIndex === 0}
                  className="border-border text-foreground">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Button>
                <Button size="sm" onClick={goNext} disabled={currentIndex === issues.length - 1}
                  className="bg-gradient-primary text-primary-foreground">
                  Next Issue <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        /* List View */
        <div className="space-y-2">
          {["critical", "warning", "low"].map(priority => {
            const group = issues.filter(i => i.priority === priority);
            if (group.length === 0) return null;
            const info = priorityLabels[priority];
            return (
              <div key={priority} className="mb-6">
                <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${info?.dot}`} />
                  {info?.label} <span className="text-xs text-muted-foreground font-normal">({group.length})</span>
                </h2>
                <div className="space-y-2">
                  {group.map((issue, i) => (
                    <motion.div key={issue.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors cursor-pointer"
                      onClick={() => { setCurrentIndex(issues.indexOf(issue)); setViewMode("focus"); setFixResult(null); }}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-foreground">{issue.title}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{issue.description}</p>
                          {issue.impact && (
                            <p className="text-xs text-primary mt-1">{issue.impact}</p>
                          )}
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StandardActionCenter;
