import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface ScoreCardProps {
  label: string;
  score: number;
  maxScore?: number;
  icon: LucideIcon;
  trend?: "up" | "down" | "stable";
  trendValue?: string;
}

const getScoreColor = (score: number, max: number) => {
  const pct = score / max;
  if (pct >= 0.75) return "text-success";
  if (pct >= 0.5) return "text-warning";
  return "text-destructive";
};

const ScoreCard = ({ label, score, maxScore = 100, icon: Icon, trend, trendValue }: ScoreCardProps) => {
  const colorClass = getScoreColor(score, maxScore);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-lg p-5 shadow-card"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground font-medium">{label}</span>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-3xl font-bold tracking-tight ${colorClass}`}>{score}</span>
        <span className="text-sm text-muted-foreground mb-1">/ {maxScore}</span>
      </div>
      {trend && trendValue && (
        <div className="mt-2 flex items-center gap-1.5">
          <span
            className={`text-xs font-medium ${
              trend === "up" ? "text-success" : trend === "down" ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {trendValue}
          </span>
          <span className="text-xs text-muted-foreground">vs last week</span>
        </div>
      )}
    </motion.div>
  );
};

export default ScoreCard;
