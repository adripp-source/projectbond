import { motion } from "framer-motion";
import { Paintbrush, MousePointer2, Move, Type, Square, Code, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const tools = [
  { icon: MousePointer2, label: "Select" },
  { icon: Move, label: "Move" },
  { icon: Type, label: "Text" },
  { icon: Square, label: "Box" },
];

const VisualEditor = () => {
  const [activeUrl, setActiveUrl] = useState("https://example.com");
  const [activeTool, setActiveTool] = useState("Select");

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
            className="h-8 text-xs bg-secondary border-border text-foreground font-mono"
          />
        </div>

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

      {/* Canvas */}
      <div className="flex-1 bg-background relative flex items-center justify-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(220_13%_12%)_1px,transparent_1px)] bg-[length:20px_20px] opacity-50" />
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
              Load a website preview, click elements to select them, drag to reposition, and annotate changes. 
              Generate code diffs when you're done.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default VisualEditor;
