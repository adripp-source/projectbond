import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Shield, Globe, Lock, AlertTriangle, CheckCircle2, ArrowRight,
  FlaskConical, Rocket, CreditCard, HelpCircle, ExternalLink, Info
} from "lucide-react";
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

const accountTypes = [
  {
    id: "test",
    label: "Test account",
    icon: FlaskConical,
    short: "Safe — fake/sandbox account",
    long: "A throwaway account made just for testing. Bond can click around freely without affecting real customers, real billing, or real data. This is the safest choice.",
    color: "text-success",
    bg: "bg-success/10 border-success/30",
  },
  {
    id: "live",
    label: "Live account",
    icon: Rocket,
    short: "Real account on a live site (no payment)",
    long: "A real account on your real production website, but with no paid subscription attached. Bond will avoid anything that could change your data or notify other users. Safe Mode stays on.",
    color: "text-warning",
    bg: "bg-warning/10 border-warning/30",
  },
  {
    id: "paid",
    label: "Paid account",
    icon: CreditCard,
    short: "Real account with active billing/membership",
    long: "A real account that has an active paid plan, subscription, or saved payment method. Bond will refuse all purchase actions, plan changes, and billing-related buttons no matter what other settings say.",
    color: "text-destructive",
    bg: "bg-destructive/10 border-destructive/30",
  },
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
  const [testUsername, setTestUsername] = useState("");
  const [testPassword, setTestPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [skillLevel, setSkillLevel] = useState("beginner");
  const [saving, setSaving] = useState(false);

  // Pre-fill an intelligent guess for the login URL from the site URL
  useEffect(() => {
    if (!websiteUrl || loginUrl) return;
    try {
      const u = new URL(websiteUrl);
      setLoginUrl(`${u.origin}/login`);
    } catch {/* ignore */}
  }, [websiteUrl]);

  // Load existing config so the dialog reflects what was saved before
  useEffect(() => {
    if (!open || !user || !websiteId) return;
    (async () => {
      const { data: cred } = await supabase
        .from("website_credentials" as any)
        .select("*")
        .eq("website_id", websiteId)
        .maybeSingle();
      if (cred) {
        const c = cred as any;
        setRequiresLogin(c.requires_login);
        setAccountType(c.account_type || "test");
        setAccessScope(c.access_scope || "both");
        setLoginUrl(c.login_url || loginUrl);
        setSafeMode(c.safe_mode ?? true);
        setAllowForms(c.allow_form_submission ?? false);
        setBlockDestructive(c.block_destructive ?? true);
        setTestUsername(c.test_username || "");
        setTestPassword(c.test_password || "");
        setPermissionGranted(c.permission_granted ?? false);
      }
      const { data: pref } = await supabase
        .from("scan_preferences" as any)
        .select("*")
        .eq("website_id", websiteId)
        .maybeSingle();
      if (pref) {
        const p = pref as any;
        setFocusAreas(p.focus_areas || []);
        setGoals(p.goals || []);
        setSkillLevel(p.skill_level || "beginner");
      }
    })();
  }, [open, user, websiteId]);

  const toggleFocus = (id: string) =>
    setFocusAreas(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  const toggleGoal = (id: string) =>
    setGoals(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);

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
        test_username: requiresLogin ? (testUsername || null) : null,
        test_password: requiresLogin ? (testPassword || null) : null,
        permission_granted: requiresLogin ? permissionGranted : false,
        permission_granted_at: requiresLogin && permissionGranted ? new Date().toISOString() : null,
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
      // Reset for next open
      setStep("login_check");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const stepNumber = { login_check: 1, auth_details: 2, safety: 3, preferences: 4, done: 4 }[step];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-1">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className={`h-1 flex-1 rounded-full transition-colors ${
              n <= stepNumber ? "bg-primary" : "bg-secondary"
            }`} />
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">Step {stepNumber} of 4</p>

        {step === "login_check" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <Lock className="w-5 h-5 text-primary" /> Does this site need a login?
              </DialogTitle>
              <DialogDescription>
                Bond is about to start testing <span className="font-mono text-xs text-foreground break-all">{websiteUrl}</span>.
                Some pages may be hidden behind a login screen.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 mt-4">
              {[
                {
                  val: true,
                  icon: Lock,
                  label: "Yes — users must log in",
                  desc: "Dashboards, accounts, member areas, paywalls, etc. We'll ask a few quick safety questions.",
                },
                {
                  val: false,
                  icon: Globe,
                  label: "No — fully public",
                  desc: "Anyone can see every page (marketing site, blog, docs). We'll scan the whole site.",
                },
              ].map(opt => (
                <button
                  key={String(opt.val)}
                  onClick={() => { setRequiresLogin(opt.val); setStep(opt.val ? "auth_details" : "preferences"); }}
                  className="w-full text-left p-4 rounded-lg border border-border hover:border-primary/60 transition-colors bg-secondary/30 group"
                >
                  <div className="flex items-start gap-3">
                    <opt.icon className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{opt.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
              <button
                onClick={() => { setRequiresLogin(null); setStep("preferences"); }}
                className="w-full text-left p-3 rounded-lg border border-dashed border-border hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Not sure — skip for now (we'll only test public pages)</p>
                </div>
              </button>
            </div>
          </>
        )}

        {step === "auth_details" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <Globe className="w-5 h-5 text-primary" /> What kind of account will Bond use?
              </DialogTitle>
              <DialogDescription>
                This decides how careful Bond is when clicking buttons inside the logged-in area.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {/* Account type — full cards with explanations */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-2 block uppercase tracking-wider">Account type</label>
                <div className="space-y-2">
                  {accountTypes.map(t => {
                    const selected = accountType === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setAccountType(t.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          selected ? "border-primary bg-primary/5 shadow-card" : "border-border bg-secondary/30 hover:border-primary/40"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${selected ? "bg-primary/15" : "bg-secondary"}`}>
                            <t.icon className={`w-4 h-4 ${selected ? "text-primary" : t.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm font-medium text-foreground">{t.label}</p>
                              {selected && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                            </div>
                            <p className="text-[11px] text-muted-foreground">{t.short}</p>
                            {selected && (
                              <p className="text-xs text-foreground/80 mt-2 leading-relaxed">{t.long}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Access scope */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-2 block uppercase tracking-wider">Where should Bond test?</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: "public", label: "Public only", desc: "Logged-out pages" },
                    { val: "logged_in", label: "Logged-in only", desc: "After login" },
                    { val: "both", label: "Both", desc: "Full coverage" },
                  ].map(s => (
                    <button
                      key={s.val}
                      onClick={() => setAccessScope(s.val)}
                      className={`p-2.5 rounded-md border text-left transition-colors ${
                        accessScope === s.val ? "border-primary bg-primary/10" : "border-border bg-secondary/30 hover:border-primary/40"
                      }`}
                    >
                      <p className="text-xs font-medium text-foreground">{s.label}</p>
                      <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Login URL with explanation */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider flex items-center gap-1.5">
                  <ExternalLink className="w-3 h-3" /> Login page URL
                  <span className="text-[10px] font-normal normal-case text-muted-foreground/70">(optional)</span>
                </label>
                <Input
                  value={loginUrl}
                  onChange={e => setLoginUrl(e.target.value)}
                  placeholder="https://example.com/login"
                  className="bg-secondary border-border text-foreground font-mono text-xs"
                />
                <div className="flex items-start gap-1.5 mt-2 px-1">
                  <Info className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    The exact page where users sign in (e.g. <span className="font-mono text-foreground/80">/login</span>, <span className="font-mono text-foreground/80">/signin</span>, or <span className="font-mono text-foreground/80">/account</span>). This helps Bond skip past the login screen when it scans member-only pages. Leave blank if your site uses a popup or you're unsure.
                  </p>
                </div>
              </div>

              {accountType === "paid" && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/30">
                  <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-foreground leading-relaxed">
                    <span className="font-semibold text-destructive">Heads up:</span> Because this account has billing attached, Bond will hard-block any purchase, plan change, or cancellation buttons even if you turn other safety toggles off later.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("login_check")} className="border-border">
                  Back
                </Button>
                <Button onClick={() => setStep("safety")} className="flex-1 bg-gradient-primary text-primary-foreground">
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </>
        )}

        {step === "safety" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <Shield className="w-5 h-5 text-primary" /> Safety rules
              </DialogTitle>
              <DialogDescription>What is Bond allowed to do while testing?</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-4">
              {[
                {
                  label: "Safe Testing Mode",
                  desc: "Master switch — Bond only reads the page and never changes anything. Recommended.",
                  state: safeMode, set: setSafeMode,
                },
                {
                  label: "Allow form submission",
                  desc: "Let Bond actually submit forms (newsletter, contact, search). OFF means it will only fill them in to check validation.",
                  state: allowForms, set: setAllowForms,
                },
                {
                  label: "Block destructive actions",
                  desc: "Never click Delete, Cancel subscription, Remove account, etc. Strongly recommended ON.",
                  state: blockDestructive, set: setBlockDestructive,
                },
              ].map(t => (
                <div key={t.label} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
                  <div className="flex-1">
                    <p className="text-sm text-foreground font-medium">{t.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{t.desc}</p>
                  </div>
                  <Switch checked={t.state} onCheckedChange={t.set} />
                </div>
              ))}
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-1.5">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <p className="text-xs font-semibold text-foreground">Bond will never (no matter what):</p>
                </div>
                <ul className="text-xs text-muted-foreground space-y-0.5 ml-6 list-disc">
                  <li>Make real purchases or trigger payments</li>
                  <li>Delete user data or accounts</li>
                  <li>Send emails or notifications to other people</li>
                  <li>Break user progress in active sessions</li>
                </ul>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("auth_details")} className="border-border">Back</Button>
                <Button onClick={() => setStep("preferences")} className="flex-1 bg-gradient-primary text-primary-foreground">
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </>
        )}

        {step === "preferences" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                🎯 What do you want to improve?
              </DialogTitle>
              <DialogDescription>This helps us prioritize the issues that matter most to you.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-2 block uppercase tracking-wider">Focus areas (select any)</label>
                <div className="flex flex-wrap gap-2">
                  {focusOptions.map(f => (
                    <button
                      key={f.id} onClick={() => toggleFocus(f.id)}
                      className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${
                        focusAreas.includes(f.id) ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-2 block uppercase tracking-wider">Your goal</label>
                <div className="flex flex-wrap gap-2">
                  {goalOptions.map(g => (
                    <button
                      key={g.id} onClick={() => toggleGoal(g.id)}
                      className={`px-3 py-1.5 rounded-full border text-xs transition-colors ${
                        goals.includes(g.id) ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-2 block uppercase tracking-wider">Your skill level</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "beginner", desc: "Plain English, no jargon" },
                    { id: "intermediate", desc: "Some technical detail" },
                    { id: "advanced", desc: "Deep technical fixes" },
                  ].map(s => (
                    <button
                      key={s.id} onClick={() => setSkillLevel(s.id)}
                      className={`p-2.5 rounded-md border text-left transition-colors ${
                        skillLevel === s.id ? "border-primary bg-primary/10" : "border-border bg-secondary/30 hover:border-primary/40"
                      }`}
                    >
                      <p className="text-xs font-medium text-foreground capitalize">{s.id}</p>
                      <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(requiresLogin ? "safety" : "login_check")} className="border-border">Back</Button>
                <Button onClick={handleSave} disabled={saving} className="flex-1 bg-gradient-primary text-primary-foreground">
                  {saving ? "Saving..." : "Finish & start analysis"} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
