import { motion } from "framer-motion";
import { ChevronRight, Code, FileText, Paintbrush, MessageSquare, ThumbsUp, ThumbsDown, EyeOff } from "lucide-react";

export type Priority = "critical" | "warning" | "low";
export type FixType = "dev" | "code" | "no-code" | "content" | "visual";
export type Feedback = "good" | "bad" | null;

interface ActionItemProps {
  title: string;
  description: string;
  priority: Priority;
  impact: string;
  location: string;
  fixTypes: FixType[];
  index?: number;
  feedback?: Feedback;
  onFeedback?: (value: "good" | "bad") => void;
  onIgnore?: () => void;
}

const priorityConfig: Record<Priority, { dot: string; label: string }> = {
  critical: { dot: "bg-destructive", label: "Do Now" },
  warning: { dot: "bg-warning", label: "Next" },
  low: { dot: "bg-success", label: "Later" },
};

const fixIcons: Record<FixType, { icon: typeof Code; label: string }> = {
  dev: { icon: Code, label: "Dev" },
  code: { icon: Code, label: "Code" },
  "no-code": { icon: FileText, label: "No-Code" },
  content: { icon: MessageSquare, label: "Content" },
  visual: { icon: Paintbrush, label: "Visual" },
};

const ActionItem = ({
  title, description, priority, impact, location, fixTypes, index = 0,
  feedback, onFeedback, onIgnore,
}: ActionItemProps) => {
  const config = priorityConfig[priority];

  const fbBtn = (val: "good" | "bad", Icon: typeof ThumbsUp) => {
    const active = feedback === val;
    const color = val === "good" ? "text-success" : "text-destructive";
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onFeedback?.(val); }}
        title={val === "good" ? "Useful — train the model" : "Not useful — train the model"}
        className={`inline-flex items-center justify-center w-7 h-7 rounded border transition-colors ${
          active
            ? `${color} border-current bg-current/10`
            : "text-muted-foreground border-border hover:text-foreground hover:bg-secondary"
        }`}
      >
        <Icon className="w-3.5 h-3.5" />
      </button>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="group bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-all"
    >
      <div className="flex items-start gap-3">
        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${config.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="text-sm font-medium text-foreground">{title}</h4>
            {location && (
              <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded font-mono">
                {location}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{description}</p>
          <div className="flex items-center gap-3 flex-wrap">
            {impact && <span className="text-xs text-primary font-medium">{impact}</span>}
            <div className="flex items-center gap-1">
              {fixTypes.map((ft) => {
                const { icon: FixIcon, label } = fixIcons[ft];
                return (
                  <span key={ft} className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                    <FixIcon className="w-3 h-3" />
                    {label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onFeedback && fbBtn("good", ThumbsUp)}
          {onFeedback && fbBtn("bad", ThumbsDown)}
          {onIgnore && (
            <button
              onClick={(e) => { e.stopPropagation(); onIgnore(); }}
              title="Ignore this finding"
              className="inline-flex items-center justify-center w-7 h-7 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <EyeOff className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    </motion.div>
  );
};

export default ActionItem;
