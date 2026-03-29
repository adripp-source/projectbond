import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Paintbrush, MousePointer2, Type, Square, Code, FileText,
  Plus, Loader2, Trash2, Globe, X, MessageSquare, Undo2, Download,
  Hand, Crosshair, PlusCircle, Highlighter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type ToolType = "browse" | "select" | "highlight" | "text" | "box";

const toolConfig: { icon: any; label: string; tool: ToolType; tip: string }[] = [
  { icon: Hand, label: "Browse", tool: "browse", tip: "Interact with the page normally" },
  { icon: Crosshair, label: "Smart Select", tool: "select", tip: "Click to auto-detect a section" },
  { icon: Highlighter, label: "Highlight", tool: "highlight", tip: "Draw to highlight an area" },
  { icon: Type, label: "Text", tool: "text", tip: "Click to place a text note" },
  { icon: Square, label: "Box", tool: "box", tip: "Draw a new section box" },
];

interface Annotation {
  id: string;
  type: "select" | "text" | "box" | "highlight";
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  note?: string;
  color: string;
  guessedElement?: string;
}

interface WebsiteRow {
  id: string;
  url: string;
  name: string | null;
}

interface ContextMenu {
  x: number;
  y: number;
  canvasX: number;
  canvasY: number;
}

const COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(0, 72%, 51%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 70%, 55%)",
];

// Common page section sizes for smart-select guessing
const SECTION_GUESSES = [
  { name: "Navigation Bar", y: [0, 80], height: 70 },
  { name: "Hero Section", y: [50, 600], height: 500 },
  { name: "Content Section", y: [400, 1200], height: 400 },
  { name: "Sidebar", x: [0, 300], width: 280 },
  { name: "Footer", y: [600, 5000], height: 200 },
  { name: "CTA Button Area", y: [200, 800], height: 100 },
  { name: "Form Section", y: [200, 1500], height: 300 },
  { name: "Card/Feature Block", y: [300, 1500], height: 250 },
];

function guessSection(clickY: number, clickX: number, containerW: number, containerH: number) {
  const relY = clickY;
  const relX = clickX;

  // Top area = nav
  if (relY < 80) return { name: "Navigation Bar", x: 0, y: 0, w: containerW, h: 70 };
  // Bottom area = footer
  if (relY > containerH - 200) return { name: "Footer", x: 0, y: containerH - 180, w: containerW, h: 180 };
  // Left edge = sidebar
  if (relX < 300 && containerW > 800) return { name: "Sidebar", x: 0, y: 70, w: 280, h: containerH - 250 };
  // Top-center = hero
  if (relY < 500) return { name: "Hero Section", x: 40, y: 70, w: containerW - 80, h: 420 };
  // Mid page = content
  return { name: "Content Section", x: 40, y: Math.max(relY - 150, 70), w: containerW - 80, h: 350 };
}

const VisualEditor = () => {
  const { user } = useAuth();
  const [activeUrl, setActiveUrl] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [activeTool, setActiveTool] = useState<ToolType>("browse");
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
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const colorIndex = useRef(0);

  const overlayActive = activeTool !== "browse";

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
      setContextMenu(null);
    }
  };

  const getNextColor = () => {
    const c = COLORS[colorIndex.current % COLORS.length];
    colorIndex.current++;
    return c;
  };

  const addAnnotation = (ann: Annotation) => {
    setAnnotations(prev => [...prev, ann]);
    setSelectedAnnotation(ann.id);
    setEditingNote(ann.note || "");
    setEditingText(ann.text || "");
    setContextMenu(null);
  };

  // Smart Select click — guess the section
  const handleSmartClick = (clickX: number, clickY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const guess = guessSection(clickY, clickX, rect.width, rect.height);
    const color = getNextColor();
    addAnnotation({
      id: crypto.randomUUID(),
      type: "select",
      x: guess.x,
      y: guess.y,
      width: guess.w,
      height: guess.h,
      note: "",
      color,
      guessedElement: guess.name,
    });
    toast.success(`Auto-detected: ${guess.name}`, { description: "Add a note describing what to change" });
  };

  // Context menu quick actions
  const handleContextAction = (action: string) => {
    if (!contextMenu) return;
    const color = getNextColor();
    const rect = canvasRef.current?.getBoundingClientRect();
    const cw = rect?.width || 800;

    switch (action) {
      case "add_box":
        addAnnotation({
          id: crypto.randomUUID(), type: "box",
          x: contextMenu.canvasX - 100, y: contextMenu.canvasY - 60,
          width: 200, height: 120, note: "New section", color,
        });
        break;
      case "add_text":
        addAnnotation({
          id: crypto.randomUUID(), type: "text",
          x: contextMenu.canvasX - 80, y: contextMenu.canvasY - 20,
          width: 200, height: 40, text: "Edit this text", color,
        });
        break;
      case "highlight":
        addAnnotation({
          id: crypto.randomUUID(), type: "highlight",
          x: contextMenu.canvasX - 80, y: contextMenu.canvasY - 30,
          width: 160, height: 60, note: "Change this", color,
        });
        break;
      case "smart_select":
        handleSmartClick(contextMenu.canvasX, contextMenu.canvasY);
        break;
    }
    setContextMenu(null);
  };

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (!overlayActive) return;
    setContextMenu(null);

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeTool === "select") {
      handleSmartClick(x, y);
      return;
    }

    if (activeTool === "text") {
      addAnnotation({
        id: crypto.randomUUID(), type: "text",
        x, y, width: 200, height: 40,
        text: "Edit this text", color: getNextColor(),
      });
      return;
    }

    // highlight or box → draw
    setIsDrawing(true);
    setDrawStart({ x, y });
    setCurrentDraw({ x, y, w: 0, h: 0 });
  }, [activeTool, overlayActive]);

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
      addAnnotation({
        id: crypto.randomUUID(),
        type: activeTool === "box" ? "box" : "highlight",
        x: currentDraw.x, y: currentDraw.y,
        width: currentDraw.w, height: currentDraw.h,
        note: "", color: getNextColor(),
      });
    }
    setIsDrawing(false);
    setDrawStart(null);
    setCurrentDraw(null);
  }, [isDrawing, currentDraw, activeTool]);

  const handleRightClick = useCallback((e: React.MouseEvent) => {
    if (!overlayActive) return;
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setContextMenu({
      x: e.clientX, y: e.clientY,
      canvasX: e.clientX - rect.left,
      canvasY: e.clientY - rect.top,
    });
  }, [overlayActive]);

  // Close context menu on click outside
  useEffect(() => {
    const close = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener("click", close, { once: true });
      return () => window.removeEventListener("click", close);
    }
  }, [contextMenu]);

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
  const cursorMap: Record<ToolType, string> = {
    browse: "default",
    select: "pointer",
    highlight: "crosshair",
    text: "text",
    box: "crosshair",
  };

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
              key={tool.tool}
              onClick={() => { setActiveTool(tool.tool); setContextMenu(null); }}
              className={`p-1.5 rounded transition-colors ${
                activeTool === tool.tool
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
              title={`${tool.label} — ${tool.tip}`}
            >
              <tool.icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* Active tool label */}
        <span className="text-xs text-muted-foreground hidden sm:inline">
          {toolConfig.find(t => t.tool === activeTool)?.tip}
        </span>

        <div className="flex-1 max-w-sm flex gap-1 ml-auto">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadUrl()}
            placeholder="Enter URL..."
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

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{annotations.length}</span>
          <Button
            size="sm" variant="outline"
            onClick={() => generateCode("code")}
            disabled={generating || annotations.length === 0}
            className="border-border text-foreground hover:bg-secondary"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Code className="w-3.5 h-3.5 mr-1" />}
            Code
          </Button>
          <Button
            size="sm" variant="outline"
            onClick={() => generateCode("instructions")}
            disabled={generating || annotations.length === 0}
            className="border-border text-foreground hover:bg-secondary"
          >
            <FileText className="w-3.5 h-3.5 mr-1" />
            Steps
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
                  size="sm" onClick={addWebsite}
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
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                <span className="text-[10px] text-muted-foreground font-mono ml-2 truncate">{activeUrl}</span>
                {overlayActive && (
                  <span className="ml-auto text-[10px] text-primary font-medium animate-pulse">
                    ● Editing mode — right-click for quick actions
                  </span>
                )}
              </div>

              {/* iframe */}
              <iframe
                src={activeUrl}
                className="w-full h-full pt-8 border-0"
                sandbox="allow-scripts allow-same-origin"
                title="Website Preview"
                style={{ pointerEvents: overlayActive ? "none" : "auto" }}
              />

              {/* Annotation overlay — only visible when a tool is active */}
              {overlayActive && (
                <div
                  ref={canvasRef}
                  className="absolute inset-0 mt-8 z-10"
                  style={{ cursor: cursorMap[activeTool] }}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={() => { if (isDrawing) handleCanvasMouseUp(); }}
                  onContextMenu={handleRightClick}
                >
                  {/* Drawing preview */}
                  {isDrawing && currentDraw && currentDraw.w > 2 && (
                    <div
                      className="absolute border-2 border-dashed rounded pointer-events-none"
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
                      className="absolute rounded cursor-pointer transition-all"
                      style={{
                        left: ann.x, top: ann.y,
                        width: ann.width, height: ann.height,
                        border: `2px solid ${ann.color}`,
                        backgroundColor: ann.type === "highlight"
                          ? `${ann.color}25`
                          : `${ann.color}10`,
                        boxShadow: selectedAnnotation === ann.id
                          ? `0 0 0 3px ${ann.color}, 0 4px 20px ${ann.color}30`
                          : undefined,
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
                        className="absolute -top-6 left-0 px-2 py-0.5 rounded-t text-[10px] font-semibold text-white whitespace-nowrap flex items-center gap-1"
                        style={{ backgroundColor: ann.color }}
                      >
                        {ann.type === "box" && <Square className="w-2.5 h-2.5" />}
                        {ann.type === "highlight" && <Highlighter className="w-2.5 h-2.5" />}
                        {ann.type === "text" && <Type className="w-2.5 h-2.5" />}
                        {ann.type === "select" && <Crosshair className="w-2.5 h-2.5" />}
                        {ann.guessedElement || (ann.type === "box" ? "Section" : ann.type === "text" ? "Text" : ann.type === "highlight" ? "Highlight" : "Selection")}
                        {ann.note && ` · ${ann.note.substring(0, 15)}…`}
                      </div>

                      {ann.type === "text" && (
                        <div className="w-full h-full flex items-center justify-center p-1">
                          <span className="text-xs font-medium" style={{ color: ann.color }}>
                            {ann.text || "Text"}
                          </span>
                        </div>
                      )}

                      {/* Delete */}
                      <button
                        onClick={(e) => { e.stopPropagation(); removeAnnotation(ann.id); }}
                        className="absolute -top-6 -right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center hover:bg-destructive/80 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Annotations list (visible even in browse mode) */}
              {!overlayActive && annotations.length > 0 && (
                <div className="absolute inset-0 mt-8 z-10 pointer-events-none">
                  {annotations.map((ann) => (
                    <div
                      key={ann.id}
                      className="absolute rounded pointer-events-none"
                      style={{
                        left: ann.x, top: ann.y,
                        width: ann.width, height: ann.height,
                        border: `2px solid ${ann.color}50`,
                        backgroundColor: `${ann.color}08`,
                      }}
                    >
                      <div
                        className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[9px] font-semibold text-white/70 whitespace-nowrap"
                        style={{ backgroundColor: `${ann.color}80` }}
                      >
                        {ann.guessedElement || ann.type}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-background">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--muted))_1px,transparent_1px)] bg-[length:20px_20px] opacity-30" />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative bg-card border border-border rounded-lg w-[500px] p-10 text-center"
              >
                <div className="w-14 h-14 rounded-xl bg-secondary flex items-center justify-center mx-auto mb-5">
                  <Paintbrush className="w-7 h-7 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Visual Editor</h3>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                  Load a website, then use the toolbar to annotate changes.<br />
                  <strong>Smart Select</strong> auto-detects sections. <strong>Right-click</strong> for quick actions.
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
                  {selectedAnn.guessedElement || "Annotation"}
                </h3>
                <button onClick={() => setSelectedAnnotation(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedAnn.color }} />
                  <span className="text-sm text-foreground capitalize">{selectedAnn.type}</span>
                  <span className="text-xs text-muted-foreground font-mono ml-auto">
                    {Math.round(selectedAnn.width)}×{Math.round(selectedAnn.height)}
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
                    <MessageSquare className="w-3 h-3" /> What should change?
                  </label>
                  <Textarea
                    value={editingNote}
                    onChange={(e) => {
                      setEditingNote(e.target.value);
                      updateAnnotationNote(selectedAnn.id, e.target.value);
                    }}
                    placeholder="e.g. Make the font bigger, change color to blue, add a CTA button..."
                    className="bg-secondary border-border text-foreground text-sm min-h-[80px]"
                  />
                </div>

                <Button
                  size="sm" variant="outline"
                  onClick={() => removeAnnotation(selectedAnn.id)}
                  className="w-full border-destructive text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Remove
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
                  <Button size="sm" variant="ghost" onClick={() => {
                    navigator.clipboard.writeText(generatedOutput);
                    toast.success("Copied!");
                  }}>
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

      {/* Context menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.1 }}
            className="fixed z-50 bg-card border border-border rounded-lg shadow-lg py-1 min-w-[180px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary flex items-center gap-2 transition-colors"
              onClick={() => handleContextAction("smart_select")}
            >
              <Crosshair className="w-4 h-4 text-primary" />
              Auto-detect section
            </button>
            <button
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary flex items-center gap-2 transition-colors"
              onClick={() => handleContextAction("add_box")}
            >
              <Square className="w-4 h-4 text-blue-400" />
              Add a box here
            </button>
            <button
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary flex items-center gap-2 transition-colors"
              onClick={() => handleContextAction("add_text")}
            >
              <Type className="w-4 h-4 text-green-400" />
              Add text here
            </button>
            <button
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary flex items-center gap-2 transition-colors"
              onClick={() => handleContextAction("highlight")}
            >
              <Highlighter className="w-4 h-4 text-yellow-400" />
              Highlight this area
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VisualEditor;
