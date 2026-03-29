import { motion } from "framer-motion";
import { Target } from "lucide-react";
import ActionItem, { Priority } from "@/components/ui/action-item";

const allActions = [
  {
    title: "Checkout button non-functional on mobile",
    description: "The primary CTA on the checkout page doesn't respond to tap events on iOS Safari.",
    priority: "critical" as Priority,
    impact: "High revenue risk",
    location: "/checkout",
    fixTypes: ["code" as const, "no-code" as const],
  },
  {
    title: "Missing CSRF token on login form",
    description: "Login form lacks CSRF protection, exposing authentication to cross-site forgery.",
    priority: "critical" as Priority,
    impact: "Security vulnerability",
    location: "/login",
    fixTypes: ["dev" as const, "code" as const],
  },
  {
    title: "Contact form doesn't validate email",
    description: "Users can submit the contact form with invalid emails, causing bounce-backs.",
    priority: "critical" as Priority,
    impact: "Lost leads",
    location: "/contact",
    fixTypes: ["code" as const, "no-code" as const],
  },
  {
    title: "Slow page load on pricing page",
    description: "Pricing page takes 4.2s to load. Unoptimized images and render-blocking scripts.",
    priority: "warning" as Priority,
    impact: "Conversion drop-off",
    location: "/pricing",
    fixTypes: ["dev" as const, "visual" as const],
  },
  {
    title: "Missing alt text on hero images",
    description: "3 hero images have no alt attributes. Harms SEO and accessibility.",
    priority: "warning" as Priority,
    impact: "SEO & accessibility",
    location: "/",
    fixTypes: ["content" as const, "code" as const],
  },
  {
    title: "Inconsistent button styles",
    description: "Secondary CTAs use 4 different style patterns across pages.",
    priority: "warning" as Priority,
    impact: "Brand consistency",
    location: "Global",
    fixTypes: ["visual" as const, "code" as const],
  },
  {
    title: "FAQ section could reduce support tickets",
    description: "Top 5 support questions aren't addressed on the website.",
    priority: "low" as Priority,
    impact: "Support cost reduction",
    location: "/",
    fixTypes: ["content" as const],
  },
  {
    title: "Add social proof to pricing page",
    description: "No testimonials or trust badges on the pricing page.",
    priority: "low" as Priority,
    impact: "Trust improvement",
    location: "/pricing",
    fixTypes: ["content" as const, "visual" as const],
  },
];

const sections: { key: Priority; label: string; emoji: string }[] = [
  { key: "critical", label: "Do Now", emoji: "🔴" },
  { key: "warning", label: "Next", emoji: "🟠" },
  { key: "low", label: "Later", emoji: "🟢" },
];

const ActionCenter = () => {
  return (
    <div className="p-8 max-w-5xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Target className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Action Center</h1>
            <p className="text-sm text-muted-foreground">Prioritized fixes ranked by business impact</p>
          </div>
        </div>
      </motion.div>

      {sections.map((section) => {
        const items = allActions.filter((a) => a.priority === section.key);
        if (items.length === 0) return null;
        return (
          <div key={section.key} className="mb-8">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <span>{section.emoji}</span>
              {section.label}
              <span className="text-xs text-muted-foreground font-normal">({items.length})</span>
            </h2>
            <div className="space-y-2">
              {items.map((action, i) => (
                <ActionItem key={i} {...action} index={i} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ActionCenter;
