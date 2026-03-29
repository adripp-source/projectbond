import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Paintbrush, MousePointer2, Move, Type, Square, Code, FileText, Plus, Loader2, Trash2, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const tools = [
  { icon: MousePointer2, label: "Select" },
  { icon: Move, label: "Move" },
  { icon: Type, label: "Text" },
  { icon: Square, label: "Box" },
];

interface WebsiteRow {
  id: string;
  url: string;
  name: string | null;
}

const VisualEditor = () => {
  const { user } = useAuth();
  const [activeUrl, setActiveUrl] = useState("");
  const [activeTool, setActiveTool] = useState("Select");
  const [websites, setWebsites] = useState<WebsiteRow[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [showManage, setShowManage] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("websites")
      .select("id, url, name")
      .eq("user_id", user.id)
      .eq("section", "editor")
      .then(({ data }) => {
        if (data) {
          setWebsites(data);
          if (data.length > 0 && !activeUrl) setActiveUrl(data[0].url);
        }
      });
  }, [user]);

  const addWebsite = async () => {
    if (!newUrl.trim() || !user) return;
    setAdding(true);
    try {
      const { data, error } = await supabase
        .from("websites")
        .insert({ user_id: user.id, url: newUrl.trim(), section: "editor" })
        .select("id, url, name")
        .single();
      if (error) throw error;
      if (data) {
        setWebsites(prev => [...prev, data]);
        setActiveUrl(data.url);
      }
      setNewUrl("");
      toast.success("Website added to editor");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAdding(false);
    }
  };

  const removeWebsite = async (id: string) => {
    await supabase.from("websites").delete().eq("id", id);
    setWebsites(prev => prev.filter(w => w.id !== id));
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="h-14 border-b border-border bg-card flex items-center px-4 gap-3"
      >
        <div className="flex items-center gap-2 mr-4">
          <Paintbrush className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Visual Editor</span>
        </div>

        <div className="flex items-center gap-1 border border-border rounded-md p-1">
          {tools.map((tool) => (
            <button
              key={tool.label}
              onClick={() => setActiveTool(tool.label)}
              className={`p-1.5 rounded transition-colors ${
                activeTool === tool.label
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
              title={tool.label}
            >
              <tool.icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        <div className="flex-1 max-w-md">
          <Input
            value={activeUrl}
            onChange={(e) => setActiveUrl(e.target.value)}
            placeholder="Enter URL to preview..."
            className="h-8 text-xs bg-secondary border-border text-foreground font-mono"
          />
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowManage(!showManage)}
          className="border-border text-foreground hover:bg-secondary"
        >
          <Globe className="w-3.5 h-3.5 mr-1.5" />
          Sites
        </Button>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="border-border text-foreground hover:bg-secondary">
            <Code className="w-3.5 h-3.5 mr-1.5" />
            Generate Code
          </Button>
          <Button size="sm" variant="outline" className="border-border text-foreground hover:bg-secondary">
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Instructions
          </Button>
        </div>
      </motion.div>

      <div className="flex-1 flex">
        {/* Site manager sidebar */}
        {showManage && (
          <div className="w-64 border-r border-border bg-card p-4 overflow-y-auto">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Editor Websites
            </h3>
            <div className="flex gap-2 mb-3">
              <Input
                placeholder="https://..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="h-8 text-xs bg-secondary border-border text-foreground"
              />
              <Button
                size="sm"
                onClick={addWebsite}
                disabled={adding || !newUrl.trim()}
                className="bg-gradient-primary text-primary-foreground h-8 w-8 p-0"
              >
                {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <div className="space-y-1">
              {websites.map((w) => (
                <div
                  key={w.id}
                  className={`flex items-center justify-between px-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                    activeUrl === w.url ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-secondary"
                  }`}
                  onClick={() => setActiveUrl(w.url)}
                >
                  <span className="truncate font-mono">{w.url}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeWebsite(w.id); }}
                    className="text-muted-foreground hover:text-destructive ml-1"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Canvas */}
        <div className="flex-1 bg-background relative flex items-center justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(220_13%_12%)_1px,transparent_1px)] bg-[length:20px_20px] opacity-50" />
          {activeUrl ? (
            <motion.div
              key={activeUrl}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative bg-card border border-border rounded-lg shadow-card w-[90%] h-[85%] overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-8 bg-secondary border-b border-border flex items-center px-3 gap-1.5 z-10">
                <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-warning/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-success/60" />
                <span className="text-[10px] text-muted-foreground font-mono ml-2 truncate">{activeUrl}</span>
              </div>
              <iframe
                src={activeUrl}
                className="w-full h-full pt-8 border-0"
                sandbox="allow-scripts allow-same-origin"
                title="Website Preview"
              />
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative bg-card border border-border rounded-lg shadow-card w-[800px] h-[500px] flex items-center justify-center"
            >
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mx-auto mb-4">
                  <Paintbrush className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-medium text-foreground mb-1">Visual Simulation Layer</h3>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Add a website URL above or from the Sites panel. Click elements to select, drag to reposition, and annotate changes.
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VisualEditor;
