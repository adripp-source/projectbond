import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Target, Loader2, Code, FileText, Paintbrush, MessageSquare, Wrench } from "lucide-react";
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

const sections: { key: Priority; label: string; emoji: string }[] = [
  { key: "critical", label: "Do Now", emoji: "🔴" },
  { key: "warning", label: "Next", emoji: "🟠" },
  { key: "low", label: "Later", emoji: "🟢" },
];

const StandardActionCenter = () => {
  const { user } = useAuth();
  const [issues, setIssues] = useState<IssueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [generatingFix, setGeneratingFix] = useState<string | null>(null);
  const [fixResults, setFixResults] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    supabase
      .from("scan_issues")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setIssues(data);
        setLoading(false);
      });
  }, [user]);

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
          <Target className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">No issues found yet</h2>
          <p className="text-sm text-muted-foreground mb-4">Run a website analysis to populate your Action Center.</p>
          <Link to="/onboarding">
            <Button className="bg-gradient-primary text-primary-foreground">Analyze a Website</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Target className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Action Center</h1>
            <p className="text-sm text-muted-foreground">{issues.length} issues prioritized by business impact</p>
          </div>
        </div>
      </motion.div>

      {sections.map((section) => {
        const sectionIssues = issues.filter(i => i.priority === section.key);
        if (sectionIssues.length === 0) return null;
        return (
          <div key={section.key} className="mb-8">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <span>{section.emoji}</span>
              {section.label}
              <span className="text-xs text-muted-foreground font-normal">({sectionIssues.length})</span>
            </h2>
            <div className="space-y-2">
              {sectionIssues.map((issue, i) => {
                const isExpanded = expandedIssue === issue.id;
                return (
                  <motion.div
                    key={issue.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="bg-card border border-border rounded-lg overflow-hidden"
                  >
                    <button
                      className="w-full text-left p-4 hover:bg-secondary/30 transition-colors"
                      onClick={() => setExpandedIssue(isExpanded ? null : issue.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          section.key === "critical" ? "bg-destructive" :
                          section.key === "warning" ? "bg-warning" : "bg-success"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-medium text-foreground truncate">{issue.title}</h4>
                            {issue.location && (
                              <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded font-mono">
                                {issue.location}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1">{issue.description}</p>
                          {issue.impact && (
                            <span className="text-xs text-primary font-medium mt-1 inline-block">{issue.impact}</span>
                          )}
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-border pt-4">
                        <p className="text-sm text-secondary-foreground mb-4">{issue.description}</p>

                        <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                          Generate Fix For:
                        </h5>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {[
                            { type: "dev", label: "Dev Team", icon: Wrench },
                            { type: "code", label: "Code", icon: Code },
                            { type: "nocode", label: "No-Code", icon: FileText },
                            { type: "content", label: "Content", icon: MessageSquare },
                            { type: "visual", label: "Visual", icon: Paintbrush },
                          ].map(({ type, label, icon: Icon }) => (
                            <Button
                              key={type}
                              size="sm"
                              variant="outline"
                              className="border-border text-foreground hover:bg-secondary text-xs"
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

                        {[
                          { key: "fix_dev", label: "Dev Team Fix", value: issue.fix_dev },
                          { key: "fix_code", label: "Code Fix", value: issue.fix_code },
                          { key: "fix_nocode", label: "No-Code Instructions", value: issue.fix_nocode },
                          { key: "fix_content", label: "Content Fix", value: issue.fix_content },
                          { key: "fix_visual", label: "Visual Fix", value: issue.fix_visual },
                        ].map(({ key, label, value }) => {
                          const generatedFix = fixResults[`${issue.id}-${key.replace("fix_", "")}`];
                          const displayValue = generatedFix || value;
                          if (!displayValue) return null;
                          return (
                            <div key={key} className="mt-3 bg-secondary rounded-lg p-3">
                              <h6 className="text-xs font-semibold text-foreground mb-2">{label}</h6>
                              <pre className="text-xs text-secondary-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
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
  );
};

export default StandardActionCenter;
