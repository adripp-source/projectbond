import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BookOpen, Sparkles, Loader2, Globe, Plus, FileCode, Layers,
  ListChecks, Lock, AlertTriangle, ChevronRight, Wand2, Trash2, ListPlus, Download,
} from "lucide-react";
import { useRef } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import AIChatBar from "@/components/AIChatBar";
import SuggestedWebsites from "@/components/SuggestedWebsites";
import SmartUrlError from "@/components/SmartUrlError";
import { isProbablyValidUrl, normalizeUrl } from "@/lib/urlSuggest";
import FixIntentDialog, { FixIntent } from "@/components/FixIntentDialog";

interface WebsiteRow { id: string; url: string; name: string | null; }

interface DocsResult {
  project_overview: string;
  tech_stack_guess: { name: string; why_we_think_so: string }[];
  architecture: string;
  key_pages: { path: string; purpose: string }[];
  local_setup: string[];
  env_vars_likely: string[];
  gotchas: string[];
  first_week_checklist: string[];
}

interface FeaturesResult {
  detected: { name: string; description: string; category: string; confidence: string }[];
  recommended: { name: string; why: string; impact: string }[];
  summary: string;
}

const TechDocs = () => {
  const { user } = useAuth();
  const [websites, setWebsites] = useState<WebsiteRow[]>([]);
  const [activeUrl, setActiveUrl] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<"docs" | "features">("docs");
  const [docs, setDocs] = useState<DocsResult | null>(null);
  const [features, setFeatures] = useState<FeaturesResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [intentOpen, setIntentOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<"docs" | "features" | null>(null);
  const [exporting, setExporting] = useState(false);
  const docsRef = useRef<HTMLDivElement>(null);

  const exportDocsPdf = async () => {
    if (!docsRef.current || !docs) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(docsRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#0a0a0a",
        logging: false,
      });
      const pdfWidth = 210;
      const pdfHeight = 297;
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      const pdf = new jsPDF("p", "mm", "a4");
      const imgData = canvas.toDataURL("image/png");
      let position = 0;
      let heightLeft = imgHeight;
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }
      const safeName = (activeUrl || "site").replace(/^https?:\/\//, "").replace(/[^a-z0-9]/gi, "-");
      pdf.save(`onboarding-${safeName}.pdf`);
      toast.success("PDF downloaded");
    } catch (e: any) {
      toast.error(e.message || "PDF export failed");
    } finally {
      setExporting(false);
    }
  };

  // Load websites
  useEffect(() => {
    if (!user) return;
    supabase.from("websites").select("id, url, name").eq("user_id", user.id).then(({ data }) => {
      if (data) {
        setWebsites(data);
        if (data.length > 0 && !activeUrl) setActiveUrl(data[0].url);
      }
    });
  }, [user]);

  // Fake-ish progress while AI runs (target ~40s)
  useEffect(() => {
    if (!generating) { setProgress(0); return; }
    let p = 0;
    const id = setInterval(() => {
      p += 100 / 40;
      setProgress(Math.min(p, 95));
    }, 1000);
    return () => clearInterval(id);
  }, [generating]);

  const addWebsite = async () => {
    if (!user) return;
    const trimmed = newUrl.trim();
    if (!trimmed) return;
    if (!isProbablyValidUrl(trimmed)) {
      setUrlError(trimmed);
      return;
    }
    setAdding(true);
    try {
      const url = normalizeUrl(trimmed);
      const { data, error } = await supabase.from("websites").insert({ user_id: user.id, url, section: "docs" }).select("id, url, name").single();
      if (error) throw error;
      if (data) { setWebsites(prev => [...prev, data]); setActiveUrl(data.url); setNewUrl(""); setUrlError(null); }
    } catch (e: any) { toast.error(e.message); } finally { setAdding(false); }
  };

  const removeWebsite = async (id: string) => {
    await supabase.from("websites").delete().eq("id", id);
    setWebsites(prev => prev.filter(w => w.id !== id));
  };

  const askIntent = (mode: "docs" | "features") => {
    if (!activeUrl) { toast.error("Add a website first"); return; }
    setPendingMode(mode);
    setIntentOpen(true);
  };

  const generate = async (intent: FixIntent) => {
    if (!pendingMode) return;
    setGenerating(true);
    setDocs(null);
    setFeatures(null);
    setTab(pendingMode);
    try {
      const { data, error } = await supabase.functions.invoke("generate-tech-docs", {
        body: { url: activeUrl, mode: pendingMode, login_notes: intent.custom },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (pendingMode === "docs") setDocs(data.data); else setFeatures(data.data);
      setProgress(100);
      toast.success(pendingMode === "docs" ? "Onboarding doc ready!" : "Feature scan complete!");
    } catch (e: any) { toast.error(e.message || "Generation failed"); } finally { setGenerating(false); setPendingMode(null); }
  };

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto w-full">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Tech Docs</h1>
            <p className="text-sm text-muted-foreground">Plug in your URL — get a dev onboarding guide & feature map in ~40s.</p>
          </div>
        </div>
      </motion.div>

      <SuggestedWebsites section="docs" onAdopted={(w) => { setWebsites(p => [...p, w]); setActiveUrl(w.url); }} />

      {/* Website manager */}
      <div className="bg-card border border-border rounded-lg p-4 mb-4 shadow-card">
        <h3 className="text-sm font-semibold text-foreground mb-3">Pick a site to document</h3>
        <div className="flex gap-2 mb-3">
          <Input placeholder="https://yourwebsite.com" value={newUrl}
            onChange={(e) => { setNewUrl(e.target.value); setUrlError(null); }}
            onKeyDown={e => e.key === "Enter" && addWebsite()}
            className="bg-secondary border-border text-foreground" />
          <Button onClick={addWebsite} disabled={adding || !newUrl.trim()} size="sm" className="bg-gradient-primary text-primary-foreground">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
        </div>

        {urlError && (
          <div className="mb-3">
            <SmartUrlError attemptedUrl={urlError} onPick={(u) => { setNewUrl(u); setUrlError(null); }} />
          </div>
        )}

        {websites.length > 0 && (
          <div className="space-y-1">
            {websites.map(w => (
              <button key={w.id}
                onClick={() => setActiveUrl(w.url)}
                className={`w-full flex items-center justify-between px-3 py-1.5 rounded text-sm transition-colors ${activeUrl === w.url ? "bg-primary/10 text-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                <span className="font-mono text-xs truncate">{w.url}</span>
                <Trash2 className="w-3.5 h-3.5 opacity-50 hover:opacity-100 hover:text-destructive" onClick={(e) => { e.stopPropagation(); removeWebsite(w.id); }} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Generation actions */}
      <div className="flex items-center gap-2 mb-4">
        <Button onClick={() => askIntent("docs")} disabled={generating || !activeUrl} className="bg-gradient-primary text-primary-foreground">
          {generating && pendingMode === null && tab === "docs" ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Wand2 className="w-4 h-4 mr-1.5" />}
          Generate onboarding doc
        </Button>
        <Button variant="outline" onClick={() => askIntent("features")} disabled={generating || !activeUrl} className="border-border text-foreground hover:bg-secondary">
          <ListPlus className="w-4 h-4 mr-1.5" />
          Generate feature map
        </Button>
        {docs && tab === "docs" && (
          <Button onClick={exportDocsPdf} disabled={exporting} variant="outline" className="border-border text-foreground hover:bg-secondary">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Download className="w-4 h-4 mr-1.5" />}
            Export PDF
          </Button>
        )}
        {generating && (
          <div className="flex items-center gap-2 ml-2">
            <div className="w-32 h-1.5 bg-secondary rounded-full overflow-hidden">
              <motion.div className="h-full bg-gradient-primary" animate={{ width: `${progress}%` }} transition={{ ease: "linear" }} />
            </div>
            <span className="text-xs text-muted-foreground font-mono">{Math.round(progress)}%</span>
          </div>
        )}
      </div>

      {/* Output tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="bg-secondary">
          <TabsTrigger value="docs" className="data-[state=active]:bg-card">Onboarding Doc</TabsTrigger>
          <TabsTrigger value="features" className="data-[state=active]:bg-card">Feature Map</TabsTrigger>
        </TabsList>

        <TabsContent value="docs" className="mt-4">
          {!docs && !generating && (
            <EmptyState icon={FileCode} title="No documentation yet" subtitle="Pick a website above and click Generate onboarding doc." />
          )}
          {docs && (
            <div className="space-y-4">
              <Section icon={Sparkles} title="Project Overview">
                <p className="text-sm text-foreground leading-relaxed">{docs.project_overview}</p>
              </Section>

              <Section icon={Layers} title="Likely Tech Stack">
                <div className="grid grid-cols-2 gap-2">
                  {docs.tech_stack_guess.map((t, i) => (
                    <div key={i} className="bg-secondary/40 border border-border rounded-md p-3">
                      <p className="text-sm font-semibold text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{t.why_we_think_so}</p>
                    </div>
                  ))}
                </div>
              </Section>

              <Section icon={Globe} title="Architecture">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{docs.architecture}</p>
              </Section>

              <Section icon={ChevronRight} title="Key Pages">
                <div className="space-y-1.5">
                  {docs.key_pages.map((p, i) => (
                    <div key={i} className="flex items-baseline gap-3 text-sm">
                      <span className="font-mono text-primary text-xs flex-shrink-0">{p.path}</span>
                      <span className="text-muted-foreground">{p.purpose}</span>
                    </div>
                  ))}
                </div>
              </Section>

              <Section icon={ListChecks} title="Local Setup">
                <ol className="space-y-1.5 list-decimal list-inside">
                  {docs.local_setup.map((s, i) => (
                    <li key={i} className="text-sm text-foreground">{s}</li>
                  ))}
                </ol>
              </Section>

              <Section icon={Lock} title="Likely Env Vars">
                <div className="flex flex-wrap gap-1.5">
                  {docs.env_vars_likely.map((v, i) => (
                    <code key={i} className="text-xs bg-secondary px-2 py-1 rounded font-mono text-foreground">{v}</code>
                  ))}
                </div>
              </Section>

              <Section icon={AlertTriangle} title="Gotchas">
                <ul className="space-y-1.5">
                  {docs.gotchas.map((g, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0 mt-0.5" />
                      <span>{g}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section icon={ListChecks} title="First Week Checklist">
                <ul className="space-y-1.5">
                  {docs.first_week_checklist.map((c, i) => (
                    <li key={i} className="text-sm text-foreground flex items-start gap-2">
                      <input type="checkbox" className="mt-0.5 accent-primary" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </Section>
            </div>
          )}
        </TabsContent>

        <TabsContent value="features" className="mt-4">
          {!features && !generating && (
            <EmptyState icon={ListPlus} title="No feature map yet" subtitle="Pick a website above and click Generate feature map." />
          )}
          {features && (
            <div className="space-y-4">
              <Section icon={Sparkles} title="Summary">
                <p className="text-sm text-foreground leading-relaxed">{features.summary}</p>
              </Section>

              <Section icon={ListChecks} title={`Detected Features (${features.detected.length})`}>
                <div className="grid grid-cols-2 gap-2">
                  {features.detected.map((f, i) => (
                    <div key={i} className="bg-secondary/40 border border-border rounded-md p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-foreground">{f.name}</p>
                        <Badge variant="outline" className="text-[9px] uppercase">{f.confidence}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{f.description}</p>
                      <Badge variant="secondary" className="text-[9px] mt-2 uppercase">{f.category}</Badge>
                    </div>
                  ))}
                </div>
              </Section>

              <Section icon={Sparkles} title="Recommended Additions">
                <div className="space-y-2">
                  {features.recommended.map((r, i) => (
                    <div key={i} className="bg-primary/5 border border-primary/20 rounded-md p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-foreground">{r.name}</p>
                        <Badge className={`text-[9px] uppercase ${r.impact === "high" ? "bg-destructive" : r.impact === "medium" ? "bg-warning" : "bg-secondary"}`}>{r.impact} impact</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{r.why}</p>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <FixIntentDialog
        open={intentOpen}
        onOpenChange={setIntentOpen}
        onConfirm={generate}
        title={pendingMode === "features" ? "How deep should the feature scan go?" : "How detailed should the doc be?"}
        description="Quick = bullet summary. Standard = balanced. Deep = thorough analysis. Custom = tell us exactly what you want."
      />

      <AIChatBar context="analysis" placeholder="Ask about the docs or features..." />
    </div>
  );
};

const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
  <div className="bg-card border border-border rounded-lg p-4 shadow-card">
    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-primary" /> {title}
    </h3>
    {children}
  </div>
);

const EmptyState = ({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) => (
  <div className="bg-card border border-border rounded-lg p-10 text-center shadow-card">
    <Icon className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
    <p className="text-sm font-medium text-foreground mb-1">{title}</p>
    <p className="text-xs text-muted-foreground">{subtitle}</p>
  </div>
);

export default TechDocs;
