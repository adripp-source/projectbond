import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Shield, Globe, Lock, AlertTriangle, CheckCircle2, ArrowRight,
  FlaskConical, Rocket, CreditCard, HelpCircle, ExternalLink, Info,
  User, KeyRound, Eye, EyeOff, ShieldCheck, Server
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import GithubRepoInput from "@/components/GithubRepoInput";
import TechnicalityMeter from "@/components/TechnicalityMeter";

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
  const [hasLocalCopy, setHasLocalCopy] = useState(false);
  const [localCopyUrl, setLocalCopyUrl] = useState("");
  const [githubRepoUrl, setGithubRepoUrl] = useState("");
  const [githubIsPublic, setGithubIsPublic] = useState(true);
  const [nonInvasiveOnly, setNonInvasiveOnly] = useState(true);
  const [loginType, setLoginType] = useState<"password" | "password_pin" | "twofa">("password");
  const [pinOr2fa, setPinOr2fa] = useState("");
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [skillLevel, setSkillLevel] = useState("beginner");
  const [technicality, setTechnicality] = useState<number>(3);
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
        setNonInvasiveOnly(c.non_invasive_only ?? true);
        setLoginType((c.login_type as any) || "password");
        setPinOr2fa(c.pin_or_2fa || "");
        // Local/staging copy is stored inside the free-form `notes` field as JSON
        try {
          const parsed = c.notes ? JSON.parse(c.notes) : null;
          if (parsed?.local_copy_url) {
            setHasLocalCopy(true);
            setLocalCopyUrl(parsed.local_copy_url);
          }
        } catch { /* notes was plain text — ignore */ }
      }
      // Per-website GitHub repo lives on the websites row
      const { data: site } = await supabase
        .from("websites" as any)
        .select("github_repo_url")
        .eq("id", websiteId)
        .maybeSingle();
      if (site && (site as any).github_repo_url) {
        setGithubRepoUrl((site as any).github_repo_url);
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
        allow_form_submission: allowForms && !nonInvasiveOnly,
        block_destructive: blockDestructive || nonInvasiveOnly,
        allow_test_actions: !nonInvasiveOnly,
        non_invasive_only: nonInvasiveOnly,
        login_type: requiresLogin ? loginType : "password",
        pin_or_2fa: requiresLogin && loginType !== "password" ? (pinOr2fa || null) : null,
        test_username: requiresLogin ? (testUsername || null) : null,
        test_password: requiresLogin ? (testPassword || null) : null,
        permission_granted: requiresLogin ? permissionGranted : false,
        permission_granted_at: requiresLogin && permissionGranted ? new Date().toISOString() : null,
        notes: hasLocalCopy && localCopyUrl
          ? JSON.stringify({ local_copy_url: localCopyUrl.trim() })
          : null,
      } as any, { onConflict: "website_id" });

      // Persist GitHub repo URL on the website row (so it's available everywhere)
      if (githubRepoUrl.trim()) {
        await supabase
          .from("websites" as any)
          .update({ github_repo_url: githubRepoUrl.trim() } as any)
          .eq("id", websiteId);
      }

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

              {/* Local / staging copy */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider flex items-center gap-1.5">
                  <Server className="w-3 h-3" /> Local or staging copy
                  <span className="text-[10px] font-normal normal-case text-muted-foreground/70">(strongly recommended)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setHasLocalCopy(v => !v)}
                  className={`w-full text-left p-3 rounded-lg border transition-all flex items-start gap-3 ${
                    hasLocalCopy ? "border-primary bg-primary/5" : "border-border bg-secondary/30 hover:border-primary/40"
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                    hasLocalCopy ? "bg-primary border-primary" : "border-border bg-background"
                  }`}>
                    {hasLocalCopy && <CheckCircle2 className="w-4 h-4 text-primary-foreground" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-foreground">
                      I have a local or staging copy Bond can test against
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      A non-production mirror of your site (e.g. <span className="font-mono text-foreground/80">staging.example.com</span> or <span className="font-mono text-foreground/80">http://localhost:3000</span>). Bond will prefer this URL for any action that could change data, so your real users are never affected.
                    </p>
                  </div>
                </button>
                {hasLocalCopy && (
                  <Input
                    value={localCopyUrl}
                    onChange={e => setLocalCopyUrl(e.target.value)}
                    placeholder="https://staging.example.com  or  http://localhost:3000"
                    className="mt-2 bg-secondary border-border text-foreground font-mono text-xs"
                  />
                )}
              </div>

              {/* Login credentials */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound className="w-3 h-3" /> Login credentials
                  <span className="text-[10px] font-normal normal-case text-muted-foreground/70">(test account only)</span>
                </label>
                <div className="space-y-2">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      value={testUsername}
                      onChange={e => setTestUsername(e.target.value)}
                      placeholder="Email or username Bond should sign in with"
                      autoComplete="off"
                      className="pl-9 bg-secondary border-border text-foreground text-xs"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={testPassword}
                      onChange={e => setTestPassword(e.target.value)}
                      placeholder="Password"
                      autoComplete="new-password"
                      className="pl-9 pr-9 bg-secondary border-border text-foreground text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-start gap-1.5 mt-2 px-1">
                  <Info className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Use a <span className="text-foreground/80 font-medium">dedicated test/sandbox account</span> — never your personal admin login. Bond uses these only to sign in and look around inside the logged-in area.
                  </p>
                </div>
              </div>

              {/* Login type — handles PIN / 2FA scenarios */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wider">
                  Login type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: "password" as const, label: "Password only", desc: "Just username + password" },
                    { val: "password_pin" as const, label: "Password + PIN", desc: "Asks for a PIN after login" },
                    { val: "twofa" as const, label: "2FA code", desc: "TOTP / SMS / authenticator app" },
                  ].map(t => (
                    <button
                      key={t.val}
                      type="button"
                      onClick={() => setLoginType(t.val)}
                      className={`p-2.5 rounded-md border text-left transition-colors ${
                        loginType === t.val ? "border-primary bg-primary/10" : "border-border bg-secondary/30 hover:border-primary/40"
                      }`}
                    >
                      <p className="text-xs font-medium text-foreground">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                    </button>
                  ))}
                </div>
                {loginType !== "password" && (
                  <div className="mt-2">
                    <Input
                      value={pinOr2fa}
                      onChange={e => setPinOr2fa(e.target.value)}
                      placeholder={loginType === "password_pin" ? "PIN (4–8 digits)" : "Recovery / backup code, or seed for TOTP"}
                      className="bg-secondary border-border text-foreground text-xs font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
                      {loginType === "password_pin"
                        ? "If your test account has a numeric PIN after the password screen, paste it here. Bond will type it when prompted."
                        : "Bond can use a backup code or TOTP seed to handle 2FA on the test account. If you'd rather approve in real time, leave blank — Bond will pause and ping you."}
                    </p>
                  </div>
                )}
              </div>

              {/* Non-invasive toggle */}
              <button
                type="button"
                onClick={() => setNonInvasiveOnly(v => !v)}
                className={`w-full text-left p-3 rounded-lg border transition-all flex items-start gap-3 ${
                  nonInvasiveOnly ? "border-primary bg-primary/5" : "border-border bg-secondary/30 hover:border-primary/40"
                }`}
              >
                <div className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                  nonInvasiveOnly ? "bg-primary border-primary" : "border-border bg-background"
                }`}>
                  {nonInvasiveOnly && <CheckCircle2 className="w-4 h-4 text-primary-foreground" />}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                    Non-invasive only — just look around, don't change anything
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    Bond will read pages, hover, and open menus to understand the site, but it will <span className="font-semibold text-foreground/90">never click buttons that modify state</span> (no submit, no save, no delete). Recommended when you can't isolate a test account.
                  </p>
                </div>
              </button>

              {/* Explicit permission grant */}
              <button
                type="button"
                onClick={() => setPermissionGranted(p => !p)}
                className={`w-full text-left p-3 rounded-lg border transition-all flex items-start gap-3 ${
                  permissionGranted ? "border-primary bg-primary/5" : "border-border bg-secondary/30 hover:border-primary/40"
                }`}
              >
                <div className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                  permissionGranted ? "bg-primary border-primary" : "border-border bg-background"
                }`}>
                  {permissionGranted && <CheckCircle2 className="w-4 h-4 text-primary-foreground" />}
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                    I authorize Bond to log in with these credentials and test inside this account
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    By checking this, you confirm you own (or are authorized to test) this site, and you give Bond permission to use the credentials above to sign in and inspect the logged-in area under the safety rules you'll set next.
                  </p>
                </div>
              </button>

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
                <Button
                  onClick={() => setStep("safety")}
                  disabled={!permissionGranted || !testUsername || !testPassword}
                  className="flex-1 bg-gradient-primary text-primary-foreground disabled:opacity-50"
                >
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
              {(!permissionGranted || !testUsername || !testPassword) && (
                <p className="text-[10px] text-muted-foreground text-center -mt-1">
                  Enter test credentials and grant permission to continue.
                </p>
              )}
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

              {/* GitHub repo (per-website) */}
              <GithubRepoInput
                value={githubRepoUrl}
                onChange={setGithubRepoUrl}
                isPublic={githubIsPublic}
                onIsPublicChange={setGithubIsPublic}
              />

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
              <TechnicalityMeter
                value={technicality}
                onChange={setTechnicality}
                label="Default technicality for this site"
                hint="We'll use this whenever Bond writes anything for this site. You can override it per generation."
              />
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
