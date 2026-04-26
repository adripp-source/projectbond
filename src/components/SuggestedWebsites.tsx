import { useEffect, useState } from "react";
import { Globe, Plus, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getSuggestedWebsites, adoptWebsite, SyncedWebsite } from "@/lib/websiteSync";
import { toast } from "sonner";

interface Props {
  section: string;
  onAdopted?: (w: SyncedWebsite) => void;
}

export default function SuggestedWebsites({ section, onAdopted }: Props) {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<SyncedWebsite[]>([]);
  const [adopting, setAdopting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getSuggestedWebsites(user.id, section).then(setSuggestions);
  }, [user, section]);

  if (!user || suggestions.length === 0) return null;

  const adopt = async (w: SyncedWebsite) => {
    setAdopting(w.url);
    const created = await adoptWebsite(user.id, w.url, section);
    if (created) {
      toast.success(`${w.url} added to this section`);
      setSuggestions(prev => prev.filter(s => s.url !== w.url));
      onAdopted?.(created);
    } else {
      toast.error("Couldn't add — try the manual input");
    }
    setAdopting(null);
  };

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <p className="text-xs font-semibold text-foreground">Use a website you already added</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.slice(0, 5).map((w) => (
          <button
            key={w.id}
            onClick={() => adopt(w)}
            disabled={adopting === w.url}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card border border-border hover:border-primary/40 text-xs text-foreground transition-colors disabled:opacity-50"
          >
            <Globe className="w-3 h-3 text-muted-foreground" />
            <span className="font-mono truncate max-w-[180px]">{w.url}</span>
            <Plus className="w-3 h-3 text-primary" />
          </button>
        ))}
      </div>
    </div>
  );
}
