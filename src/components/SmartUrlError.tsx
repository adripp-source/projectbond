import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { suggestUrls } from "@/lib/urlSuggest";

interface Props {
  attemptedUrl: string;
  onPick: (url: string) => void;
  onRetry?: () => void;
}

export default function SmartUrlError({ attemptedUrl, onPick, onRetry }: Props) {
  const suggestions = suggestUrls(attemptedUrl);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-lg p-5 shadow-card"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-warning" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Hmm, we couldn't reach that URL</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            <span className="font-mono">{attemptedUrl}</span> didn't load. Did you mean one of these?
          </p>
        </div>
      </div>

      {suggestions.length > 0 ? (
        <div className="space-y-1.5">
          {suggestions.map((s) => (
            <button
              key={s.url}
              onClick={() => onPick(s.url)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-secondary/40 hover:bg-secondary border border-transparent hover:border-primary/40 transition-all group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <ArrowRight className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span className="text-sm font-mono text-foreground truncate">{s.url}</span>
              </div>
              <span className="text-[10px] text-muted-foreground group-hover:text-foreground whitespace-nowrap">{s.reason}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No suggestions — double-check the spelling or try a different domain.</p>
      )}

      {onRetry && (
        <div className="mt-4 pt-3 border-t border-border flex items-center justify-end">
          <Button size="sm" variant="outline" onClick={onRetry} className="border-border text-foreground hover:bg-secondary">
            <RefreshCw className="w-3 h-3 mr-1.5" /> Try original again
          </Button>
        </div>
      )}
    </motion.div>
  );
}
