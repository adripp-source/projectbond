import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Code, FileText, Paintbrush, MessageSquare, Wrench, Kanban,
  Filter, ChevronDown, ChevronUp, Camera, Video, RotateCcw, Send, Trash2
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

interface Comment {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
}

const columns = [
  { key: "to_fix", label: "To Fix", emoji: "🔴", color: "bg-destructive" },
  { key: "in_progress", label: "In Progress", emoji: "🟠", color: "bg-warning" },
  { key: "fixed", label: "Fixed", emoji: "🟢", color: "bg-success" },
];

const categories = ["all", "qa", "security", "ui", "content", "accessibility", "performance", "functional", "responsive", "user_flow", "edge_case"];
const priorities = ["all", "critical", "warning", "info"];

const DevIssuesBoard = () => {
  const { user } = useAuth();
  const [issues, setIssues] = useState<IssueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [generatingFix, setGeneratingFix] = useState<string | null>(null);
  const [fixResults, setFixResults] = useState<Record<string, string>>({});

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [searchFilter, setSearchFilter] = useState("");

  // Comments
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});

  // Reproduction
  const [replicationSteps, setReplicationSteps] = useState<Record<string, string>>({});
  const [generatingReplication, setGeneratingReplication] = useState<string | null>(null);

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

  const loadComments = useCallback(async (issueId: string) => {
    const { data } = await supabase
      .from("issue_comments")
      .select("*")
      .eq("issue_id", issueId)
      .order("created_at", { ascending: true });
    if (data) {
      setComments(prev => ({ ...prev, [issueId]: data }));
    }
  }, []);

  const addComment = async (issueId: string) => {
    if (!user || !newComment[issueId]?.trim()) return;
    const { error } = await supabase.from("issue_comments").insert({
      issue_id: issueId,
      user_id: user.id,
      content: newComment[issueId].trim(),
    });
    if (error) {
      toast.error("Failed to add comment");
    } else {
      setNewComment(prev => ({ ...prev, [issueId]: "" }));
      loadComments(issueId);
      toast.success("Comment added");
    }
  };

  const deleteComment = async (commentId: string, issueId: string) => {
    await supabase.from("issue_comments").delete().eq("id", commentId);
    loadComments(issueId);
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const issueId = result.draggableId;
    const newStatus = result.destination.droppableId;
    const oldStatus = result.source.droppableId;
    if (newStatus === oldStatus) return;

    // Optimistic update
    setIssues(prev => prev.map(i => i.id === issueId ? { ...i, status: newStatus } : i));

    const { error } = await supabase
      .from("scan_issues")
      .update({ status: newStatus })
      .eq("id", issueId);

    if (error) {
      toast.error("Failed to move issue");
      setIssues(prev => prev.map(i => i.id === issueId ? { ...i, status: oldStatus } : i));
    } else {
      toast.success("Issue moved", { duration: 1500 });
    }
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

  const handleGenerateReplication = async (issue: IssueData) => {
    setGeneratingReplication(issue.id);
    try {
      const result = await api.generateFix(issue.id, issue.title, issue.description, "replication");
      setReplicationSteps(prev => ({ ...prev, [issue.id]: result.fix }));
      toast.success("Replication steps generated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate replication steps");
    } finally {
      setGeneratingReplication(null);
    }
  };

  const filteredIssues = issues.filter(issue => {
    if (categoryFilter !== "all" && issue.category !== categoryFilter) return false;
    if (priorityFilter !== "all" && issue.priority !== priorityFilter) return false;
    if (searchFilter && !issue.title.toLowerCase().includes(searchFilter.toLowerCase()) &&
        !issue.description.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  });

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
    <div className="p-4 md:p-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Kanban className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Dev Issues Board</h1>
            <p className="text-sm text-muted-foreground">{filteredIssues.length} of {issues.length} issues</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 bg-card border border-border rounded-lg p-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search issues..."
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            className="w-48 h-8 text-xs"
          />
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map(c => (
                <SelectItem key={c} value={c} className="text-xs">
                  {c === "all" ? "All Categories" : c.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              {priorities.map(p => (
                <SelectItem key={p} value={p} className="text-xs">
                  {p === "all" ? "All Priorities" : p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(categoryFilter !== "all" || priorityFilter !== "all" || searchFilter) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => { setCategoryFilter("all"); setPriorityFilter("all"); setSearchFilter(""); }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </motion.div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {columns.map((col) => {
            const colIssues = filteredIssues.filter(i => i.status === col.key);
            return (
              <Droppable key={col.key} droppableId={col.key}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`bg-card/50 border rounded-lg p-3 min-h-[300px] transition-colors ${
                      snapshot.isDraggingOver ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span>{col.emoji}</span>
                      <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                      <span className="text-xs text-muted-foreground ml-auto bg-secondary px-2 py-0.5 rounded-full">
                        {colIssues.length}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {colIssues.map((issue, i) => (
                        <IssueCard
                          key={issue.id}
                          issue={issue}
                          index={i}
                          isExpanded={expandedIssue === issue.id}
                          onToggle={() => {
                            const willExpand = expandedIssue !== issue.id;
                            setExpandedIssue(willExpand ? issue.id : null);
                            if (willExpand) loadComments(issue.id);
                          }}
                          currentColumn={col.key}
                          generatingFix={generatingFix}
                          fixResults={fixResults}
                          onGenerateFix={handleGenerateFix}
                          comments={comments[issue.id] || []}
                          newComment={newComment[issue.id] || ""}
                          onNewCommentChange={(v) => setNewComment(prev => ({ ...prev, [issue.id]: v }))}
                          onAddComment={() => addComment(issue.id)}
                          onDeleteComment={(cid) => deleteComment(cid, issue.id)}
                          replicationSteps={replicationSteps[issue.id]}
                          generatingReplication={generatingReplication === issue.id}
                          onGenerateReplication={() => handleGenerateReplication(issue)}
                        />
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
};

// Extracted Issue Card component
interface IssueCardProps {
  issue: IssueData;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  currentColumn: string;
  generatingFix: string | null;
  fixResults: Record<string, string>;
  onGenerateFix: (issue: IssueData, type: string) => void;
  comments: Comment[];
  newComment: string;
  onNewCommentChange: (v: string) => void;
  onAddComment: () => void;
  onDeleteComment: (id: string) => void;
  replicationSteps?: string;
  generatingReplication: boolean;
  onGenerateReplication: () => void;
}

const IssueCard = ({
  issue, index, isExpanded, onToggle, currentColumn,
  generatingFix, fixResults, onGenerateFix,
  comments, newComment, onNewCommentChange, onAddComment, onDeleteComment,
  replicationSteps, generatingReplication, onGenerateReplication
}: IssueCardProps) => {
  return (
    <Draggable draggableId={issue.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`bg-card border rounded-lg overflow-hidden transition-shadow ${
            snapshot.isDragging ? "shadow-lg border-primary ring-2 ring-primary/20" : "border-border"
          }`}
          aria-label={`Issue: ${issue.title}, Priority: ${issue.priority}`}
        >
          <button
            className="w-full text-left p-3 hover:bg-secondary/30 transition-colors"
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-label={`${isExpanded ? "Collapse" : "Expand"} issue: ${issue.title}`}
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-medium text-foreground truncate">{issue.title}</h4>
                <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{issue.description}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    issue.priority === "critical" ? "bg-destructive/10 text-destructive" :
                    issue.priority === "warning" ? "bg-warning/10 text-warning" :
                    "bg-success/10 text-success"
                  }`}>
                    {issue.priority}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                    {issue.category}
                  </span>
                  {issue.location && (
                    <span className="text-[10px] text-muted-foreground font-mono">{issue.location}</span>
                  )}
                </div>
              </div>
              {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-1" /> : <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-1" />}
            </div>
          </button>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-3 pb-3 border-t border-border pt-3 space-y-3">
                  <p className="text-xs text-secondary-foreground">{issue.description}</p>

                  {issue.impact && (
                    <div className="bg-primary/5 rounded p-2">
                      <p className="text-[10px] font-semibold text-primary mb-0.5">Impact</p>
                      <p className="text-xs text-foreground">{issue.impact}</p>
                    </div>
                  )}

                  {/* Reproduction & Evidence */}
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Reproduce & Evidence
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        size="sm" variant="outline"
                        className="text-[10px] h-7 border-border"
                        disabled={generatingReplication}
                        onClick={onGenerateReplication}
                      >
                        {generatingReplication ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                        How to replicate
                      </Button>
                      <Button size="sm" variant="outline" className="text-[10px] h-7 border-border" onClick={() => toast.info("Screenshot capture coming soon")}>
                        <Camera className="w-3 h-3 mr-1" /> Screenshot
                      </Button>
                      <Button size="sm" variant="outline" className="text-[10px] h-7 border-border" onClick={() => toast.info("Video capture coming soon")}>
                        <Video className="w-3 h-3 mr-1" /> Video
                      </Button>
                    </div>
                    {replicationSteps && (
                      <div className="mt-2 bg-secondary rounded p-2">
                        <h6 className="text-[10px] font-semibold text-foreground mb-1">Replication Steps</h6>
                        <pre className="text-[10px] text-secondary-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-32 overflow-y-auto">
                          {replicationSteps}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Generate Fix */}
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Generate Fix
                    </p>
                    <div className="flex flex-wrap gap-1">
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
                          onClick={() => onGenerateFix(issue, type)}
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
                      <div key={key} className="bg-secondary rounded p-2">
                        <h6 className="text-[10px] font-semibold text-foreground mb-1">{label}</h6>
                        <pre className="text-[10px] text-secondary-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-32 overflow-y-auto">
                          {displayValue}
                        </pre>
                      </div>
                    );
                  })}

                  {/* Comments */}
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Comments ({comments.length})
                    </p>
                    {comments.length > 0 && (
                      <div className="space-y-1.5 mb-2 max-h-32 overflow-y-auto">
                        {comments.map(c => (
                          <div key={c.id} className="bg-secondary rounded p-2 flex items-start gap-2">
                            <div className="flex-1">
                              <p className="text-[10px] text-foreground">{c.content}</p>
                              <p className="text-[9px] text-muted-foreground mt-0.5">
                                {new Date(c.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <button onClick={() => onDeleteComment(c.id)} className="text-muted-foreground hover:text-destructive" aria-label="Delete comment">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-1">
                      <Input
                        placeholder="Add a comment..."
                        value={newComment}
                        onChange={e => onNewCommentChange(e.target.value)}
                        className="h-7 text-[10px] flex-1"
                        onKeyDown={e => e.key === "Enter" && onAddComment()}
                      />
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={onAddComment} aria-label="Send comment">
                        <Send className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </Draggable>
  );
};

export default DevIssuesBoard;
