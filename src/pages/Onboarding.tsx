import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, ArrowRight, Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const Onboarding = () => {
  const [url, setUrl] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !user) return;
    setIsAnalyzing(true);

    try {
      // Save website
      const { error: websiteError } = await supabase.from("websites").insert({
        user_id: user.id,
        url: url.trim(),
        name: companyName.trim() || null,
        section: "general",
      });
      if (websiteError) throw websiteError;

      // Save branding if company name provided
      if (companyName.trim()) {
        const { error: brandingError } = await supabase.from("branding").upsert({
          user_id: user.id,
          company_name: companyName.trim(),
        }, { onConflict: "user_id" });
        if (brandingError) throw brandingError;
      }

      toast.success("Website added! Starting analysis...");
      setTimeout(() => navigate("/home"), 1000);
    } catch (error: any) {
      toast.error(error.message || "Failed to save");
      setIsAnalyzing(false);
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

        <p className="text-center text-muted-foreground text-sm mb-8 leading-relaxed">
          Enter your website URL. We'll analyze everything —<br />
          UX, security, brand — and tell you exactly what to fix.
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

          <Input
            type="text"
            placeholder="Company name (optional)"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="h-11 bg-card border-border text-foreground placeholder:text-muted-foreground"
          />

          <Button
            type="submit"
            disabled={isAnalyzing || !url.trim()}
            className="w-full h-11 bg-gradient-primary text-primary-foreground font-medium hover:opacity-90"
          >
            {isAnalyzing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Start Analysis
                <ArrowRight className="w-4 h-4" />
              </span>
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

export default Onboarding;
