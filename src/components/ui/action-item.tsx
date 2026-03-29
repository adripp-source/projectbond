import { motion } from "framer-motion";
import { ChevronRight, Code, FileText, Paintbrush, MessageSquare } from "lucide-react";

export type Priority = "critical" | "warning" | "low";
export type FixType = "dev" | "code" | "no-code" | "content" | "visual";

interface ActionItemProps {
  title: string;
  description: string;
  priority: Priority;
  impact: string;
  location: string;
  fixTypes: FixType[];
  index?: number;
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

const ActionItem = ({ title, description, priority, impact, location, fixTypes, index = 0 }: ActionItemProps) => {
  const config = priorityConfig[priority];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-all cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${config.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-foreground truncate">{title}</h4>
            <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded font-mono">
              {location}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{description}</p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-primary font-medium">{impact}</span>
            <div className="flex items-center gap-1">
              {fixTypes.map((ft) => {
                const { icon: FixIcon, label } = fixIcons[ft];
                return (
                  <span
                    key={ft}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded"
                  >
                    <FixIcon className="w-3 h-3" />
                    {label}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity mt-1" />
      </div>
    </motion.div>
  );
};

export default ActionItem;
