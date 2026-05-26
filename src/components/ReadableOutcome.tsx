import { motion } from "framer-motion";
import { Target, Sparkles, TrendingUp, PlayCircle, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

export interface OutcomeBlock {
  goal: string;
  change: string;
  impact: string;
  tryIt?: string;
  level?: string;
}

interface Props {
  raw: string;
  level?: string;
}

// Parse Gemini output into readable blocks. Falls back to a single block when AI returned prose.
function parseOutcome(raw: string): OutcomeBlock[] {
  if (!raw) return [];

  const text = raw.trim();
  // Try to detect numbered steps "1. ... 2. ..."
  const steps = text.split(/\n(?=\s*\d+\.)/g).map(s => s.trim()).filter(Boolean);

  const toBlock = (chunk: string): OutcomeBlock => {
    // Strip leading "1." etc.
    const body = chunk.replace(/^\s*\d+\.\s*/, "").trim();

    // Heuristic: first sentence becomes goal/change, rest becomes impact
    const sentences = body.split(/(?<=[.!?])\s+/);
    const goal = (sentences[0] || body).slice(0, 140);
    const change = sentences.slice(1, 3).join(" ").slice(0, 280) || goal;
    const impact = sentences.slice(3).join(" ").slice(0, 240) || "Cleaner experience for visitors and easier maintenance.";

    return { goal, change, impact };
  };

  if (steps.length >= 2) return steps.slice(0, 6).map(toBlock);

  // Otherwise split on blank lines
  const paras = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  if (paras.length >= 2) return paras.slice(0, 6).map(toBlock);

  return [toBlock(text)];
}

export default function ReadableOutcome({ raw, level }: Props) {
  const blocks = parseOutcome(raw);
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div className="space-y-3">
      {level && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">{level} fix</Badge>
          <span className="text-[10px] text-muted-foreground">{blocks.length} {blocks.length === 1 ? "change" : "changes"}</span>
        </div>
      )}

      {blocks.map((b, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
          className="bg-secondary/30 border border-border rounded-lg overflow-hidden"
        >
          <div className="p-3 border-b border-border flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
              {i + 1}
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <Target className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <p className="text-sm font-semibold text-foreground truncate">{b.goal}</p>
            </div>
          </div>

          <div className="p-3 space-y-2.5">
            <div className="flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Change</p>
                <p className="text-xs text-foreground leading-relaxed">{b.change}</p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-success flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Why it matters</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{b.impact}</p>
              </div>
            </div>

            {b.tryIt && (
              <div className="flex items-start gap-2">
                <PlayCircle className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Try it</p>
                  <p className="text-xs text-foreground leading-relaxed">{b.tryIt}</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      ))}

      <button
        onClick={() => setShowRaw(s => !s)}
        className="w-full flex items-center justify-center gap-1 py-2 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown className={`w-3 h-3 transition-transform ${showRaw ? "rotate-180" : ""}`} />
        {showRaw ? "Hide raw output" : "View raw output"}
      </button>

      {showRaw && (
        <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed bg-secondary/40 p-3 rounded-md border border-border">
          {raw}
        </pre>
      )}
    </div>
  );
}
