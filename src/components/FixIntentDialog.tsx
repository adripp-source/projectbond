import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FileText, Wrench, BookOpen, MessageSquareMore, Briefcase } from "lucide-react";
import TechnicalityMeter from "@/components/TechnicalityMeter";

export type FixLevel = "quick" | "standard" | "deep" | "custom";

export interface FixIntent {
  level: FixLevel;
  custom?: string;
  role?: string;
  technicality?: number;       // 1..5
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (intent: FixIntent) => void;
  title?: string;
  description?: string;
}

const LEVELS: { id: FixLevel; icon: any; label: string; tagline: string; desc: string; time: string; }[] = [
  {
    id: "quick",
    icon: FileText,
    label: "Snapshot",
    tagline: "Quick overview",
    desc: "A short, plain-English summary of the site so a new hire gets the gist in a couple of minutes. Best for non-technical teammates or first-day intros.",
    time: "~10s",
  },
  {
    id: "standard",
    icon: Wrench,
    label: "Standard",
    tagline: "Balanced guide",
    desc: "A practical onboarding doc with the main sections, key pages, and what to learn first. Good fit for most new hires across roles.",
    time: "~25s",
  },
  {
    id: "deep",
    icon: BookOpen,
    label: "Full handoff",
    tagline: "Thorough walkthrough",
    desc: "A detailed onboarding handoff covering setup steps, common pitfalls, and a first-week checklist. Use when someone is taking real ownership.",
    time: "~40s",
  },
  {
    id: "custom",
    icon: MessageSquareMore,
    label: "Custom",
    tagline: "Describe it yourself",
    desc: "Tell Bond exactly what the doc should cover and we'll tailor the outcome to that — sections, depth, audience, anything.",
    time: "varies",
  },
];

export default function FixIntentDialog({ open, onOpenChange, onConfirm, title, description }: Props) {
  const [level, setLevel] = useState<FixLevel>("standard");
  const [custom, setCustom] = useState("");
  const [role, setRole] = useState("");

  const submit = () => {
    onConfirm({
      level,
      custom: level === "custom" ? custom.trim() : undefined,
      role: role.trim() || undefined,
    });
    onOpenChange(false);
    setCustom("");
    setRole("");
    setLevel("standard");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">{title || "How should we fix this?"}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {description || "Pick the depth of change you want. Bond will tailor the outcome to match."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mt-2">
          {LEVELS.map((l) => {
            const active = level === l.id;
            return (
              <button
                key={l.id}
                onClick={() => setLevel(l.id)}
                className={`text-left p-4 rounded-lg border transition-all ${
                  active
                    ? "border-primary bg-primary/5 shadow-card"
                    : "border-border bg-secondary/30 hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                      <l.icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">{l.label}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">{l.time}</span>
                </div>
                <p className="text-xs font-medium text-primary mb-1">{l.tagline}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{l.desc}</p>
              </button>
            );
          })}
        </div>

        {level === "custom" && (
          <div className="mt-2">
            <label className="text-xs font-medium text-foreground mb-1.5 block">Describe what you want</label>
            <Textarea
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="e.g. 'Write it for a brand-new marketing hire — focus on what each page does, skip technical setup.'"
              className="bg-secondary border-border text-foreground text-sm min-h-[90px]"
              autoFocus
            />
          </div>
        )}

        <div className="mt-3 p-3 rounded-lg border border-border bg-secondary/30">
          <label className="text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
            <Briefcase className="w-3.5 h-3.5 text-primary" />
            Who is this for? <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <Input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. New marketing hire, junior developer, customer support lead, anyone…"
            className="bg-card border-border text-foreground text-sm"
          />
          <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
            Tell us the role and we'll tailor the language and depth. Leave blank for a general-purpose doc that works for everyone.
          </p>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="border-border text-foreground hover:bg-secondary">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={submit}
            disabled={level === "custom" && !custom.trim()}
            className="bg-gradient-primary text-primary-foreground"
          >
            Generate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
