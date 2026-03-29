import { motion } from "framer-motion";
import { Newspaper, ThumbsUp, ThumbsDown, Minus, Lightbulb } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

const sentimentData = [
  { week: "W1", positive: 45, neutral: 35, negative: 20 },
  { week: "W2", positive: 48, neutral: 32, negative: 20 },
  { week: "W3", positive: 42, neutral: 30, negative: 28 },
  { week: "W4", positive: 55, neutral: 28, negative: 17 },
];

const complaints = [
  { topic: "Slow customer support response", mentions: 34, trend: "rising" },
  { topic: "Pricing page is confusing", mentions: 21, trend: "stable" },
  { topic: "Onboarding too complex", mentions: 18, trend: "declining" },
  { topic: "Missing API documentation", mentions: 12, trend: "rising" },
];

const MediaFootprint = () => {
  return (
    <div className="p-8 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Newspaper className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Media Footprint</h1>
            <p className="text-sm text-muted-foreground">Brand perception and customer sentiment analysis</p>
          </div>
        </div>
      </motion.div>

      {/* Sentiment Summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "Positive", value: "55%", icon: ThumbsUp, color: "text-success" },
          { label: "Neutral", value: "28%", icon: Minus, color: "text-muted-foreground" },
          { label: "Negative", value: "17%", icon: ThumbsDown, color: "text-destructive" },
        ].map((item) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-lg p-5 shadow-card"
          >
            <div className="flex items-center gap-2 mb-2">
              <item.icon className={`w-4 h-4 ${item.color}`} />
              <span className="text-sm text-muted-foreground">{item.label}</span>
            </div>
            <span className={`text-2xl font-bold ${item.color}`}>{item.value}</span>
          </motion.div>
        ))}
      </div>

      {/* Chart */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card border border-border rounded-lg p-5 mb-8 shadow-card"
      >
        <h3 className="text-sm font-medium text-muted-foreground mb-4">Sentiment Over Time</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={sentimentData}>
            <defs>
              <linearGradient id="posGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="negGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="week" tick={{ fill: "hsl(215, 14%, 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(215, 14%, 50%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "hsl(220, 13%, 9%)", border: "1px solid hsl(220, 13%, 16%)", borderRadius: "6px", fontSize: "12px" }} />
            <Area type="monotone" dataKey="positive" stroke="hsl(142, 71%, 45%)" fill="url(#posGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="negative" stroke="hsl(0, 72%, 51%)" fill="url(#negGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Complaints */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-lg p-5 shadow-card">
          <h3 className="text-sm font-semibold text-foreground mb-4">Top Complaints</h3>
          <div className="space-y-3">
            {complaints.map((c, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-secondary-foreground">{c.topic}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{c.mentions} mentions</span>
                  <span className={`text-xs ${c.trend === "rising" ? "text-destructive" : c.trend === "declining" ? "text-success" : "text-muted-foreground"}`}>
                    {c.trend === "rising" ? "↑" : c.trend === "declining" ? "↓" : "→"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-4 h-4 text-warning" />
            <h3 className="text-sm font-semibold text-foreground">How to Improve</h3>
          </div>
          <ul className="space-y-3 text-sm text-secondary-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">→</span>
              Add live chat or faster support response SLA to address the #1 complaint
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">→</span>
              Simplify pricing with a comparison table and FAQ section
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">→</span>
              Create an interactive onboarding wizard to reduce friction
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">→</span>
              Publish comprehensive API docs with code examples
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default MediaFootprint;
