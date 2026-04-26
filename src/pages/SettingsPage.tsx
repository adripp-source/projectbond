import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, User, Bell, Shield, Globe, Save, Loader2, Code, Users, Blocks, ShieldCheck, Briefcase } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import TechnicalityMeter from "@/components/TechnicalityMeter";

const userTypeLabels: Record<string, { label: string; icon: any }> = {
  dev_team: { label: "I have a dev team", icon: Users },
  developer: { label: "I code myself", icon: Code },
  nocode: { label: "I use no-code tools", icon: Blocks },
};

const TEAM_SIZES = [
  { v: "solo", label: "Just me" },
  { v: "small", label: "2–10" },
  { v: "mid", label: "11–50" },
  { v: "large", label: "50+" },
];
const CODE_SKILLS = [
  { v: "none", label: "I don't code" },
  { v: "some", label: "A little" },
  { v: "lots", label: "Confident" },
];

const RESTART_WORD = "RESTART";

const SettingsPage = () => {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [userType, setUserType] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [enrollingMfa, setEnrollingMfa] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [showRestart, setShowRestart] = useState(false);
  const [restartWord, setRestartWord] = useState("");
  const [restartPassword, setRestartPassword] = useState("");
  const [restarting, setRestarting] = useState(false);

  const handleRestartAccount = async () => {
    if (restartWord !== RESTART_WORD) {
      toast.error(`Please type "${RESTART_WORD}" exactly to confirm`);
      return;
    }
    if (!user) return;

    setRestarting(true);
    try {
      // Delete user data
      await Promise.all([
        supabase.from("scan_issues").delete().eq("user_id", user.id),
        supabase.from("scans").delete().eq("user_id", user.id),
        supabase.from("websites").delete().eq("user_id", user.id),
        supabase.from("branding").delete().eq("user_id", user.id),
      ]);

      // Reset profile
      await supabase
        .from("profiles")
        .update({ onboarding_completed: false, display_name: null, user_type: null, workspace_id: null } as any)
        .eq("user_id", user.id);

      toast.success("Account reset! Redirecting to onboarding...");
      setShowRestart(false);
      setRestartWord("");
      setRestartPassword("");
      window.location.href = "/onboarding";
    } catch (e: any) {
      toast.error(e.message || "Reset failed");
    } finally {
      setRestarting(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    setEmail(user.email || "");

    Promise.all([
      supabase.from("profiles").select("display_name, user_type").eq("user_id", user.id).maybeSingle(),
      supabase.auth.mfa.listFactors(),
    ]).then(([profileRes, mfaRes]) => {
      if (profileRes.data) {
        setDisplayName((profileRes.data as any).display_name || "");
        setUserType((profileRes.data as any).user_type || "");
      }
      if (mfaRes.data) {
        const verified = mfaRes.data.totp.filter((f: any) => f.status === "verified");
        setMfaEnabled(verified.length > 0);
        if (verified.length > 0) setMfaFactorId(verified[0].id);
      }
      setLoading(false);
    });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await supabase
        .from("profiles")
        .update({ display_name: displayName.trim(), user_type: userType } as any)
        .eq("user_id", user.id);
      toast.success("Settings saved!");
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleEnrollMfa = async () => {
    setEnrollingMfa(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator App",
      });
      if (error) throw error;
      if (data) {
        setQrCode(data.totp.qr_code);
        setMfaFactorId(data.id);
      }
    } catch (e: any) {
      toast.error(e.message || "MFA enrollment failed");
      setEnrollingMfa(false);
    }
  };

  const handleVerifyMfa = async () => {
    if (!mfaFactorId || !verifyCode) return;
    try {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (challengeErr) throw challengeErr;

      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: challenge.id,
        code: verifyCode,
      });
      if (verifyErr) throw verifyErr;

      setMfaEnabled(true);
      setQrCode(null);
      setEnrollingMfa(false);
      setVerifyCode("");
      toast.success("2FA enabled successfully!");
    } catch (e: any) {
      toast.error(e.message || "Verification failed");
    }
  };

  const handleUnenrollMfa = async () => {
    if (!mfaFactorId) return;
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId });
      if (error) throw error;
      setMfaEnabled(false);
      setMfaFactorId(null);
      toast.success("2FA disabled");
    } catch (e: any) {
      toast.error(e.message || "Failed to disable 2FA");
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-[1200px] mx-auto w-full">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Settings className="w-4 h-4 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Settings</h1>
        </div>
      </motion.div>

      <div className="space-y-6">
        {/* Profile */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Profile</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 max-w-lg">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Name</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-secondary border-border text-foreground"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email</label>
              <Input
                value={email}
                disabled
                className="bg-secondary border-border text-foreground opacity-60"
              />
            </div>
          </div>
        </div>

        {/* User Type Preference */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Build Preference</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            This affects how fixes and instructions are generated throughout the app.
          </p>
          <div className="flex gap-2">
            {Object.entries(userTypeLabels).map(([key, { label, icon: Icon }]) => (
              <button
                key={key}
                onClick={() => setUserType(key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                  userType === key
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 2FA / MFA */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Two-Factor Authentication (2FA)</h3>
          </div>

          {mfaEnabled ? (
            <div className="flex items-center justify-between max-w-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-sm text-foreground">2FA is enabled</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleUnenrollMfa}
                className="border-destructive text-destructive hover:bg-destructive/10"
              >
                Disable 2FA
              </Button>
            </div>
          ) : qrCode ? (
            <div className="max-w-sm">
              <p className="text-sm text-muted-foreground mb-3">
                Scan this QR code with your authenticator app, then enter the 6-digit code:
              </p>
              <div className="bg-white rounded-lg p-4 mb-4 w-fit">
                <img src={qrCode} alt="MFA QR Code" className="w-48 h-48" />
              </div>
              <div className="flex gap-2">
                <Input
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className="bg-secondary border-border text-foreground max-w-[180px] font-mono"
                />
                <Button
                  onClick={handleVerifyMfa}
                  disabled={verifyCode.length !== 6}
                  className="bg-gradient-primary text-primary-foreground"
                >
                  Verify
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between max-w-lg">
              <div>
                <p className="text-sm text-foreground">Authenticator App (TOTP)</p>
                <p className="text-xs text-muted-foreground">Secure your account with a 6-digit code</p>
              </div>
              <Button
                size="sm"
                onClick={handleEnrollMfa}
                disabled={enrollingMfa}
                className="bg-gradient-primary text-primary-foreground"
              >
                {enrollingMfa ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enable 2FA"}
              </Button>
            </div>
          )}
        </div>

        {/* Scan Settings */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Scan Configuration</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between max-w-lg">
              <div>
                <p className="text-sm text-foreground">Auto QA Scans</p>
                <p className="text-xs text-muted-foreground">Run 2–5 scans automatically per day</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between max-w-lg">
              <div>
                <p className="text-sm text-foreground">Security Scans</p>
                <p className="text-xs text-muted-foreground">OWASP-based safe security testing</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between max-w-lg">
              <div>
                <p className="text-sm text-foreground">Critical Issues</p>
                <p className="text-xs text-muted-foreground">Instant alerts for critical findings</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between max-w-lg">
              <div>
                <p className="text-sm text-foreground">Weekly Reports</p>
                <p className="text-xs text-muted-foreground">Summary of all findings and trends</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </div>

        {/* Restart Account */}
        <div className="bg-card border border-destructive/30 rounded-lg p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-destructive" />
            <h3 className="text-sm font-semibold text-foreground">Danger Zone</h3>
          </div>

          {!showRestart ? (
            <div className="flex items-center justify-between max-w-lg">
              <div>
                <p className="text-sm text-foreground">Restart Account</p>
                <p className="text-xs text-muted-foreground">Delete all data and start fresh from onboarding</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowRestart(true)}
                className="border-destructive text-destructive hover:bg-destructive/10"
              >
                Restart
              </Button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="max-w-lg space-y-3"
            >
              <p className="text-sm text-destructive font-medium">
                This will permanently delete all your scans, issues, websites, and branding data.
              </p>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Type <span className="font-mono font-bold text-foreground">{RESTART_WORD}</span> to confirm
                </label>
                <Input
                  value={restartWord}
                  onChange={(e) => setRestartWord(e.target.value)}
                  placeholder={RESTART_WORD}
                  className="bg-secondary border-border text-foreground font-mono"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleRestartAccount}
                  disabled={restarting || restartWord !== RESTART_WORD}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {restarting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Confirm Restart
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setShowRestart(false); setRestartWord(""); setRestartPassword(""); }}
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-gradient-primary text-primary-foreground hover:opacity-90"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
};

export default SettingsPage;
