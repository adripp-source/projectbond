import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Bot, Search, Play, Sparkles, ChevronRight, Copy, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Endpoint = {
  id: string;
  source_url: string;
  type: string;
  vendor: string | null;
  label: string;
  evidence: string | null;
  api_endpoint: string | null;
  detected_at: string;
  last_tested_at: string | null;
  status: string;
};

type FixSuggestion = {
  strategy: string;
  title: string;
  what_to_add: string;
  where_to_add?: string;
  expected_impact: string;
  priority: number;
};

type Test = {
  id: string;
  endpoint_id: string;
  prompt_limit: number;
  status: string;
  overall_score: number | null;
  consistency_score: number | null;
  hallucination_rate: number | null;
  refusal_quality: number | null;
  summary: string | null;
  fix_suggestions: FixSuggestion[] | null;
  improved_prompt: string | null;
  created_at: string;
};

const AITester = () => {
  const { user } = useAuth();
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [tests, setTests] = useState<Record<string, Test | null>>({});
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [runDialogEp, setRunDialogEp] = useState<Endpoint | null>(null);
  const [promptLimit, setPromptLimit] = useState(20);
  const [generateImproved, setGenerateImproved] = useState(false);
  const [running, setRunning] = useState(false);
  const [openTest, setOpenTest] = useState<Test | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: eps } = await supabase
      .from("ai_endpoints")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("detected_at", { ascending: false });
    setEndpoints((eps as Endpoint[]) || []);

    // Latest test per endpoint
    const ids = (eps || []).map((e: any) => e.id);
    if (ids.length) {
      const { data: ts } = await supabase
        .from("ai_tests")
        .select("*")
        .in("endpoint_id", ids)
        .eq("status", "completed")
        .order("created_at", { ascending: false });
      const byEp: Record<string, Test | null> = {};
      for (const t of ((ts as unknown as Test[]) || [])) {
        if (!byEp[t.endpoint_id]) byEp[t.endpoint_id] = t;
      }
      setTests(byEp);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const handleScan = async (url?: string) => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-tester-detect", {
        body: url ? { url } : {},
      });
      if (error) throw error;
      const found = data?.detected?.length ?? 0;
      toast.success(found ? `Found ${found} new AI input(s)` : "Scan complete — no new AI inputs detected");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Scan failed");
    } finally {
      setScanning(false);
    }
  };

  const handleRun = async () => {
    if (!runDialogEp) return;
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-tester-run", {
        body: {
          endpoint_id: runDialogEp.id,
          prompt_limit: promptLimit,
          generate_improved_prompt: generateImproved,
        },
      });
      if (error) throw error;
      toast.success("Test complete");
      setRunDialogEp(null);
      await load();
      // open the just-finished test
      if (data?.test_id) {
        const { data: t } = await supabase.from("ai_tests").select("*").eq("id", data.test_id).single();
        if (t) setOpenTest(t as unknown as Test);
      }
    } catch (e: any) {
      toast.error(e?.message || "Test failed");
    } finally {
      setRunning(false);
    }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const scoreColor = (s: number | null, invert = false) => {
    if (s === null) return "text-muted-foreground";
    const good = invert ? s <= 20 : s >= 75;
    const mid = invert ? s <= 50 : s >= 50;
    return good ? "text-green-400" : mid ? "text-yellow-400" : "text-red-400";
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Tester</h1>
            <p className="text-sm text-muted-foreground">Detect chatbots & AI inputs on your sites, stress-test them, and get prompt-level fix suggestions.</p>
          </div>
        </div>
      </header>

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Find AI inputs</h2>
            <p className="text-xs text-muted-foreground">We scan your websites for chat widgets, AI buttons, and AI input fields.</p>
          </div>
          <Button onClick={() => handleScan()} disabled={scanning} variant="default" size="sm">
            {scanning ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
            Scan my sites
          </Button>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="https://specific-page-to-scan.com"
            value={manualUrl}
            onChange={e => setManualUrl(e.target.value)}
            className="flex-1"
          />
          <Button
            variant="secondary"
            disabled={!manualUrl || scanning}
            onClick={() => { handleScan(manualUrl); setManualUrl(""); }}
          >
            Scan URL
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : endpoints.length === 0 ? (
        <Card className="p-12 text-center space-y-2">
          <Bot className="w-10 h-10 text-muted-foreground mx-auto opacity-50" />
          <p className="font-medium">No AI inputs detected yet</p>
          <p className="text-sm text-muted-foreground">Run a scan above. We auto-scan after login, but you can trigger it manually anytime.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Detected AI inputs ({endpoints.length})</h2>
          {endpoints.map(ep => {
            const t = tests[ep.id];
            return (
              <Card key={ep.id} className="p-5 hover:border-primary/30 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{ep.label}</span>
                      {ep.vendor && <Badge variant="secondary">{ep.vendor}</Badge>}
                      <Badge variant="outline" className="text-xs">{ep.type.replace('_', ' ')}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{ep.source_url}</p>
                    {t && (
                      <div className="flex gap-4 pt-2 text-xs">
                        <span>Overall <strong className={scoreColor(t.overall_score)}>{t.overall_score ?? '–'}</strong></span>
                        <span>Consistency <strong className={scoreColor(t.consistency_score)}>{t.consistency_score ?? '–'}</strong></span>
                        <span>Hallucination <strong className={scoreColor(t.hallucination_rate, true)}>{t.hallucination_rate ?? '–'}%</strong></span>
                        <span>Refusal <strong className={scoreColor(t.refusal_quality)}>{t.refusal_quality ?? '–'}</strong></span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <Button size="sm" variant="default" onClick={() => { setRunDialogEp(ep); setPromptLimit(20); setGenerateImproved(false); }}>
                      <Play className="w-3 h-3 mr-1.5" /> Test
                    </Button>
                    {t && (
                      <Button size="sm" variant="ghost" onClick={() => setOpenTest(t)}>
                        View report <ChevronRight className="w-3 h-3 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Run dialog: ask for limit */}
      <Dialog open={!!runDialogEp} onOpenChange={(v) => !v && setRunDialogEp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test {runDialogEp?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">How many test prompts?</label>
              <p className="text-xs text-muted-foreground mb-2">5 to 150. More = deeper test, longer wait.</p>
              <Input
                type="number"
                min={5}
                max={150}
                value={promptLimit}
                onChange={e => setPromptLimit(Number(e.target.value))}
              />
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={generateImproved}
                onChange={e => setGenerateImproved(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm">
                <strong>Also generate a ready-to-paste improved system prompt</strong>
                <span className="block text-xs text-muted-foreground">Adds ~10 seconds. We apply every Mutator suggestion in the best wording.</span>
              </span>
            </label>
            {!runDialogEp?.api_endpoint && (
              <div className="flex gap-2 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-xs">
                <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                <span>No direct API endpoint configured for this bot. We'll generate the test pack and prompt-fix suggestions; live execution requires you to expose an HTTP endpoint.</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRunDialogEp(null)} disabled={running}>Cancel</Button>
            <Button onClick={handleRun} disabled={running}>
              {running ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Running test…</> : <><Play className="w-4 h-4 mr-2" /> Run test</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report dialog */}
      <Dialog open={!!openTest} onOpenChange={(v) => !v && setOpenTest(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Test report</DialogTitle>
          </DialogHeader>
          {openTest && (
            <Tabs defaultValue="summary" className="w-full">
              <TabsList>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="fixes">Fix suggestions ({openTest.fix_suggestions?.length || 0})</TabsTrigger>
                {openTest.improved_prompt && <TabsTrigger value="prompt">Improved prompt</TabsTrigger>}
              </TabsList>
              <TabsContent value="summary" className="space-y-4 pt-4">
                <div className="grid grid-cols-4 gap-3">
                  <Card className="p-3"><p className="text-xs text-muted-foreground">Overall</p><p className={`text-2xl font-bold ${scoreColor(openTest.overall_score)}`}>{openTest.overall_score ?? '–'}</p></Card>
                  <Card className="p-3"><p className="text-xs text-muted-foreground">Consistency</p><p className={`text-2xl font-bold ${scoreColor(openTest.consistency_score)}`}>{openTest.consistency_score ?? '–'}</p></Card>
                  <Card className="p-3"><p className="text-xs text-muted-foreground">Hallucination</p><p className={`text-2xl font-bold ${scoreColor(openTest.hallucination_rate, true)}`}>{openTest.hallucination_rate ?? '–'}%</p></Card>
                  <Card className="p-3"><p className="text-xs text-muted-foreground">Refusal quality</p><p className={`text-2xl font-bold ${scoreColor(openTest.refusal_quality)}`}>{openTest.refusal_quality ?? '–'}</p></Card>
                </div>
                {openTest.summary && <p className="text-sm leading-relaxed">{openTest.summary}</p>}
              </TabsContent>
              <TabsContent value="fixes" className="space-y-3 pt-4">
                {(openTest.fix_suggestions || []).sort((a, b) => a.priority - b.priority).map((fix, i) => (
                  <Card key={i} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">#{fix.priority}</Badge>
                        <Badge variant="outline" className="text-xs">{fix.strategy}</Badge>
                        <span className="font-medium text-sm">{fix.title}</span>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => copy(fix.what_to_add, `fix-${i}`)}>
                        {copied === `fix-${i}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{fix.expected_impact}</p>
                    <pre className="text-xs bg-muted/50 p-3 rounded whitespace-pre-wrap font-mono">{fix.what_to_add}</pre>
                    {fix.where_to_add && <p className="text-[10px] text-muted-foreground">Where: {fix.where_to_add}</p>}
                  </Card>
                ))}
              </TabsContent>
              {openTest.improved_prompt && (
                <TabsContent value="prompt" className="space-y-3 pt-4">
                  <div className="flex justify-end">
                    <Button size="sm" variant="secondary" onClick={() => copy(openTest.improved_prompt || '', 'full')}>
                      {copied === 'full' ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                      Copy full prompt
                    </Button>
                  </div>
                  <pre className="text-xs bg-muted/50 p-4 rounded whitespace-pre-wrap font-mono leading-relaxed">{openTest.improved_prompt}</pre>
                </TabsContent>
              )}
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AITester;
