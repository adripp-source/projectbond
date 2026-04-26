import { useState } from "react";
import { Github, Lock, Info } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Props {
  value: string;
  onChange: (url: string) => void;
  isPublic: boolean;
  onIsPublicChange: (v: boolean) => void;
  className?: string;
}

const isLikelyGithubUrl = (s: string) =>
  /^https?:\/\/github\.com\/[^/]+\/[^/]+/i.test(s.trim());

/**
 * GitHub repo input. The user pastes a public repo URL; if the repo is NOT
 * public they instead trigger Bond's full OAuth + repo browser flow (handled
 * by a future flow — for now we surface a clear message).
 */
export default function GithubRepoInput({ value, onChange, isPublic, onIsPublicChange, className = "" }: Props) {
  const [touched, setTouched] = useState(false);
  const looksValid = !value || isLikelyGithubUrl(value);

  return (
    <div className={`bg-secondary/30 border border-border rounded-lg p-3 space-y-2 ${className}`}>
      <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
        <Github className="w-3.5 h-3.5 text-primary" /> GitHub repo
        <span className="text-[10px] font-normal normal-case text-muted-foreground/70">(optional)</span>
      </label>

      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value); setTouched(true); }}
        onBlur={() => setTouched(true)}
        placeholder="https://github.com/your-org/your-repo"
        className="bg-card border-border text-foreground font-mono text-xs"
      />

      {touched && value && !looksValid && (
        <p className="text-[10px] text-destructive">Doesn't look like a GitHub repo URL.</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onIsPublicChange(true)}
          className={`p-2 rounded-md border text-left transition-colors ${
            isPublic ? "border-primary bg-primary/10" : "border-border bg-secondary/50 hover:border-primary/40"
          }`}
        >
          <p className="text-xs font-medium text-foreground">Public repo</p>
          <p className="text-[10px] text-muted-foreground">Anyone can view it on GitHub.</p>
        </button>
        <button
          type="button"
          onClick={() => onIsPublicChange(false)}
          className={`p-2 rounded-md border text-left transition-colors ${
            !isPublic ? "border-primary bg-primary/10" : "border-border bg-secondary/50 hover:border-primary/40"
          }`}
        >
          <p className="text-xs font-medium text-foreground flex items-center gap-1">
            <Lock className="w-3 h-3" /> Private
          </p>
          <p className="text-[10px] text-muted-foreground">Needs Bond's GitHub access.</p>
        </button>
      </div>

      {!isPublic && value && (
        <div className="flex items-start gap-1.5 p-2 rounded-md bg-warning/5 border border-warning/30">
          <Info className="w-3 h-3 text-warning mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-foreground/90 leading-relaxed">
            <span className="font-semibold text-warning">Private repo selected.</span> Pasting a URL alone won't work — Bond needs OAuth access. Connect GitHub from <span className="font-mono text-foreground">Settings → Integrations</span> and Bond will swap to the full repo browser automatically.
          </p>
        </div>
      )}

      {isPublic && value && looksValid && (
        <p className="text-[10px] text-muted-foreground">
          ✓ Bond will fetch the repo's <span className="font-mono">README</span>, file tree, and key configs to enrich docs.
        </p>
      )}
    </div>
  );
}
