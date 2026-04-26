import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, Zap, Timer, CalendarClock } from "lucide-react";

export interface ScheduledScan {
  delayMs: number;
  label: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSchedule: (s: ScheduledScan) => void;
}

const PRESETS = [
  { id: "1m", label: "In 1 minute", delayMs: 60_000, icon: Zap, hint: "Quick re-check after a small fix" },
  { id: "10m", label: "In 10 minutes", delayMs: 10 * 60_000, icon: Timer, hint: "Wait for caches to warm up" },
  { id: "1h", label: "In 1 hour", delayMs: 60 * 60_000, icon: Clock, hint: "Re-scan after a deploy" },
];

export default function ScheduledScanDialog({ open, onOpenChange, onSchedule }: Props) {
  const [picked, setPicked] = useState<string>("10m");
  const [customMin, setCustomMin] = useState<string>("30");

  const submit = () => {
    if (picked === "custom") {
      const mins = Math.max(1, Math.min(60 * 24, parseInt(customMin, 10) || 0));
      onSchedule({ delayMs: mins * 60_000, label: `In ${mins} minutes` });
    } else {
      const p = PRESETS.find(p => p.id === picked)!;
      onSchedule({ delayMs: p.delayMs, label: p.label });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-primary" />
            Schedule a scan
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Pick when Bond should re-scan this site. Useful right after deploying a fix.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 mt-2">
          {PRESETS.map((p) => {
            const active = picked === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPicked(p.id)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  active ? "border-primary bg-primary/5" : "border-border bg-secondary/30 hover:border-primary/40"
                }`}
              >
                <p.icon className={`w-4 h-4 mb-2 ${active ? "text-primary" : "text-muted-foreground"}`} />
                <p className="text-sm font-semibold text-foreground">{p.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{p.hint}</p>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setPicked("custom")}
          className={`mt-2 p-3 rounded-lg border text-left transition-all ${
            picked === "custom" ? "border-primary bg-primary/5" : "border-border bg-secondary/30 hover:border-primary/40"
          }`}
        >
          <p className="text-sm font-semibold text-foreground mb-2">Custom delay</p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="1"
              max="1440"
              value={customMin}
              onChange={(e) => { setCustomMin(e.target.value); setPicked("custom"); }}
              className="bg-secondary border-border text-foreground w-24"
            />
            <span className="text-xs text-muted-foreground">minutes from now (max 24h)</span>
          </div>
        </button>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="border-border text-foreground hover:bg-secondary">
            Cancel
          </Button>
          <Button size="sm" onClick={submit} className="bg-gradient-primary text-primary-foreground">
            Schedule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
