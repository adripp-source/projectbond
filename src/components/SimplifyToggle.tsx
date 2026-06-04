import { Sparkles, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSimplify } from "@/contexts/SimplifyContext";

const SimplifyToggle = () => {
  const { enabled, setEnabled, resetAll } = useSimplify();
  return (
    <div className="flex items-center gap-1 rounded-md border border-border bg-card/80 backdrop-blur px-1 py-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant={enabled ? "default" : "ghost"}
            className="h-7 px-2 text-xs"
            onClick={() => setEnabled(!enabled)}
          >
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            Simplify {enabled ? "On" : "Off"}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[220px] text-xs">
          Double-click any text to make it simpler. Double-click again to switch back.
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={resetAll}>
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Restore original text</TooltipContent>
      </Tooltip>
    </div>
  );
};

export default SimplifyToggle;
