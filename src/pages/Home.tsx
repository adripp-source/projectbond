import { motion } from "framer-motion";
import { Shield, HeartPulse, MessageCircle, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import ScoreCard from "@/components/ui/score-card";
import ActionItem from "@/components/ui/action-item";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

const trendData = [
  { day: "Mon", issues: 14, risks: 8, sentiment: 62 },
  { day: "Tue", issues: 12, risks: 7, sentiment: 65 },
  { day: "Wed", issues: 15, risks: 9, sentiment: 60 },
  { day: "Thu", issues: 11, risks: 6, sentiment: 68 },
  { day: "Fri", issues: 9, risks: 5, sentiment: 72 },
  { day: "Sat", issues: 8, risks: 4, sentiment: 75 },
  { day: "Sun", issues: 7, risks: 4, sentiment: 78 },
];

const topActions = [
  {
    title: "Checkout button non-functional on mobile",
    description: "The primary CTA on the checkout page doesn't respond to tap events on iOS Safari, blocking 23% of mobile conversions.",
    priority: "critical" as const,
    impact: "High revenue risk",
    location: "/checkout",
    fixTypes: ["code" as const, "no-code" as const],
  },
  {
    title: "Missing CSRF token on login form",
    description: "Login form lacks CSRF protection, exposing the authentication flow to cross-site request forgery attacks.",
    priority: "critical" as const,
    impact: "Security vulnerability",
    location: "/login",
    fixTypes: ["dev" as const, "code" as const],
  },
  {
    title: "Slow page load on pricing page",
    description: "The pricing page takes 4.2s to load due to unoptimized images and render-blocking scripts.",
    priority: "warning" as const,
    impact: "Conversion drop-off",
    location: "/pricing",
    fixTypes: ["dev" as const, "visual" as const],
  },
];

const Home = () => {
  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Last scan: 12 minutes ago</p>
      </motion.div>

      {/* Scores */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <ScoreCard
          label="Website Health"
          score={72}
          icon={HeartPulse}
          trend="up"
          trendValue="4pts"
        />
        <ScoreCard
          label="Security Risk"
          score={58}
          icon={Shield}
          trend="down"
          trendValue="2pts"
        />
        <ScoreCard
          label="Customer Sentiment"
          score={78}
          icon={MessageCircle}
          trend="up"
          trendValue="6pts"
        />
      </div>

      {/* AI Summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-card border border-border rounded-lg p-5 mb-8 shadow-card"
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-md bg-gradient-primary flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">AI Summary</h3>
        </div>
        <p className="text-sm text-secondary-foreground leading-relaxed">
          Your website has <span className="text-destructive font-medium">7 critical issues</span>,{" "}
          <span className="text-warning font-medium">3 security risks</span>, and{" "}
          <span className="text-primary font-medium">5 customer concerns</span>. Fixing the{" "}
          <span className="text-foreground font-medium">checkout flow</span>,{" "}
          <span className="text-foreground font-medium">login security</span>, and{" "}
          <span className="text-foreground font-medium">page speed</span> will have the highest impact on revenue and trust.
        </p>
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-lg p-5 shadow-card"
        >
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Issue & Risk Trends</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="issueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: "hsl(215, 14%, 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215, 14%, 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(220, 13%, 9%)",
                  border: "1px solid hsl(220, 13%, 16%)",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              <Area type="monotone" dataKey="issues" stroke="hsl(217, 91%, 60%)" fill="url(#issueGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="risks" stroke="hsl(0, 72%, 51%)" fill="url(#riskGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card border border-border rounded-lg p-5 shadow-card"
        >
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Sentiment Trend</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: "hsl(215, 14%, 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(215, 14%, 50%)", fontSize: 11 }} axisLine={false} tickLine={false} domain={[50, 100]} />
              <Tooltip
                contentStyle={{
                  background: "hsl(220, 13%, 9%)",
                  border: "1px solid hsl(220, 13%, 16%)",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              <Area type="monotone" dataKey="sentiment" stroke="hsl(142, 71%, 45%)" fill="url(#sentGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Top Actions */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Priority Actions</h3>
          <a href="/actions" className="text-xs text-primary hover:underline">
            View all →
          </a>
        </div>
        <div className="space-y-2">
          {topActions.map((action, i) => (
            <ActionItem key={i} {...action} index={i} />
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Home;
