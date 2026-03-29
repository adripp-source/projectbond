import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Paintbrush, MousePointer2, Move, Type, Square, Code, FileText,
  Plus, Loader2, Trash2, Globe, X, MessageSquare, Undo2, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const toolConfig = [
  { icon: MousePointer2, label: "Select", cursor: "crosshair" },
  { icon: Type, label: "Text", cursor: "text" },
  { icon: Square, label: "Box", cursor: "crosshair" },
];

interface Annotation {
  id: string;
  type: "select" | "text" | "box";
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  note?: string;
  color: string;
}

interface WebsiteRow {
  id: string;
  url: string;
  name: string | null;
}

const COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(0, 72%, 51%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 70%, 55%)",
];

const VisualEditor = () => {
  const { user } = useAuth();
  const [activeUrl, setActiveUrl] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [activeTool, setActiveTool] = useState("Select");
  const [websites, setWebsites] = useState<WebsiteRow[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDraw, setCurrentDraw] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState("");
  const [editingText, setEditingText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedOutput, setGeneratedOutput] = useState<string | null>(null);
  const [showOutput, setShowOutput] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const colorIndex = useRef(0);

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
          if (data.length > 0 && !activeUrl) {
            setActiveUrl(data[0].url);
            setUrlInput(data[0].url);
          }
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
        setUrlInput(data.url);
      }
      setNewUrl("");
      toast.success("Website added");
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

  const loadUrl = () => {
    if (urlInput.trim()) {
      setActiveUrl(urlInput.trim());
      setAnnotations([]);
      setGeneratedOutput(null);
    }
  };

  const getNextColor = () => {
    const c = COLORS[colorIndex.current % COLORS.length];
    colorIndex.current++;
    return c;
  };

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (activeTool === "Select" || activeTool === "Box") {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setIsDrawing(true);
      setDrawStart({ x, y });
      setCurrentDraw({ x, y, w: 0, h: 0 });
    } else if (activeTool === "Text") {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const newAnn: Annotation = {
        id: crypto.randomUUID(),
        type: "text",
        x, y,
        width: 200, height: 40,
        text: "Edit this text",
        color: getNextColor(),
      };
      setAnnotations(prev => [...prev, newAnn]);
      setSelectedAnnotation(newAnn.id);
      setEditingText("Edit this text");
    }
  }, [activeTool]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !drawStart) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCurrentDraw({
      x: Math.min(drawStart.x, x),
      y: Math.min(drawStart.y, y),
      w: Math.abs(x - drawStart.x),
      h: Math.abs(y - drawStart.y),
    });
  }, [isDrawing, drawStart]);

  const handleCanvasMouseUp = useCallback(() => {
    if (!isDrawing || !currentDraw) {
      setIsDrawing(false);
      return;
    }
    if (currentDraw.w > 10 && currentDraw.h > 10) {
      const newAnn: Annotation = {
        id: crypto.randomUUID(),
        type: activeTool === "Box" ? "box" : "select",
        x: currentDraw.x,
        y: currentDraw.y,
        width: currentDraw.w,
        height: currentDraw.h,
        note: "",
        color: getNextColor(),
      };
      setAnnotations(prev => [...prev, newAnn]);
      setSelectedAnnotation(newAnn.id);
      setEditingNote("");
    }
    setIsDrawing(false);
    setDrawStart(null);
    setCurrentDraw(null);
  }, [isDrawing, currentDraw, activeTool]);

  const updateAnnotationNote = (id: string, note: string) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, note } : a));
  };

  const updateAnnotationText = (id: string, text: string) => {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, text } : a));
  };

  const removeAnnotation = (id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
    if (selectedAnnotation === id) setSelectedAnnotation(null);
  };

  const undoLast = () => {
    setAnnotations(prev => prev.slice(0, -1));
    setSelectedAnnotation(null);
  };

  const generateCode = async (mode: "code" | "instructions") => {
    if (annotations.length === 0) {
      toast.error("Add some annotations first");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-editor-code", {
        body: { url: activeUrl, annotations, mode },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setGeneratedOutput(data.output);
      setShowOutput(true);
      toast.success(mode === "code" ? "Code generated!" : "Instructions generated!");
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const selectedAnn = annotations.find(a => a.id === selectedAnnotation);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 flex-shrink-0"
      >
        <div className="flex items-center gap-2 mr-3">
          <Paintbrush className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Visual Editor</span>
        </div>

        <div className="flex items-center gap-1 border border-border rounded-md p-1">
          {toolConfig.map((tool) => (
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

        <div className="flex-1 max-w-md flex gap-1">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadUrl()}
            placeholder="Enter URL to preview..."
            className="h-8 text-xs bg-secondary border-border text-foreground font-mono"
          />
          <Button size="sm" onClick={loadUrl} className="h-8 bg-gradient-primary text-primary-foreground text-xs px-3">
            Load
          </Button>
        </div>

        <Button size="sm" variant="outline" onClick={() => setShowManage(!showManage)} className="border-border text-foreground hover:bg-secondary">
          <Globe className="w-3.5 h-3.5 mr-1.5" />
          Sites
        </Button>

        {annotations.length > 0 && (
          <Button size="sm" variant="outline" onClick={undoLast} className="border-border text-foreground hover:bg-secondary">
            <Undo2 className="w-3.5 h-3.5" />
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{annotations.length} annotation{annotations.length !== 1 ? "s" : ""}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => generateCode("code")}
            disabled={generating || annotations.length === 0}
            className="border-border text-foreground hover:bg-secondary"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Code className="w-3.5 h-3.5 mr-1.5" />}
            Generate Code
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => generateCode("instructions")}
            disabled={generating || annotations.length === 0}
            className="border-border text-foreground hover:bg-secondary"
          >
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Instructions
          </Button>
        </div>
      </motion.div>

      <div className="flex-1 flex overflow-hidden">
        {/* Site manager sidebar */}
        <AnimatePresence>
          {showManage && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 256, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-r border-border bg-card p-4 overflow-y-auto flex-shrink-0"
            >
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
                    onClick={() => { setActiveUrl(w.url); setUrlInput(w.url); setAnnotations([]); }}
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
                {websites.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No saved websites yet</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Canvas area */}
        <div className="flex-1 relative overflow-hidden">
          {activeUrl ? (
            <div className="w-full h-full relative">
              {/* Browser chrome */}
              <div className="absolute top-0 left-0 right-0 h-8 bg-secondary border-b border-border flex items-center px-3 gap-1.5 z-20">
                <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-warning/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-success/60" />
                <span className="text-[10px] text-muted-foreground font-mono ml-2 truncate">{activeUrl}</span>
              </div>

              {/* iframe */}
              <iframe
                src={activeUrl}
                className="w-full h-full pt-8 border-0"
                sandbox="allow-scripts allow-same-origin"
                title="Website Preview"
                style={{ pointerEvents: activeTool !== "Select" && activeTool !== "Box" && activeTool !== "Text" ? "auto" : "none" }}
              />

              {/* Annotation overlay */}
              <div
                ref={canvasRef}
                className="absolute inset-0 mt-8 z-10"
                style={{ cursor: activeTool === "Text" ? "text" : "crosshair" }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
              >
                {/* Current drawing */}
                {isDrawing && currentDraw && currentDraw.w > 2 && (
                  <div
                    className="absolute border-2 border-dashed rounded"
                    style={{
                      left: currentDraw.x, top: currentDraw.y,
                      width: currentDraw.w, height: currentDraw.h,
                      borderColor: COLORS[colorIndex.current % COLORS.length],
                      backgroundColor: `${COLORS[colorIndex.current % COLORS.length]}15`,
                    }}
                  />
                )}

                {/* Rendered annotations */}
                {annotations.map((ann) => (
                  <div
                    key={ann.id}
                    className={`absolute rounded cursor-pointer transition-shadow`}
                    style={{
                      left: ann.x, top: ann.y,
                      width: ann.width, height: ann.height,
                      border: `2px solid ${ann.color}`,
                      backgroundColor: `${ann.color}15`,
                      boxShadow: selectedAnnotation === ann.id ? `0 0 0 2px ${ann.color}` : undefined,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAnnotation(ann.id);
                      setEditingNote(ann.note || "");
                      setEditingText(ann.text || "");
                    }}
                  >
                    {/* Label badge */}
                    <div
                      className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[9px] font-bold text-white whitespace-nowrap"
                      style={{ backgroundColor: ann.color }}
                    >
                      {ann.type === "box" ? "Section" : ann.type === "text" ? "Text" : "Selection"}
                      {ann.note && ` · ${ann.note.substring(0, 20)}`}
                    </div>

                    {ann.type === "text" && (
                      <div className="w-full h-full flex items-center justify-center p-1">
                        <span className="text-xs font-medium" style={{ color: ann.color }}>
                          {ann.text || "Text"}
                        </span>
                      </div>
                    )}

                    {/* Delete button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeAnnotation(ann.id); }}
                      className="absolute -top-5 -right-1 w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/80"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-background">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(220_13%_12%)_1px,transparent_1px)] bg-[length:20px_20px] opacity-50" />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative bg-card border border-border rounded-lg shadow-card w-[500px] p-10 text-center"
              >
                <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center mx-auto mb-5">
                  <Paintbrush className="w-7 h-7 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Visual Editor</h3>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                  Enter a website URL above to load a live preview. Draw selections, add text annotations, and mark areas for changes. Then generate code or step-by-step instructions powered by AI.
                </p>
                <div className="flex gap-2 max-w-sm mx-auto">
                  <Input
                    placeholder="https://yourwebsite.com"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadUrl()}
                    className="bg-secondary border-border text-foreground text-sm"
                  />
                  <Button onClick={loadUrl} disabled={!urlInput.trim()} className="bg-gradient-primary text-primary-foreground">
                    Load
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </div>

        {/* Annotation properties panel */}
        <AnimatePresence>
          {selectedAnn && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-border bg-card p-4 overflow-y-auto flex-shrink-0"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Annotation
                </h3>
                <button onClick={() => setSelectedAnnotation(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                  <span className="text-sm text-foreground capitalize">{selectedAnn.type}</span>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Position</label>
                  <span className="text-xs text-foreground font-mono">
                    {Math.round(selectedAnn.x)}, {Math.round(selectedAnn.y)} · {Math.round(selectedAnn.width)}×{Math.round(selectedAnn.height)}
                  </span>
                </div>

                {selectedAnn.type === "text" && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Text Content</label>
                    <Input
                      value={editingText}
                      onChange={(e) => {
                        setEditingText(e.target.value);
                        updateAnnotationText(selectedAnn.id, e.target.value);
                      }}
                      className="bg-secondary border-border text-foreground text-sm"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Change Note
                  </label>
                  <Textarea
                    value={editingNote}
                    onChange={(e) => {
                      setEditingNote(e.target.value);
                      updateAnnotationNote(selectedAnn.id, e.target.value);
                    }}
                    placeholder="Describe what you want to change here..."
                    className="bg-secondary border-border text-foreground text-sm min-h-[80px]"
                  />
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => removeAnnotation(selectedAnn.id)}
                  className="w-full border-destructive text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Remove Annotation
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Generated output panel */}
        <AnimatePresence>
          {showOutput && generatedOutput && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 400, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-border bg-card flex flex-col flex-shrink-0"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Generated Output</h3>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedOutput);
                      toast.success("Copied to clipboard");
                    }}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                  <button onClick={() => setShowOutput(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <pre className="text-xs text-secondary-foreground whitespace-pre-wrap font-mono leading-relaxed">
                  {generatedOutput}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default VisualEditor;
