import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Shield, Globe, Lock, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  websiteId: string;
  websiteUrl: string;
  onComplete: () => void;
}

type Step = "login_check" | "auth_details" | "safety" | "preferences" | "done";

const focusOptions = [
  { id: "ux", label: "UX / Usability" },
  { id: "qa", label: "QA / Bugs" },
  { id: "performance", label: "Performance" },
  { id: "conversion", label: "Conversion" },
  { id: "seo", label: "SEO" },
  { id: "accessibility", label: "Accessibility" },
  { id: "security", label: "Security" },
];

const goalOptions = [
  { id: "growth", label: "Grow my audience" },
  { id: "fix_issues", label: "Fix existing issues" },
  { id: "optimization", label: "Optimize speed & UX" },
  { id: "learning", label: "Learn what's wrong" },
];

export default function WebsiteAuthFlowDialog({ open, onOpenChange, websiteId, websiteUrl, onComplete }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("login_check");
  const [requiresLogin, setRequiresLogin] = useState<boolean | null>(null);
  const [accountType, setAccountType] = useState("test");
  const [accessScope, setAccessScope] = useState("both");
  const [loginUrl, setLoginUrl] = useState("");
  const [safeMode, setSafeMode] = useState(true);
  const [allowForms, setAllowForms] = useState(false);
  const [blockDestructive, setBlockDestructive] = useState(true);
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [skillLevel, setSkillLevel] = useState("beginner");
  const [saving, setSaving] = useState(false);

  const toggleFocus = (id: string) => setFocusAreas(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  const toggleGoal = (id: string) => setGoals(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await supabase.from("website_credentials" as any).upsert({
        user_id: user.id,
        website_id: websiteId,
        requires_login: requiresLogin || false,
        account_type: accountType,
        access_scope: accessScope,
        login_url: loginUrl || null,
        safe_mode: safeMode,
        allow_form_submission: allowForms,
        block_destructive: blockDestructive,
        allow_test_actions: true,
      } as any, { onConflict: "website_id" });

      await supabase.from("scan_preferences" as any).upsert({
        user_id: user.id,
        website_id: websiteId,
        goals,
        focus_areas: focusAreas,
        skill_level: skillLevel,
        growth_mode: "guided",
      } as any, { onConflict: "website_id" });

      toast.success("Website configured!");
      onComplete();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        {step === "login_check" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <Lock className="w-5 h-5 text-primary" /> Does this website require login?
              </DialogTitle>
              <DialogDescription>
                We need to know if <span className="font-mono text-xs text-foreground">{websiteUrl}</span> requires authentication to fully test.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 mt-4">
              {[
                { val: true, label: "Yes, login is required", desc: "We'll ask about account type and safety rules" },
                { val: false, label: "No, it's fully public", desc: "We'll scan all public pages" },
              ].map(opt => (
                <button key={String(opt.val)} onClick={() => { setRequiresLogin(opt.val); setStep(opt.val ? "auth_details" : "preferences"); }}
                  className="w-full text-left p-4 rounded-lg border border-border hover:border-primary/50 transition-colors bg-secondary/30">
                  <p className="text-sm font-medium text-foreground">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </button>
              ))}
              <button onClick={() => { setRequiresLogin(null); setStep("preferences"); }}
                className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 transition-colors bg-secondary/30">
                <p className="text-sm text-muted-foreground">Not sure — skip for now</p>
              </button>
            </div>
          </>
        )}

        {step === "auth_details" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <Globe className="w-5 h-5 text-primary" /> Account & Access Details
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Account type</label>
                <div className="flex gap-2">
                  {["test", "live", "paid"].map(t => (
                    <button key={t} onClick={() => setAccountType(t)}
                      className={`px-3 py-1.5 rounded-md border text-sm capitalize transition-colors ${accountType === t ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">What should Bond test?</label>
                <div className="flex gap-2">
                  {[
                    { val: "public", label: "Public pages only" },
                    { val: "logged_in", label: "Logged-in experience" },
                    { val: "both", label: "Both" },
                  ].map(s => (
                    <button key={s.val} onClick={() => setAccessScope(s.val)}
                      className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${accessScope === s.val ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Login page URL (optional)</label>
                <Input value={loginUrl} onChange={e => setLoginUrl(e.target.value)} placeholder="https://example.com/login"
                  className="bg-secondary border-border text-foreground" />
              </div>
              {accountType === "paid" && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
                  <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-warning">Paid account detected. Safe mode will be enforced — no purchases, no data changes, no destructive actions.</p>
                </div>
              )}
              <Button onClick={() => setStep("safety")} className="w-full bg-gradient-primary text-primary-foreground">
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </>
        )}

        {step === "safety" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <Shield className="w-5 h-5 text-primary" /> Safety Configuration
              </DialogTitle>
              <DialogDescription>Control what Bond can do during testing</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Safe Testing Mode</p>
                  <p className="text-xs text-muted-foreground">No destructive actions, read-only</p>
                </div>
                <Switch checked={safeMode} onCheckedChange={setSafeMode} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Allow Form Submission</p>
                  <p className="text-xs text-muted-foreground">Test forms by submitting them</p>
                </div>
                <Switch checked={allowForms} onCheckedChange={setAllowForms} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-foreground">Block Destructive Actions</p>
                  <p className="text-xs text-muted-foreground">Prevent deletes, purchases, account changes</p>
                </div>
                <Switch checked={blockDestructive} onCheckedChange={setBlockDestructive} />
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <p className="text-xs font-medium text-foreground">Bond will never:</p>
                </div>
                <ul className="text-xs text-muted-foreground space-y-0.5 ml-6 list-disc">
                  <li>Make real purchases</li>
                  <li>Delete user data</li>
                  <li>Trigger real workflows</li>
                  <li>Break user progress</li>
                </ul>
              </div>
              <Button onClick={() => setStep("preferences")} className="w-full bg-gradient-primary text-primary-foreground">
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </>
        )}

        {step === "preferences" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                🎯 What do you want to improve?
              </DialogTitle>
              <DialogDescription>This helps us prioritize what matters most to you</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Focus areas (select all that apply)</label>
                <div className="flex flex-wrap gap-2">
                  {focusOptions.map(f => (
                    <button key={f.id} onClick={() => toggleFocus(f.id)}
                      className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${focusAreas.includes(f.id) ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Your goal</label>
                <div className="flex flex-wrap gap-2">
                  {goalOptions.map(g => (
                    <button key={g.id} onClick={() => toggleGoal(g.id)}
                      className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${goals.includes(g.id) ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}>
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Your skill level</label>
                <div className="flex gap-2">
                  {["beginner", "intermediate", "advanced"].map(s => (
                    <button key={s} onClick={() => setSkillLevel(s)}
                      className={`px-3 py-1.5 rounded-md border text-sm capitalize transition-colors ${skillLevel === s ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full bg-gradient-primary text-primary-foreground">
                {saving ? "Saving..." : "Start Analysis"} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
