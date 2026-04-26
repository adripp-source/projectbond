import { ReactNode } from "react";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  secondary?: ReactNode;
}

const EmptyState = ({ icon: Icon, title, description, action, secondary }: EmptyStateProps) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-card border border-border rounded-xl p-10 text-center shadow-card max-w-md mx-auto"
  >
    <div className="w-12 h-12 rounded-xl bg-gradient-primary mx-auto mb-4 flex items-center justify-center">
      <Icon className="w-6 h-6 text-primary-foreground" />
    </div>
    <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{description}</p>
    {action && (
      <Button onClick={action.onClick} className="bg-gradient-primary text-primary-foreground">
        {action.label}
      </Button>
    )}
    {secondary && <div className="mt-3">{secondary}</div>}
  </motion.div>
);

export default EmptyState;
