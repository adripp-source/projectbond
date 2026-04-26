import { Gauge } from "lucide-react";

interface Props {
  value: number;                 // 1..5
  onChange: (v: number) => void;
  label?: string;
  hint?: string;
  className?: string;
}

const LEVELS = [
  { v: 1, label: "Plain English", desc: "Zero jargon. No code." },
  { v: 2, label: "Friendly",      desc: "Light tech words explained." },
  { v: 3, label: "Balanced",      desc: "A mix of plain & technical." },
  { v: 4, label: "Technical",     desc: "Real terms, code snippets, configs." },
  { v: 5, label: "Deeply technical", desc: "Architecture, edge cases, internals." },
];

/**
 * Technicality Meter — how technical the user wants the output to be.
 * Used in onboarding, per-website setup, settings, and every manual generation.
 */
export default function TechnicalityMeter({ value, onChange, label = "Technicality", hint, className = "" }: Props) {
  const safeValue = Math.min(5, Math.max(1, value || 3));
  const current = LEVELS.find(l => l.v === safeValue)!;

  return (
    <div className={`bg-secondary/30 border border-border rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
          <Gauge className="w-3.5 h-3.5 text-primary" /> {label}
        </label>
        <span className="text-[10px] text-muted-foreground font-mono">level {safeValue}/5</span>
      </div>

      <div className="grid grid-cols-5 gap-1 mb-2">
        {LEVELS.map((l) => (
          <button
            key={l.v}
            type="button"
            onClick={() => onChange(l.v)}
            className={`h-2 rounded-full transition-all ${
              l.v <= safeValue
                ? "bg-gradient-primary"
                : "bg-secondary hover:bg-secondary/80"
            }`}
            aria-label={`${l.label} (level ${l.v})`}
          />
        ))}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">{current.label}</p>
        <p className="text-[11px] text-muted-foreground">{current.desc}</p>
      </div>

      {hint && (
        <p className="text-[10px] text-muted-foreground/70 mt-2 leading-relaxed">{hint}</p>
      )}
    </div>
  );
}
