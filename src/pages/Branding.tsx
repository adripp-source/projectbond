import { motion } from "framer-motion";
import { Palette, Mail, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const Branding = () => {
  return (
    <div className="p-8 max-w-4xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Palette className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Branding</h1>
            <p className="text-sm text-muted-foreground">Your brand identity and customer expectations</p>
          </div>
        </div>
      </motion.div>

      {/* Brand Summary */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6 shadow-card">
        <h3 className="text-sm font-semibold text-foreground mb-4">Brand Summary</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Tone</span>
            <p className="text-sm text-secondary-foreground mt-1">Professional, approachable, slightly technical. Emphasizes trust and reliability.</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Customer Expectations</span>
            <p className="text-sm text-secondary-foreground mt-1">Fast response times, transparent pricing, solid documentation. Users expect a polished, enterprise-ready experience.</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Positioning</span>
            <p className="text-sm text-secondary-foreground mt-1">Mid-market SaaS targeting growth-stage companies. Competing on ease-of-use and integrations.</p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Key Differentiator</span>
            <p className="text-sm text-secondary-foreground mt-1">AI-first approach with actionable outputs. Not just analytics — a decision engine.</p>
          </div>
        </div>
      </div>

      {/* Editable Settings */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-card">
        <h3 className="text-sm font-semibold text-foreground mb-4">Contact Settings</h3>
        <div className="space-y-4 max-w-sm">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Support Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                defaultValue="support@acme.com"
                className="pl-10 bg-secondary border-border text-foreground"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Escalation Email</label>
            <div className="relative">
              <AlertTriangle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                defaultValue="escalations@acme.com"
                className="pl-10 bg-secondary border-border text-foreground"
              />
            </div>
          </div>
          <Button className="bg-gradient-primary text-primary-foreground hover:opacity-90">Save Changes</Button>
        </div>
      </div>
    </div>
  );
};

export default Branding;
