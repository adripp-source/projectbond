import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, ArrowRight, Globe, Loader2, Building, Code, Users, Blocks } from "lucide-react";
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
    description: "Technical fixes, code diffs, deployment steps",
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

const Onboarding = () => {
  const [url, setUrl] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [step, setStep] = useState<"user_type" | "input" | "analyzing">("user_type");
  const [progress, setProgress] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleTypeSelect = async (type: string) => {
    setSelectedType(type);
    if (user) {
      await supabase
        .from("profiles")
        .update({ user_type: type } as any)
        .eq("user_id", user.id);
    }
    setStep("input");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !user) return;
    setIsAnalyzing(true);
    setStep("analyzing");

    try {
      // Save website
      setProgress("Saving website...");
      const { error: websiteError } = await supabase
        .from("websites")
        .insert({ user_id: user.id, url: url.trim(), name: companyName.trim() || null, section: "general" });
      if (websiteError) throw websiteError;

      // Save branding if company name provided
      if (companyName.trim()) {
        await supabase.from("branding").upsert(
          { user_id: user.id, company_name: companyName.trim() },
          { onConflict: "user_id" }
        );
      }

      // Run AI analysis
      setProgress("Analyzing website with AI...");
      await api.analyzeWebsite(url.trim(), companyName.trim() || undefined);

      // Run media analysis if company name provided
      if (companyName.trim()) {
        setProgress("Analyzing brand perception...");
        await api.analyzeMedia(companyName.trim());
      }

      // Mark onboarding complete
      await supabase
        .from("profiles")
        .update({ onboarding_completed: true } as any)
        .eq("user_id", user.id);

      toast.success("Analysis complete!");
      navigate("/home");
    } catch (error: any) {
      console.error("Onboarding error:", error);
      toast.error(error.message || "Analysis failed. You can retry from the dashboard.");
      // Mark onboarding complete anyway so they can use the app
      if (user) {
        await supabase
          .from("profiles")
          .update({ onboarding_completed: true } as any)
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
                  className={`w-full text-left bg-card border rounded-lg p-4 transition-all hover:border-primary/50 hover:bg-secondary/50 ${
                    selectedType === type.value ? "border-primary bg-secondary" : "border-border"
                  }`}
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

        {step === "input" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
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
                onClick={() => setStep("user_type")}
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
