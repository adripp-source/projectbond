import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  StickyNote, Square, Hand, MousePointer2, Plus, Minus, Maximize2,
  Trash2, X, Sparkles, Loader2, ArrowLeftRight, Layers, Frame, Wand2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type CanvasTool = "pan" | "select" | "note" | "frame";

interface FigmaNote {
  id: string;
  type: "note" | "frame";
  // Canvas-space coordinates (not viewport)
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: string;
  attachedTo?: string; // optional anchor description
}

interface Props {
  url: string;
  onClose: () => void;
}

const NOTE_COLORS = [
  "hsl(48, 95%, 65%)",   // yellow
  "hsl(142, 71%, 55%)",  // green
  "hsl(217, 91%, 65%)",  // blue
  "hsl(280, 70%, 65%)",  // purple
  "hsl(0, 72%, 65%)",    // red
];

export default function FigmaCanvas({ url, onClose }: Props) {
  const [tool, setTool] = useState<CanvasTool>("pan");
  const [zoom, setZoom] = useState(0.7);
  const [pan, setPan] = useState({ x: 100, y: 80 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, panX: 0, panY: 0 });
  const [notes, setNotes] = useState<FigmaNote[]>([]);
  const [draggingNote, setDraggingNote] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [colorIdx, setColorIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [showOutcome, setShowOutcome] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const FRAME_W = 1280;
  const FRAME_H = 800;

  // Convert mouse position to canvas coordinates
  const toCanvasCoords = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  };

  // Wheel = zoom (with cmd/ctrl) or pan
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!canvasRef.current?.contains(e.target as Node)) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const delta = -e.deltaY * 0.002;
      setZoom(z => Math.min(2.5, Math.max(0.15, z + delta)));
    } else {
      setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, []);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle click or pan tool starts canvas pan
    if (e.button === 1 || tool === "pan") {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y });
      return;
    }
    if (tool === "note" || tool === "frame") {
      const coords = toCanvasCoords(e.clientX, e.clientY);
      const color = NOTE_COLORS[colorIdx % NOTE_COLORS.length];
      setColorIdx(i => i + 1);
      const newNote: FigmaNote = {
        id: crypto.randomUUID(),
        type: tool,
        x: coords.x - 100,
        y: coords.y - 60,
        width: tool === "frame" ? 320 : 200,
        height: tool === "frame" ? 200 : 120,
        text: tool === "frame" ? "New idea frame" : "Add a note...",
        color,
      };
      setNotes(prev => [...prev, newNote]);
      setSelectedNote(newNote.id);
      setTool("select");
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: panStart.panX + (e.clientX - panStart.x),
        y: panStart.panY + (e.clientY - panStart.y),
      });
      return;
    }
    if (draggingNote) {
      const coords = toCanvasCoords(e.clientX, e.clientY);
      setNotes(prev => prev.map(n => n.id === draggingNote
        ? { ...n, x: coords.x - dragOffset.x, y: coords.y - dragOffset.y }
        : n
      ));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNote(null);
  };

  const startDragNote = (e: React.MouseEvent, note: FigmaNote) => {
    if (tool !== "select") return;
    e.stopPropagation();
    const coords = toCanvasCoords(e.clientX, e.clientY);
    setDraggingNote(note.id);
    setDragOffset({ x: coords.x - note.x, y: coords.y - note.y });
    setSelectedNote(note.id);
  };

  const updateNote = (id: string, text: string) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, text } : n));
  };

  const deleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
    if (selectedNote === id) setSelectedNote(null);
  };

  const fitToScreen = () => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scale = Math.min((rect.width - 80) / FRAME_W, (rect.height - 80) / FRAME_H);
    setZoom(scale);
    setPan({
      x: (rect.width - FRAME_W * scale) / 2,
      y: (rect.height - FRAME_H * scale) / 2,
    });
  };

  const generateOutcome = async () => {
    if (notes.length === 0) {
      toast.error("Add at least one note describing what you want changed");
      return;
    }
    setGenerating(true);
    try {
      const annotations = notes.map(n => ({
        id: n.id,
        type: n.type === "frame" ? "box" : "highlight",
        x: n.x, y: n.y, width: n.width, height: n.height,
        note: n.text,
        color: n.color,
        guessedElement: n.type === "frame" ? "Section" : "Annotation",
      }));
      const { data, error } = await supabase.functions.invoke("generate-editor-code", {
        body: { url, annotations, mode: "instructions" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setOutcome(data.output);
      setShowOutcome(true);
      toast.success("Outcome preview generated!");
    } catch (e: any) {
      toast.error(e.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const tools: { id: CanvasTool; icon: any; label: string; tip: string }[] = [
    { id: "pan", icon: Hand, label: "Pan", tip: "Drag the canvas (or hold space)" },
    { id: "select", icon: MousePointer2, label: "Select", tip: "Click and drag notes" },
    { id: "note", icon: StickyNote, label: "Note", tip: "Place a sticky note" },
    { id: "frame", icon: Frame, label: "Frame", tip: "Draw an idea frame" },
  ];

  const cursor = isPanning ? "grabbing" : tool === "pan" ? "grab" : tool === "note" || tool === "frame" ? "crosshair" : "default";

  return (
    <div className="absolute inset-0 bg-background flex flex-col z-30">
      {/* Top bar */}
      <div className="h-12 border-b border-border bg-card flex items-center px-4 gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Design Canvas</span>
          <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">Figma-style</span>
        </div>

        {/* Tools */}
        <div className="flex items-center gap-1 border border-border rounded-md p-1 ml-4">
          {tools.map(t => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              title={`${t.label} — ${t.tip}`}
              className={`p-1.5 rounded transition-colors ${
                tool === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <t.icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        <span className="text-xs text-muted-foreground hidden md:inline">
          {tools.find(t => t.id === tool)?.tip}
        </span>

        {/* Zoom */}
        <div className="ml-auto flex items-center gap-1 border border-border rounded-md p-1">
          <button onClick={() => setZoom(z => Math.max(0.15, z - 0.1))}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded">
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-foreground font-mono px-2 min-w-[3rem] text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2.5, z + 0.1))}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded">
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button onClick={fitToScreen} title="Fit to screen"
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <Button
          size="sm"
          onClick={generateOutcome}
          disabled={generating || notes.length === 0}
          className="bg-gradient-primary text-primary-foreground"
        >
          {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Wand2 className="w-3.5 h-3.5 mr-1.5" />}
          Preview Outcome
        </Button>

        <Button size="sm" variant="outline" onClick={onClose} className="border-border text-foreground hover:bg-secondary">
          <X className="w-3.5 h-3.5 mr-1" /> Exit canvas
        </Button>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden bg-[hsl(var(--secondary))]/40">
        {/* Dot grid background */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, hsl(var(--muted-foreground) / 0.25) 1px, transparent 1px)`,
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        />

        <div
          ref={canvasRef}
          className="absolute inset-0 select-none"
          style={{ cursor }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* The transform layer — everything in canvas-space lives here */}
          <div
            className="absolute origin-top-left"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
            }}
          >
            {/* Frame label */}
            <div
              className="absolute text-foreground font-medium flex items-center gap-2"
              style={{
                left: 0,
                top: -32 / zoom,
                fontSize: `${14 / zoom}px`,
                gap: `${8 / zoom}px`,
              }}
            >
              <Frame className="text-primary" style={{ width: 14 / zoom, height: 14 / zoom }} />
              <span className="font-mono truncate" style={{ maxWidth: FRAME_W }}>{url}</span>
            </div>

            {/* Website iframe as the main frame */}
            <div
              className="bg-white shadow-2xl rounded-md overflow-hidden border border-border"
              style={{
                width: FRAME_W,
                height: FRAME_H,
                pointerEvents: tool === "select" ? "auto" : "none",
              }}
            >
              <iframe
                src={url}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin"
                title="Website preview in canvas"
              />
            </div>

            {/* Notes / frames */}
            {notes.map(note => (
              <div
                key={note.id}
                className="absolute"
                style={{
                  left: note.x,
                  top: note.y,
                  width: note.width,
                  height: note.height,
                  cursor: tool === "select" ? (draggingNote === note.id ? "grabbing" : "grab") : "default",
                  pointerEvents: "auto",
                }}
                onMouseDown={(e) => startDragNote(e, note)}
                onClick={(e) => { e.stopPropagation(); setSelectedNote(note.id); }}
              >
                {note.type === "note" ? (
                  <div
                    className="w-full h-full p-3 rounded-md shadow-xl flex flex-col"
                    style={{
                      backgroundColor: note.color,
                      transform: "rotate(-1deg)",
                      boxShadow: selectedNote === note.id
                        ? `0 0 0 3px hsl(var(--primary)), 0 8px 24px rgba(0,0,0,0.25)`
                        : "0 8px 20px rgba(0,0,0,0.18)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <StickyNote className="w-3.5 h-3.5 text-black/60" />
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                        className="text-black/40 hover:text-black/80"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    {selectedNote === note.id ? (
                      <textarea
                        autoFocus
                        value={note.text}
                        onMouseDown={(e) => e.stopPropagation()}
                        onChange={(e) => updateNote(note.id, e.target.value)}
                        className="flex-1 w-full bg-transparent text-sm text-black resize-none outline-none placeholder:text-black/40"
                        placeholder="What should change?"
                      />
                    ) : (
                      <p className="flex-1 text-sm text-black whitespace-pre-wrap break-words">{note.text}</p>
                    )}
                  </div>
                ) : (
                  <div
                    className="w-full h-full rounded-md border-2"
                    style={{
                      borderColor: note.color,
                      backgroundColor: `${note.color}15`,
                      boxShadow: selectedNote === note.id ? `0 0 0 3px hsl(var(--primary))` : "none",
                    }}
                  >
                    <div
                      className="absolute -top-7 left-0 px-2 py-0.5 rounded-t text-xs font-semibold text-white whitespace-nowrap flex items-center gap-1"
                      style={{ backgroundColor: note.color }}
                    >
                      <Frame className="w-3 h-3" />
                      {selectedNote === note.id ? (
                        <input
                          autoFocus
                          value={note.text}
                          onMouseDown={(e) => e.stopPropagation()}
                          onChange={(e) => updateNote(note.id, e.target.value)}
                          className="bg-transparent outline-none w-40"
                        />
                      ) : (
                        <span>{note.text}</span>
                      )}
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                        className="ml-1 hover:opacity-80"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Empty hint */}
        {notes.length === 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg px-4 py-2 shadow-card pointer-events-none">
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              Drop sticky notes or frames on your website, then click <span className="text-foreground font-medium">Preview Outcome</span>.
            </p>
          </div>
        )}

        {/* Status bar */}
        <div className="absolute bottom-3 left-3 bg-card/90 backdrop-blur border border-border rounded-md px-2 py-1 text-[10px] text-muted-foreground font-mono">
          {notes.length} {notes.length === 1 ? "note" : "notes"} · zoom {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* Outcome preview drawer */}
      <AnimatePresence>
        {showOutcome && outcome && (
          <motion.div
            initial={{ x: 480, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 480, opacity: 0 }}
            className="absolute right-0 top-12 bottom-0 w-[480px] bg-card border-l border-border z-40 flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Outcome Preview</h3>
              </div>
              <button onClick={() => setShowOutcome(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">After applying your notes</div>
              <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed bg-secondary/40 p-3 rounded-md border border-border">
                {outcome}
              </pre>
            </div>
            <div className="p-3 border-t border-border">
              <Button
                size="sm"
                variant="outline"
                onClick={() => { navigator.clipboard.writeText(outcome); toast.success("Copied!"); }}
                className="w-full border-border text-foreground hover:bg-secondary"
              >
                Copy outcome
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
