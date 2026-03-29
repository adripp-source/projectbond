import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Globe, Shield, Play, RefreshCw, Plus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ActionItem from "@/components/ui/action-item";
import ScoreCard from "@/components/ui/score-card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const qaIssues = [
  {
    title: "Checkout button doesn't respond on iOS",
    description: "Touch events on the primary CTA fail in iOS Safari 17+.",
    priority: "critical" as const,
    impact: "23% of mobile users affected",
    location: "/checkout",
    fixTypes: ["code" as const, "no-code" as const],
  },
  {
    title: "Navigation dropdown misaligned on tablet",
    description: "Main nav dropdown overlaps hero section on iPad landscape.",
    priority: "warning" as const,
    impact: "Layout issue",
    location: "/",
    fixTypes: ["code" as const, "visual" as const],
  },
  {
    title: "Form submission shows no feedback",
    description: "Contact form appears to do nothing after submit — no success/error message.",
    priority: "warning" as const,
    impact: "User confusion",
    location: "/contact",
    fixTypes: ["code" as const, "content" as const],
  },
];

const securityIssues = [
  {
    title: "Missing CSRF protection on auth forms",
    description: "Login and signup forms lack anti-CSRF tokens (OWASP WSTG-SESS-005).",
    priority: "critical" as const,
    impact: "Attack vector",
    location: "/login",
    fixTypes: ["dev" as const],
  },
  {
    title: "Cookies without Secure flag",
    description: "Session cookies transmitted over HTTP without Secure attribute.",
    priority: "warning" as const,
    impact: "Session hijacking risk",
    location: "Global",
    fixTypes: ["dev" as const],
  },
];

const WebsiteAnalysis = () => {
  return (
    <div className="p-8 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Globe className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Website Analysis</h1>
              <p className="text-sm text-muted-foreground">QA testing + security scanning</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Auto-scan: 3/15 today</span>
            <Button size="sm" variant="outline" className="border-border text-foreground hover:bg-secondary">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Run Scan
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Scores */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <ScoreCard label="QA Score" score={68} icon={Play} trend="up" trendValue="3pts" />
        <ScoreCard label="Security Score" score={54} icon={Shield} trend="stable" trendValue="0pts" />
      </div>

      {/* QA Issues */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Play className="w-4 h-4 text-primary" />
          QA Issues
          <span className="text-xs text-muted-foreground font-normal">({qaIssues.length})</span>
        </h2>
        <div className="space-y-2">
          {qaIssues.map((issue, i) => (
            <ActionItem key={i} {...issue} index={i} />
          ))}
        </div>
      </div>

      {/* Security */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-destructive" />
          Security Findings
          <span className="text-xs text-muted-foreground font-normal">({securityIssues.length})</span>
        </h2>
        <div className="space-y-2">
          {securityIssues.map((issue, i) => (
            <ActionItem key={i} {...issue} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default WebsiteAnalysis;
