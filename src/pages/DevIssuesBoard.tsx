import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Code, FileText, Paintbrush, MessageSquare, Wrench, Kanban, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Link } from "react-router-dom";

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

const columns = [
  { key: "to_fix", label: "To Fix", emoji: "🔴", color: "bg-destructive" },
  { key: "in_progress", label: "In Progress", emoji: "🟠", color: "bg-warning" },
  { key: "fixed", label: "Fixed", emoji: "🟢", color: "bg-success" },
];

const DevIssuesBoard = () => {
  const { user } = useAuth();
  const [issues, setIssues] = useState<IssueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [generatingFix, setGeneratingFix] = useState<string | null>(null);
  const [fixResults, setFixResults] = useState<Record<string, string>>({});
  const [movingIssue, setMovingIssue] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadIssues();
  }, [user]);

  const loadIssues = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("scan_issues")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });
    if (data) {
      // Map old statuses to board columns
      const mapped = data.map(issue => ({
        ...issue,
        status: issue.status === "open" || issue.status === "to_fix" ? "to_fix" :
                issue.status === "in_progress" ? "in_progress" :
                issue.status === "fixed" || issue.status === "resolved" ? "fixed" : "to_fix"
      }));
      setIssues(mapped);
    }
    setLoading(false);
  };

  const moveIssue = async (issueId: string, newStatus: string) => {
    setMovingIssue(issueId);
    const { error } = await supabase
      .from("scan_issues")
      .update({ status: newStatus })
      .eq("id", issueId);
    if (error) {
      toast.error("Failed to move issue");
    } else {
      setIssues(prev => prev.map(i => i.id === issueId ? { ...i, status: newStatus } : i));
    }
    setMovingIssue(null);
  };

  const handleGenerateFix = async (issue: IssueData, targetType: string) => {
    const key = `${issue.id}-${targetType}`;
    setGeneratingFix(key);
    try {
      const result = await api.generateFix(issue.id, issue.title, issue.description, targetType);
      setFixResults(prev => ({ ...prev, [key]: result.fix }));
      toast.success("Fix generated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate fix");
    } finally {
      setGeneratingFix(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="bg-card border border-border rounded-lg p-8 text-center shadow-card">
          <Kanban className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">No issues yet</h2>
          <p className="text-sm text-muted-foreground mb-4">Run a website analysis to populate your issue board.</p>
          <Link to="/onboarding">
            <Button className="bg-gradient-primary text-primary-foreground">Analyze a Website</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Kanban className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Dev Issues Board</h1>
            <p className="text-sm text-muted-foreground">{issues.length} issues from AI analysis</p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {columns.map((col) => {
          const colIssues = issues.filter(i => i.status === col.key);
          return (
            <div key={col.key} className="bg-card/50 border border-border rounded-lg p-4 min-h-[300px]">
              <div className="flex items-center gap-2 mb-4">
                <span>{col.emoji}</span>
                <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                <span className="text-xs text-muted-foreground ml-auto bg-secondary px-2 py-0.5 rounded-full">
                  {colIssues.length}
                </span>
              </div>

              <div className="space-y-2">
                {colIssues.map((issue, i) => {
                  const isExpanded = expandedIssue === issue.id;
                  return (
                    <motion.div
                      key={issue.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="bg-card border border-border rounded-lg overflow-hidden"
                    >
                      <button
                        className="w-full text-left p-3 hover:bg-secondary/30 transition-colors"
                        onClick={() => setExpandedIssue(isExpanded ? null : issue.id)}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="w-3 h-3 text-muted-foreground mt-1 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-medium text-foreground truncate">{issue.title}</h4>
                            <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{issue.description}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                issue.priority === "critical" ? "bg-destructive/10 text-destructive" :
                                issue.priority === "warning" ? "bg-warning/10 text-warning" :
                                "bg-success/10 text-success"
                              }`}>
                                {issue.priority}
                              </span>
                              {issue.location && (
                                <span className="text-[10px] text-muted-foreground font-mono">{issue.location}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-3 pb-3 border-t border-border pt-3">
                          <p className="text-xs text-secondary-foreground mb-3">{issue.description}</p>

                          {issue.impact && (
                            <div className="mb-3 bg-primary/5 rounded p-2">
                              <p className="text-[10px] font-semibold text-primary mb-0.5">Impact</p>
                              <p className="text-xs text-foreground">{issue.impact}</p>
                            </div>
                          )}

                          {/* Move buttons */}
                          <div className="flex gap-1 mb-3">
                            {columns.filter(c => c.key !== col.key).map(target => (
                              <Button
                                key={target.key}
                                size="sm"
                                variant="outline"
                                className="text-[10px] h-7 border-border"
                                disabled={movingIssue === issue.id}
                                onClick={() => moveIssue(issue.id, target.key)}
                              >
                                {movingIssue === issue.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                ) : (
                                  <span className="mr-1">{target.emoji}</span>
                                )}
                                Move to {target.label}
                              </Button>
                            ))}
                          </div>

                          {/* Generate Fix */}
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Generate Fix
                          </p>
                          <div className="flex flex-wrap gap-1 mb-3">
                            {[
                              { type: "code", label: "Code", icon: Code },
                              { type: "dev", label: "Dev Steps", icon: Wrench },
                              { type: "content", label: "Content", icon: MessageSquare },
                              { type: "visual", label: "Visual", icon: Paintbrush },
                              { type: "nocode", label: "No-Code", icon: FileText },
                            ].map(({ type, label, icon: Icon }) => (
                              <Button
                                key={type}
                                size="sm"
                                variant="outline"
                                className="border-border text-foreground hover:bg-secondary text-[10px] h-7"
                                disabled={generatingFix === `${issue.id}-${type}`}
                                onClick={() => handleGenerateFix(issue, type)}
                              >
                                {generatingFix === `${issue.id}-${type}` ? (
                                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                ) : (
                                  <Icon className="w-3 h-3 mr-1" />
                                )}
                                {label}
                              </Button>
                            ))}
                          </div>

                          {/* Show fixes */}
                          {[
                            { key: "fix_code", label: "Code Fix", value: issue.fix_code },
                            { key: "fix_dev", label: "Dev Steps", value: issue.fix_dev },
                            { key: "fix_nocode", label: "No-Code", value: issue.fix_nocode },
                            { key: "fix_content", label: "Content", value: issue.fix_content },
                            { key: "fix_visual", label: "Visual", value: issue.fix_visual },
                          ].map(({ key, label, value }) => {
                            const generatedFix = fixResults[`${issue.id}-${key.replace("fix_", "")}`];
                            const displayValue = generatedFix || value;
                            if (!displayValue) return null;
                            return (
                              <div key={key} className="mt-2 bg-secondary rounded p-2">
                                <h6 className="text-[10px] font-semibold text-foreground mb-1">{label}</h6>
                                <pre className="text-[10px] text-secondary-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-32 overflow-y-auto">
                                  {displayValue}
                                </pre>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DevIssuesBoard;
