import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, X, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

interface ChatMsg { role: "user" | "assistant"; content: string; }

interface AIChatBarProps {
  context: "home" | "actions" | "editor" | "flow" | "analysis" | "media" | "branding";
  placeholder?: string;
  suggestedQuestions?: string[];
  extraContext?: string;
}

const CONTEXT_LABELS: Record<string, string> = {
  home: "Growth Advisor",
  actions: "Issue Expert",
  editor: "UI Advisor",
  flow: "Flow Analyst",
  analysis: "QA Engineer",
  media: "Media Analyst",
  branding: "Brand Advisor",
};

const AIChatBar = ({ context, placeholder, suggestedQuestions, extraContext }: AIChatBarProps) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const defaultQuestions: Record<string, string[]> = {
    home: ["What should I focus on first?", "How can I improve my site?", "What's my biggest weakness?"],
    actions: ["What's the most critical bug?", "What should I fix first?", "How many issues are left?"],
    editor: ["What should I change here?", "Why is this section weak?", "How can I improve the layout?"],
    flow: ["Where are users dropping off?", "What's confusing in this flow?", "How can I simplify this?"],
    analysis: ["Is there a security problem?", "What's slowing my site down?", "How can I improve my score?"],
    media: ["What are people saying about us?", "How's our brand perception?", "What should we improve?"],
    branding: ["Is my branding consistent?", "How can I strengthen my brand?", "What's my tone?"],
  };

  const questions = suggestedQuestions || defaultQuestions[context] || [];

  const send = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg) return;
    setInput("");
    const newMsgs: ChatMsg[] = [...messages, { role: "user", content: msg }];
    setMessages(newMsgs);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("analysis-chat", {
        body: {
          question: msg,
          context_type: context,
          extra_context: extraContext || "",
          run_security_test: false,
        },
      });
      if (error) throw error;
      setMessages([...newMsgs, { role: "assistant", content: data?.answer || "I couldn't generate a response." }]);
    } catch (e: any) {
      setMessages([...newMsgs, { role: "assistant", content: `Error: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity">
        {open ? <X className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 z-50 w-96 h-[min(640px,calc(100vh-7rem))] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/50">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">{CONTEXT_LABELS[context] || "AI Assistant"}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center py-6">
                  <Bot className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">Ask me anything about your {context === "home" ? "website" : context}.</p>
                  <div className="space-y-1">
                    {questions.map(q => (
                      <button key={q} onClick={() => send(q)}
                        className="block w-full text-left text-xs text-primary hover:underline px-2 py-1">→ {q}</button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                    msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                  }`}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-secondary px-3 py-2 rounded-lg"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            <div className="border-t border-border p-3 flex gap-2">
              <Input value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                placeholder={placeholder || "Ask a question..."}
                className="bg-secondary border-border text-foreground text-sm" />
              <Button size="sm" onClick={() => send()} disabled={loading || !input.trim()}
                className="bg-gradient-primary text-primary-foreground">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIChatBar;
