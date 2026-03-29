import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Palette, Mail, AlertTriangle, Building, Save, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const Branding = () => {
  const { user } = useAuth();
  const [companyName, setCompanyName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [escalationEmail, setEscalationEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("branding")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCompanyName(data.company_name || "");
          setSupportEmail(data.support_email || "");
          setEscalationEmail(data.escalation_email || "");
        }
        setLoading(false);
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("branding").upsert(
        {
          user_id: user.id,
          company_name: companyName.trim() || null,
          support_email: supportEmail.trim() || null,
          escalation_email: escalationEmail.trim() || null,
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;
      toast.success("Branding saved!");
    } catch (error: any) {
      toast.error(error.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Palette className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Branding</h1>
            <p className="text-sm text-muted-foreground">Your brand identity and contact settings</p>
          </div>
        </div>
      </motion.div>

      {/* Company Name */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6 shadow-card">
        <h3 className="text-sm font-semibold text-foreground mb-4">Company Identity</h3>
        <div className="max-w-sm">
          <label className="text-xs text-muted-foreground mb-1 block">Company Name</label>
          <div className="relative">
            <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Your company name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="pl-10 bg-secondary border-border text-foreground"
            />
          </div>
        </div>
      </div>

      {/* Brand Summary (auto-generated placeholder) */}
      {companyName && (
        <div className="bg-card border border-border rounded-lg p-6 mb-6 shadow-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Brand Summary</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Tone</span>
              <p className="text-sm text-secondary-foreground mt-1">
                Professional, approachable, slightly technical. Emphasizes trust and reliability.
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Customer Expectations</span>
              <p className="text-sm text-secondary-foreground mt-1">
                Fast response times, transparent pricing, solid documentation.
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Positioning</span>
              <p className="text-sm text-secondary-foreground mt-1">
                Growth-stage SaaS competing on ease-of-use and integrations.
              </p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Key Differentiator</span>
              <p className="text-sm text-secondary-foreground mt-1">
                AI-first approach with actionable, execution-ready outputs.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Contact Settings */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-card">
        <h3 className="text-sm font-semibold text-foreground mb-4">Contact Settings</h3>
        <div className="space-y-4 max-w-sm">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Support Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="support@yourcompany.com"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="pl-10 bg-secondary border-border text-foreground"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Escalation Email</label>
            <div className="relative">
              <AlertTriangle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="escalations@yourcompany.com"
                value={escalationEmail}
                onChange={(e) => setEscalationEmail(e.target.value)}
                className="pl-10 bg-secondary border-border text-foreground"
              />
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-primary text-primary-foreground hover:opacity-90"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Branding;
