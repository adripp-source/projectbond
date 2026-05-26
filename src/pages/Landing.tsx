import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Navbar */}
      <motion.nav
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 z-50 glass border-b border-border"
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <span className="text-sm font-bold text-white">PB</span>
            </div>
            <span className="font-semibold text-foreground">ProjectBond</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">Features</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground">How it Works</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="bg-gradient-primary text-white">Get Started</Button>
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <div className="pt-32 pb-20 px-6 relative overflow-hidden">
        {/* Background gradient orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-30" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl opacity-20" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/50 border border-primary/20 mb-6">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-xs font-medium text-foreground">Behavioral QA &amp; exploratory testing</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 tracking-tight">
              Catch broken flows before <span className="text-gradient">your users do</span>
            </h1>

            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
              ProjectBond runs human-like interaction tests against your production site — surfacing authentication loops, broken interactions, dead links, and loading-state regressions with reproducible evidence.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link to="/auth">
                <Button size="lg" className="bg-gradient-primary text-white gap-2">
                  Start behavioral scan <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="gap-2">
                See sample report <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>

          {/* Hero Product Image */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="bg-gradient-card border border-primary/10 rounded-2xl p-8 shadow-card backdrop-blur">
              <div className="grid grid-cols-3 gap-4 h-64">
                {/* Left Sidebar */}
                <div className="bg-card rounded-lg border border-border p-4 space-y-3">
                  <div className="h-3 bg-primary/20 rounded w-20" />
                  <div className="space-y-2">
                    <div className="h-2 bg-muted/20 rounded w-full" />
                    <div className="h-2 bg-muted/20 rounded w-4/5" />
                    <div className="h-2 bg-muted/20 rounded w-3/5" />
                  </div>
                  <div className="pt-4 space-y-2">
                    <div className="h-2 bg-muted/10 rounded w-full" />
                    <div className="h-2 bg-muted/10 rounded w-4/5" />
                  </div>
                </div>

                {/* Center Content */}
                <div className="col-span-2 space-y-4">
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                    <div className="h-3 bg-primary/30 rounded w-1/3 mb-3" />
                    <div className="space-y-2">
                      <div className="h-2 bg-primary/20 rounded w-full" />
                      <div className="h-2 bg-primary/20 rounded w-2/3" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-card rounded-lg p-3 border border-border">
                      <div className="h-2 bg-muted/20 rounded mb-2" />
                      <div className="h-4 bg-gradient-primary rounded w-1/2" />
                    </div>
                    <div className="bg-card rounded-lg p-3 border border-border">
                      <div className="h-2 bg-muted/20 rounded mb-2" />
                      <div className="h-4 bg-success rounded w-1/2" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-secondary/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Reliability testing for production
            </h2>
            <p className="text-lg text-muted-foreground">
              Infrastructure-grade QA for product, platform, and SRE teams
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                title: "Authentication flow checks",
                description: "Walk through login, signup, and OAuth paths to detect redirect loops, broken sessions, and unreachable post-auth routes.",
                icon: "🔐"
              },
              {
                title: "Broken interaction detection",
                description: "Click, type, and navigate like a real user. Surface dead buttons, unhandled errors, and silent failures across every flow.",
                icon: "🧪"
              },
              {
                title: "Loading-state monitoring",
                description: "Flag routes that exceed loading thresholds, stall on spinners, or hang on async requests in production.",
                icon: "⏱️"
              },
              {
                title: "Workflow continuation",
                description: "Tests don't stop at the first screen — multi-step forms, route progressions, and conditional flows are walked end to end.",
                icon: "🧭"
              },
              {
                title: "Reproducible evidence",
                description: "Every issue ships with steps to reproduce, network traces, and replayable paths. No guesswork for the engineer fixing it.",
                icon: "📎"
              },
              {
                title: "Behavior consistency",
                description: "Compare scan-over-scan to catch regressions in forms, data transfer, and chatbot or assistant responses between deploys.",
                icon: "📊"
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="bg-card border border-border rounded-xl p-6 hover:border-primary/30 transition-colors"
              >
                <div className="text-3xl mb-3">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-16 px-6 bg-background">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm text-muted-foreground mb-8">TRUSTED BY PRODUCT &amp; PLATFORM TEAMS</p>
          <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
            {["Acme Studio", "Vertex", "Luminous", "Spherule", "Cloudverge"].map(name => (
              <div key={name} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-muted" />
                <span className="text-sm font-medium text-foreground">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto bg-gradient-card border border-primary/10 rounded-2xl p-12 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Monitor production flows. Catch regressions before users do.
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Run your first behavioral scan in under a minute.
          </p>
          <Link to="/auth">
            <Button size="lg" className="bg-gradient-primary text-white gap-2">
              Start behavioral scan <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <span className="text-xs font-bold text-white">PB</span>
                </div>
                <span className="font-semibold text-foreground">ProjectBond</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Where projects, people, and growth work together.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Features</a></li>
                <li><a href="#" className="hover:text-foreground">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground">Security</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">About</a></li>
                <li><a href="#" className="hover:text-foreground">Blog</a></li>
                <li><a href="#" className="hover:text-foreground">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Privacy</a></li>
                <li><a href="#" className="hover:text-foreground">Terms</a></li>
                <li><a href="#" className="hover:text-foreground">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 flex items-center justify-between text-sm text-muted-foreground">
            <p>&copy; 2025 ProjectBond. All rights reserved.</p>
            <div className="flex gap-4">
              <a href="#" className="hover:text-foreground">Twitter</a>
              <a href="#" className="hover:text-foreground">GitHub</a>
              <a href="#" className="hover:text-foreground">LinkedIn</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
