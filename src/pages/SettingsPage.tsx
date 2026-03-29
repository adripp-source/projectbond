import { motion } from "framer-motion";
import { Settings, User, Bell, Shield, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const SettingsPage = () => {
  return (
    <div className="p-8 max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Settings className="w-4 h-4 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Settings</h1>
        </div>
      </motion.div>

      <div className="space-y-6">
        {/* Profile */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Profile</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 max-w-lg">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Name</label>
              <Input defaultValue="Alex Chen" className="bg-secondary border-border text-foreground" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email</label>
              <Input defaultValue="alex@acme.com" className="bg-secondary border-border text-foreground" />
            </div>
          </div>
        </div>

        {/* Scan Settings */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Scan Configuration</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between max-w-lg">
              <div>
                <p className="text-sm text-foreground">Auto QA Scans</p>
                <p className="text-xs text-muted-foreground">Run 2–5 scans automatically per day</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between max-w-lg">
              <div>
                <p className="text-sm text-foreground">Security Scans</p>
                <p className="text-xs text-muted-foreground">OWASP-based safe security testing</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between max-w-lg">
              <div>
                <p className="text-sm text-foreground">Media Monitoring</p>
                <p className="text-xs text-muted-foreground">Track brand sentiment continuously</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-card border border-border rounded-lg p-6 shadow-card">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between max-w-lg">
              <div>
                <p className="text-sm text-foreground">Critical Issues</p>
                <p className="text-xs text-muted-foreground">Instant alerts for critical findings</p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between max-w-lg">
              <div>
                <p className="text-sm text-foreground">Weekly Reports</p>
                <p className="text-xs text-muted-foreground">Summary of all findings and trends</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </div>

        <Button className="bg-gradient-primary text-primary-foreground hover:opacity-90">Save Settings</Button>
      </div>
    </div>
  );
};

export default SettingsPage;
