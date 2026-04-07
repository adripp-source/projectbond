import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, Mail, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (error: any) {
      toast.error(error.message || "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-glow opacity-40" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-sm px-6"
      >
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Project Bond</h1>
        </div>

        {sent ? (
          <div className="text-center">
            <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Check Your Email</h2>
            <p className="text-sm text-muted-foreground mb-4">
              We sent a password reset link to <strong className="text-foreground">{email}</strong>.
              Click the link in the email to set a new password.
            </p>
            <p className="text-xs text-muted-foreground mb-6">
              Didn't get it? Check your spam folder, or try again.
            </p>
            <div className="space-y-2">
              <Button variant="outline" onClick={() => setSent(false)} className="w-full border-border text-foreground">
                Try Again
              </Button>
              <Link to="/auth">
                <Button variant="ghost" className="w-full text-muted-foreground">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to Login
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-center text-foreground text-lg font-semibold mb-2">Reset Your Password</h2>
            <p className="text-center text-muted-foreground text-sm mb-6">
              Enter your email and we'll send you a link to reset your password.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 bg-card border-border text-foreground placeholder:text-muted-foreground"
                  required
                />
              </div>
              <Button type="submit" disabled={loading}
                className="w-full h-11 bg-gradient-primary text-primary-foreground font-medium hover:opacity-90">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Reset Link"}
              </Button>
            </form>
            <Link to="/auth">
              <Button variant="ghost" className="w-full mt-4 text-muted-foreground">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Login
              </Button>
            </Link>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
