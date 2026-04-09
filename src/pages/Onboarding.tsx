import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, ArrowRight, Globe, Loader2, Building, Code, Users, Blocks, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";

const userTypes = [
  {
    value: "dev_team",
    label: "I have a dev team",
    description: "Collaborative workspace with issue board & company code",
    icon: Users,
  },
  {
    value: "developer",
    label: "I code myself",
    description: "HTML/CSS/JS code snippets, React components",
    icon: Code,
  },
  {
    value: "nocode",
    label: "I use no-code tools",
    description: "Step-by-step instructions for Wix, Webflow, Shopify, etc.",
    icon: Blocks,
  },
];

type Step = "welcome" | "user_type" | "dev_team_choice" | "create_workspace" | "join_workspace" | "input" | "analyzing";

const Onboarding = () => {
  const [url, setUrl] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [step, setStep] = useState<Step>("welcome");
  const [progress, setProgress] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [codeError, setCodeError] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleTypeSelect = async (type: string) => {
    setSelectedType(type);
    if (user) {
      await supabase
        .from("profiles")
        .update({ user_type: type })
        .eq("user_id", user.id);
    }
    if (type === "dev_team") {
      setStep("dev_team_choice");
    } else {
      setStep("input");
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim() || !user) return;

    try {
      // Generate code via DB function
      const { data: codeData, error: codeErr } = await supabase.rpc("generate_company_code");
      if (codeErr) throw codeErr;
      const code = codeData as string;

      // Create workspace
      const { data: ws, error: wsErr } = await supabase
        .from("workspaces")
        .insert({ owner_id: user.id, company_name: workspaceName.trim(), company_code: code })
        .select()
        .single();
      if (wsErr) throw wsErr;

      // Add owner as member
      await supabase
        .from("workspace_members")
        .insert({ workspace_id: ws.id, user_id: user.id, role: "owner" });

      // Link profile
      await supabase
        .from("profiles")
        .update({ workspace_id: ws.id } as any)
        .eq("user_id", user.id);

      setGeneratedCode(code);
      setCompanyName(workspaceName.trim());
      setStep("input");
      toast.success(`Workspace created! Your company code: ${code}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create workspace");
    }
  };

  const handleJoinWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyCode.trim() || !user) return;
    setCodeError("");

    try {
      // Find workspace by code
      const { data: ws, error } = await supabase
        .from("workspaces")
        .select("*")
        .eq("company_code", companyCode.trim())
        .maybeSingle();

      if (error) throw error;
      if (!ws) {
        setCodeError("Invalid company code");
        return;
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", ws.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existing) {
        await supabase
          .from("workspace_members")
          .insert({ workspace_id: ws.id, user_id: user.id, role: "member" });
      }

      // Link profile
      await supabase
        .from("profiles")
        .update({ workspace_id: ws.id } as any)
        .eq("user_id", user.id);

      setCompanyName(ws.company_name);
      setStep("input");
      toast.success(`Joined ${ws.company_name}!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to join workspace");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !user) return;
    setIsAnalyzing(true);
    setStep("analyzing");

    try {
      setProgress("Saving website...");
      const { error: websiteError } = await supabase
        .from("websites")
        .insert({ user_id: user.id, url: url.trim(), name: companyName.trim() || null, section: "general" });
      if (websiteError) throw websiteError;

      if (companyName.trim()) {
        await supabase.from("branding").upsert(
          { user_id: user.id, company_name: companyName.trim() },
          { onConflict: "user_id" }
        );
      }

      setProgress("Analyzing website with AI...");
      await api.analyzeWebsite(url.trim(), companyName.trim() || undefined);

      if (companyName.trim()) {
        setProgress("Analyzing brand perception...");
        await api.analyzeMedia(companyName.trim());
      }

      await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("user_id", user.id);

      toast.success("Analysis complete!");
      navigate("/home");
    } catch (error: any) {
      console.error("Onboarding error:", error);
      toast.error(error.message || "Analysis failed. You can retry from the dashboard.");
      if (user) {
        await supabase
          .from("profiles")
          .update({ onboarding_completed: true })
          .eq("user_id", user.id);
      }
      navigate("/home");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-glow opacity-40" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-md px-6"
      >
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Project Bond</h1>
        </div>

        {step === "user_type" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-center text-foreground text-lg font-semibold mb-2">
              How do you build your website?
            </h2>
            <p className="text-center text-muted-foreground text-sm mb-6">
              We'll customize all fixes and recommendations based on your preference.
            </p>
            <div className="space-y-3">
              {userTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => handleTypeSelect(type.value)}
                  className="w-full text-left bg-card border rounded-lg p-4 transition-all hover:border-primary/50 hover:bg-secondary/50 border-border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                      <type.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{type.label}</p>
                      <p className="text-xs text-muted-foreground">{type.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === "dev_team_choice" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-center text-foreground text-lg font-semibold mb-2">
              Dev Team Setup
            </h2>
            <p className="text-center text-muted-foreground text-sm mb-6">
              Create a new workspace or join an existing one with a company code.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setStep("create_workspace")}
                className="w-full text-left bg-card border border-border rounded-lg p-4 transition-all hover:border-primary/50 hover:bg-secondary/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                    <Building className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Create new workspace</p>
                    <p className="text-xs text-muted-foreground">Get a company code for your team</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => setStep("join_workspace")}
                className="w-full text-left bg-card border border-border rounded-lg p-4 transition-all hover:border-primary/50 hover:bg-secondary/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                    <Hash className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Join with company code</p>
                    <p className="text-xs text-muted-foreground">Enter the 6-digit code from your team</p>
                  </div>
                </div>
              </button>
            </div>
            <button
              onClick={() => setStep("user_type")}
              className="w-full text-xs text-muted-foreground hover:text-foreground mt-4"
            >
              ← Back
            </button>
          </motion.div>
        )}

        {step === "create_workspace" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-center text-foreground text-lg font-semibold mb-2">
              Create Your Workspace
            </h2>
            <p className="text-center text-muted-foreground text-sm mb-6">
              Your team will use the generated code to join.
            </p>
            <form onSubmit={handleCreateWorkspace} className="space-y-3">
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Company / Team name"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="pl-10 h-11 bg-card border-border text-foreground placeholder:text-muted-foreground"
                  required
                />
              </div>
              <Button
                type="submit"
                className="w-full h-11 bg-gradient-primary text-primary-foreground font-medium hover:opacity-90"
              >
                <span className="flex items-center gap-2">
                  Create Workspace
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Button>
            </form>
            <button
              onClick={() => setStep("dev_team_choice")}
              className="w-full text-xs text-muted-foreground hover:text-foreground mt-4"
            >
              ← Back
            </button>
          </motion.div>
        )}

        {step === "join_workspace" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-center text-foreground text-lg font-semibold mb-2">
              Join Your Team
            </h2>
            <p className="text-center text-muted-foreground text-sm mb-6">
              Enter the 6-digit company code from your team admin.
            </p>
            <form onSubmit={handleJoinWorkspace} className="space-y-3">
              <div className="relative">
                <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="000000"
                  value={companyCode}
                  onChange={(e) => {
                    setCompanyCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setCodeError("");
                  }}
                  className="pl-10 h-11 bg-card border-border text-foreground placeholder:text-muted-foreground font-mono text-center text-lg tracking-[0.5em]"
                  maxLength={6}
                  required
                />
              </div>
              {codeError && (
                <p className="text-xs text-destructive text-center">{codeError}</p>
              )}
              <Button
                type="submit"
                disabled={companyCode.length !== 6}
                className="w-full h-11 bg-gradient-primary text-primary-foreground font-medium hover:opacity-90"
              >
                <span className="flex items-center gap-2">
                  Join Workspace
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Button>
            </form>
            <button
              onClick={() => setStep("dev_team_choice")}
              className="w-full text-xs text-muted-foreground hover:text-foreground mt-4"
            >
              ← Back
            </button>
          </motion.div>
        )}

        {step === "input" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {generatedCode && (
              <div className="bg-card border border-primary/30 rounded-lg p-4 mb-6 text-center">
                <p className="text-xs text-muted-foreground mb-1">Your Company Code</p>
                <p className="text-2xl font-mono font-bold text-primary tracking-[0.3em]">{generatedCode}</p>
                <p className="text-xs text-muted-foreground mt-1">Share this with your team members</p>
              </div>
            )}

            <p className="text-center text-muted-foreground text-sm mb-8 leading-relaxed">
              Paste your website URL. We'll analyze everything —<br />
              UX, security, brand — and tell you exactly how to fix it.
            </p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="url"
                  placeholder="https://yourwebsite.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="pl-10 h-11 bg-card border-border text-foreground placeholder:text-muted-foreground"
                  required
                />
              </div>

              {!generatedCode && (
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Company name (optional, enables brand analysis)"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="pl-10 h-11 bg-card border-border text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              )}

              <Button
                type="submit"
                disabled={isAnalyzing || !url.trim()}
                className="w-full h-11 bg-gradient-primary text-primary-foreground font-medium hover:opacity-90"
              >
                <span className="flex items-center gap-2">
                  Start Analysis
                  <ArrowRight className="w-4 h-4" />
                </span>
              </Button>

              <button
                type="button"
                onClick={() => setStep(selectedType === "dev_team" ? "dev_team_choice" : "user_type")}
                className="w-full text-xs text-muted-foreground hover:text-foreground mt-2"
              >
                ← Change preference
              </button>
            </form>
          </motion.div>
        )}

        {step === "analyzing" && (
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-sm text-foreground font-medium mb-2">Analyzing your website...</p>
            <p className="text-xs text-muted-foreground animate-pulse">{progress}</p>
            <p className="text-xs text-muted-foreground mt-4">This may take 30-60 seconds</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Onboarding;
