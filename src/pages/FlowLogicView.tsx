import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { GitBranch, Loader2, RefreshCw, ArrowRight, Bot, Globe, Code, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AIChatBar from "@/components/AIChatBar";

interface FlowNode {
  id: string;
  label: string;
  type: "page" | "action" | "api" | "decision" | "external";
  x: number;
  y: number;
}

interface FlowEdge {
  from: string;
  to: string;
  label?: string;
}

interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
  summary: string;
}

const NODE_COLORS: Record<string, string> = {
  page: "hsl(217, 91%, 60%)",
  action: "hsl(142, 71%, 45%)",
  api: "hsl(38, 92%, 50%)",
  decision: "hsl(280, 70%, 55%)",
  external: "hsl(0, 72%, 51%)",
};

const NODE_ICONS: Record<string, typeof Globe> = {
  page: Globe,
  action: ArrowRight,
  api: Code,
  decision: GitBranch,
  external: Workflow,
};

const FlowLogicView = () => {
  const { user } = useAuth();
  const [url, setUrl] = useState("");
  const [flowData, setFlowData] = useState<FlowData | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingNode, setEditingNode] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [command, setCommand] = useState("");
  const [commandResult, setCommandResult] = useState<string | null>(null);
  const [commandLoading, setCommandLoading] = useState(false);

  // Load saved URL
  useEffect(() => {
    if (!user) return;
    supabase.from("websites").select("url").eq("user_id", user.id).eq("section", "general")
      .order("created_at", { ascending: false }).limit(1).single()
      .then(({ data }) => { if (data) setUrl(data.url); });
  }, [user]);

  const generateFlow = async () => {
    if (!url.trim()) { toast.error("Enter a URL"); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-editor-code", {
        body: {
          url: url.trim(),
          annotations: [],
          mode: "flow",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Parse AI output into flow data
      try {
        const parsed = JSON.parse(data.output);
        setFlowData(parsed);
      } catch {
        // AI returned text — create a simple flow
        const lines = (data.output as string).split("\n").filter(Boolean).slice(0, 10);
        const nodes: FlowNode[] = lines.map((line, i) => ({
          id: `n${i}`,
          label: line.replace(/^[-•*\d.]+\s*/, "").trim(),
          type: i === 0 ? "page" : i === lines.length - 1 ? "external" : "action",
          x: 100 + (i % 3) * 280,
          y: 80 + Math.floor(i / 3) * 140,
        }));
        const edges: FlowEdge[] = nodes.slice(1).map((n, i) => ({ from: nodes[i].id, to: n.id }));
        setFlowData({ nodes, edges, summary: data.output.slice(0, 200) });
      }
      toast.success("Flow generated!");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate flow");
    } finally {
      setLoading(false);
    }
  };

  const handleNodeClick = (node: FlowNode) => {
    setEditingNode(node.id);
    setEditLabel(node.label);
  };

  const saveNodeEdit = () => {
    if (!editingNode || !flowData) return;
    setFlowData({
      ...flowData,
      nodes: flowData.nodes.map(n => n.id === editingNode ? { ...n, label: editLabel } : n),
    });
    setEditingNode(null);
  };

  const runCommand = async () => {
    if (!command.trim() || !flowData) return;
    setCommandLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-editor-code", {
        body: {
          url: url.trim(),
          annotations: [{ type: "text", text: command, note: `Current flow: ${JSON.stringify(flowData.nodes.map(n => n.label))}` }],
          mode: "instructions",
        },
      });
      if (error) throw error;
      setCommandResult(data?.output || "No result");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCommandLoading(false);
    }
  };

  const getEdgePath = (from: FlowNode, to: FlowNode) => {
    const x1 = from.x + 120;
    const y1 = from.y + 30;
    const x2 = to.x;
    const y2 = to.y + 30;
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Flow & Logic</span>
        </div>
        <div className="flex-1 max-w-sm flex gap-1 ml-4">
          <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://yourwebsite.com"
            className="h-8 text-xs bg-secondary border-border text-foreground font-mono" />
          <Button size="sm" onClick={generateFlow} disabled={loading || !url.trim()}
            className="h-8 bg-gradient-primary text-primary-foreground text-xs px-3">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
            Generate
          </Button>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-3 ml-auto">
          {Object.entries(NODE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-muted-foreground capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 relative overflow-auto bg-background">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--muted))_1px,transparent_1px)] bg-[length:20px_20px] opacity-20" />

          {flowData ? (
            <svg className="absolute inset-0 w-full h-full" style={{ minWidth: 1200, minHeight: 800 }}>
              {/* Edges */}
              {flowData.edges.map((edge, i) => {
                const from = flowData.nodes.find(n => n.id === edge.from);
                const to = flowData.nodes.find(n => n.id === edge.to);
                if (!from || !to) return null;
                return (
                  <g key={i}>
                    <path d={getEdgePath(from, to)} fill="none" stroke="hsl(215, 14%, 30%)" strokeWidth={2}
                      markerEnd="url(#arrow)" />
                    {edge.label && (
                      <text x={(from.x + to.x) / 2 + 60} y={(from.y + to.y) / 2 + 20}
                        fill="hsl(215, 14%, 50%)" fontSize={10} textAnchor="middle">{edge.label}</text>
                    )}
                  </g>
                );
              })}
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth={6} markerHeight={6} orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="hsl(215, 14%, 40%)" />
                </marker>
              </defs>
              {/* Nodes */}
              {flowData.nodes.map(node => {
                const Icon = NODE_ICONS[node.type] || Globe;
                const color = NODE_COLORS[node.type] || "hsl(215, 14%, 50%)";
                return (
                  <g key={node.id} onClick={() => handleNodeClick(node)} className="cursor-pointer">
                    <rect x={node.x} y={node.y} width={240} height={60} rx={8}
                      fill="hsl(220, 13%, 12%)" stroke={color} strokeWidth={editingNode === node.id ? 3 : 1.5} />
                    <circle cx={node.x + 20} cy={node.y + 30} r={10} fill={color} opacity={0.2} />
                    <text x={node.x + 40} y={node.y + 35} fill="hsl(210, 20%, 90%)" fontSize={12} fontWeight={500}>
                      {node.label.length > 30 ? node.label.slice(0, 30) + "…" : node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="flex items-center justify-center h-full">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-card border border-border rounded-lg p-10 text-center max-w-md relative z-10">
                <GitBranch className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Flow & Logic View</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Generate flow charts, system diagrams, and logic maps for any website. Edit nodes and connections visually.
                </p>
                <div className="flex gap-2 max-w-sm mx-auto">
                  <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://yoursite.com"
                    className="bg-secondary border-border text-foreground text-sm" />
                  <Button onClick={generateFlow} disabled={loading || !url.trim()}
                    className="bg-gradient-primary text-primary-foreground">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate"}
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </div>

        {/* Side panel */}
        {flowData && (
          <div className="w-80 border-l border-border bg-card flex flex-col flex-shrink-0">
            {/* Edit node */}
            {editingNode && (
              <div className="p-4 border-b border-border">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Edit Node</h4>
                <Input value={editLabel} onChange={e => setEditLabel(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && saveNodeEdit()}
                  className="bg-secondary border-border text-foreground text-sm mb-2" />
                <Button size="sm" onClick={saveNodeEdit} className="w-full bg-gradient-primary text-primary-foreground">
                  Save
                </Button>
              </div>
            )}

            {/* Summary */}
            {flowData.summary && (
              <div className="p-4 border-b border-border">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Summary</h4>
                <p className="text-xs text-secondary-foreground leading-relaxed">{flowData.summary}</p>
              </div>
            )}

            {/* Command input */}
            <div className="p-4 border-b border-border">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                <Bot className="w-3 h-3 inline mr-1" />AI Command
              </h4>
              <Textarea value={command} onChange={e => setCommand(e.target.value)}
                placeholder="e.g. Change the login flow to use SSO instead of email..."
                className="bg-secondary border-border text-foreground text-sm mb-2 min-h-[60px]" />
              <Button size="sm" onClick={runCommand} disabled={commandLoading || !command.trim()}
                className="w-full bg-gradient-primary text-primary-foreground">
                {commandLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Code className="w-3.5 h-3.5 mr-1" />}
                Run Command
              </Button>
            </div>

            {/* Command result */}
            {commandResult && (
              <div className="flex-1 overflow-y-auto p-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Result</h4>
                <pre className="text-xs text-secondary-foreground whitespace-pre-wrap font-mono leading-relaxed">
                  {commandResult}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
      <AIChatBar context="flow" placeholder="Ask about user flows..." />
    </div>
  );
};

export default FlowLogicView;
